const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};



// 3. Create Bill (Simplified)
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const {
      billName,
      categoryId,
      groupId,
      totalAmount,
      items,
      receiptImageUrl,
      maxPaymentDate,
      allowScheduledPayment = true,
      splitMethod = "equal",
      currency = "IDR"
    } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billName || !totalAmount) {
      return res.status(400).json({ error: "Bill name and total amount required" });
    }

    // Generate unique bill code (max 8 chars)
    const billCode = `B${Date.now().toString().slice(-6)}`;

    // Use transaction for step-by-step creation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create bill first
      const bill = await tx.bill.create({
        data: {
          hostId: userId,
          categoryId: categoryId || null,
          groupId: groupId || null,
          billName,
          billCode,
          receiptImageUrl: receiptImageUrl || null,
          totalAmount: parseFloat(totalAmount),
          maxPaymentDate: maxPaymentDate ? new Date(maxPaymentDate) : null,
          allowScheduledPayment,
          status: "active",
          splitMethod,
          currency,
        },
      });

      // 2. Create bill items if provided
      if (items && items.length > 0) {
        await tx.billItem.createMany({
          data: items.map(item => ({
            billId: bill.billId,
            itemName: item.itemName,
            price: parseFloat(item.price),
            quantity: item.quantity || 1,
            category: item.category || "food_item",
            ocrConfidence: item.ocrConfidence || null,
            isVerified: item.isVerified || true,
          })),
        });
      }

      // 3. Create host as first participant
      await tx.billParticipant.create({
        data: {
          billId: bill.billId,
          userId,
          amountShare: parseFloat(totalAmount), // Host pays full amount initially
          paymentStatus: "pending",
        },
      });

      // 4. Create bill invite for sharing
      await tx.billInvite.create({
        data: {
          billId: bill.billId,
          joinCode: billCode,
          inviteLink: `https://splitr.app/j/${billCode}`,
          qrCodeUrl: `https://splitr.app/q/${billCode}`,
          createdBy: userId,
          maxUses: 50,
          currentUses: 0,
          expiresAt: maxPaymentDate ? new Date(maxPaymentDate) : null,
        },
      });

      // 5. Create activity log
      await tx.activityLog.create({
        data: {
          userId,
          billId: bill.billId,
          activityType: "bill_created",
          title: "Bill Created",
          description: `You created a new bill: ${billName}`,
        },
      });

      return bill;
    });

    // Get complete bill data
    const completeBill = await prisma.bill.findUnique({
      where: { billId: result.billId },
      include: {
        billItems: true,
        host: true,
        category: true,
        group: true,
        billInvites: true,
      },
    });

    res.json({
      success: true,
      billId: completeBill.billId,
      billCode: completeBill.billCode,
      billName: completeBill.billName,
      totalAmount: completeBill.totalAmount,
      maxPaymentDate: completeBill.maxPaymentDate,
      allowScheduledPayment: completeBill.allowScheduledPayment,
      splitMethod: completeBill.splitMethod,
      currency: completeBill.currency,
      status: completeBill.status,
      category: completeBill.category?.categoryName,
      group: completeBill.group?.groupName,
      items: completeBill.billItems,
      host: {
        name: completeBill.host.name,
        account: completeBill.host.bniAccountNumber,
      },
      inviteLink: completeBill.billInvites[0]?.inviteLink,
      qrCodeUrl: completeBill.billInvites[0]?.qrCodeUrl,
    });
  } catch (error) {
    console.error("Create bill error:", error);
    res.status(500).json({ 
      error: "Failed to create bill",
      details: error.message 
    });
  }
});

// 4. Join Bill
router.post("/join", authenticateToken, async (req, res) => {
  try {
    const { billCode } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billCode) {
      return res.status(400).json({ error: "Bill code required" });
    }

    const bill = await prisma.bill.findUnique({
      where: { billCode },
      include: {
        billItems: true,
        host: true,
        billParticipants: true,
        billInvites: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.status !== "active") {
      return res.status(400).json({ error: "Bill is no longer active" });
    }

    // Check if already participant
    const existingParticipant = bill.billParticipants.find(p => p.userId === userId);
    if (existingParticipant) {
      return res.status(400).json({ error: "Already joined this bill" });
    }

    // Security Check: Only allow invited users or friends of host to join
    const isInvited = await prisma.notification.findFirst({
      where: {
        userId,
        billId: bill.billId,
        type: "bill_invitation",
      },
    });

    const isFriendOfHost = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: bill.hostId, friendUserId: userId },
          { userId, friendUserId: bill.hostId },
        ],
        status: "active",
      },
    });

    if (!isInvited && !isFriendOfHost) {
      return res.status(403).json({ 
        error: "Access denied", 
        message: "You can only join bills from friends or if you were invited" 
      });
    }

    // Get current user info
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // Add as participant
      const participant = await tx.billParticipant.create({
        data: {
          billId: bill.billId,
          userId,
          amountShare: 0, // Will be calculated below
          paymentStatus: "pending",
        },
      });

      // Recalculate equal split for all participants
      const totalParticipants = bill.billParticipants.length + 1;
      const sharePerPerson = parseFloat(bill.totalAmount) / totalParticipants;

      // Update all participants' shares (including new one)
      await tx.billParticipant.updateMany({
        where: { billId: bill.billId },
        data: { amountShare: sharePerPerson },
      });

      // Update invite usage
      if (bill.billInvites[0]) {
        await tx.billInvite.update({
          where: { inviteId: bill.billInvites[0].inviteId },
          data: {
            currentUses: { increment: 1 },
          },
        });

        // Create join log
        await tx.billJoinLog.create({
          data: {
            inviteId: bill.billInvites[0].inviteId,
            userId,
            joinMethod: "code",
          },
        });
      }

      // Create activity logs
      await tx.activityLog.createMany({
        data: [
          {
            userId: bill.hostId,
            billId: bill.billId,
            activityType: "participant_joined",
            title: "New Participant",
            description: `${user.name} joined your bill '${bill.billName}'`,
          },
          {
            userId,
            billId: bill.billId,
            activityType: "bill_joined",
            title: "Joined Bill",
            description: `You joined '${bill.billName}' hosted by ${bill.host.name}`,
          },
        ],
      });

      // Create notification for host
      await tx.notification.create({
        data: {
          userId: bill.hostId,
          billId: bill.billId,
          type: "participant_joined",
          title: "New Participant",
          message: `${user.name} joined your bill '${bill.billName}'`,
        },
      });

      return { participant, sharePerPerson };
    });

    res.json({
      message: "Successfully joined bill",
      billId: bill.billId,
      billName: bill.billName,
      totalAmount: parseFloat(bill.totalAmount),
      yourShare: result.sharePerPerson,
      totalParticipants: bill.billParticipants.length + 1,
      maxPaymentDate: bill.maxPaymentDate,
      allowScheduledPayment: bill.allowScheduledPayment,
      host: {
        name: bill.host.name,
        account: bill.host.bniAccountNumber,
      },
      items: bill.billItems,
    });
  } catch (error) {
    console.error("Join bill error:", error);
    res.status(500).json({ error: "Failed to join bill" });
  }
});

// 5. Get Bill Details
router.get("/:billId", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    const bill = await prisma.bill.findUnique({
      where: { billId },
      include: {
        billItems: {
          include: {
            itemAssignments: {
              include: {
                participant: {
                  include: {
                    user: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
        host: true,
        billParticipants: {
          include: {
            user: {
              select: {
                userId: true,
                name: true,
                bniAccountNumber: true,
              },
            },
          },
        },
        category: true,
        group: true,
        billInvites: true,
        payments: {
          where: { status: "completed" },
        },
        scheduledPayments: {
          where: { status: "scheduled" },
        },
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const userParticipant = bill.billParticipants.find(p => p.userId === userId);
    const isHost = bill.hostId === userId;
    
    // Calculate payment summary
    const totalPaid = bill.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalScheduled = bill.scheduledPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const remainingAmount = parseFloat(bill.totalAmount) - totalPaid;
    
    res.json({
      billId: bill.billId,
      billCode: bill.billCode,
      billName: bill.billName,
      totalAmount: parseFloat(bill.totalAmount),
      maxPaymentDate: bill.maxPaymentDate,
      allowScheduledPayment: bill.allowScheduledPayment,
      status: bill.status,
      splitMethod: bill.splitMethod,
      currency: bill.currency,
      receiptImageUrl: bill.receiptImageUrl,
      category: {
        name: bill.category?.categoryName,
        icon: bill.category?.categoryIcon,
      },
      group: bill.group ? {
        groupId: bill.group.groupId,
        groupName: bill.group.groupName,
      } : null,
      host: {
        userId: bill.host.userId,
        name: bill.host.name,
        account: bill.host.bniAccountNumber,
      },
      isHost,
      items: bill.billItems.map(item => ({
        itemId: item.itemId,
        itemName: item.itemName,
        price: parseFloat(item.price),
        quantity: item.quantity,
        category: item.category,
        ocrConfidence: item.ocrConfidence,
        isVerified: item.isVerified,
        assignments: item.itemAssignments.map(assignment => ({
          participantName: assignment.participant.user?.name || assignment.participant.tempName,
          quantity: assignment.quantityAssigned,
          amount: parseFloat(assignment.amountAssigned),
        })),
      })),
      participants: bill.billParticipants.map(p => ({
        participantId: p.participantId,
        userId: p.userId,
        name: p.user?.name || p.tempName,
        account: p.user?.bniAccountNumber,
        amountShare: parseFloat(p.amountShare),
        paymentStatus: p.paymentStatus,
        paidAt: p.paidAt,
        joinedAt: p.joinedAt,
      })),
      yourShare: userParticipant ? parseFloat(userParticipant.amountShare) : 0,
      yourStatus: userParticipant?.paymentStatus || "not_participant",
      paymentSummary: {
        totalPaid,
        totalScheduled,
        remainingAmount,
        completedPayments: bill.payments.length,
        scheduledPayments: bill.scheduledPayments.length,
      },
      inviteInfo: bill.billInvites[0] ? {
        inviteLink: bill.billInvites[0].inviteLink,
        qrCodeUrl: bill.billInvites[0].qrCodeUrl,
        maxUses: bill.billInvites[0].maxUses,
        currentUses: bill.billInvites[0].currentUses,
        expiresAt: bill.billInvites[0].expiresAt,
      } : null,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
    });
  } catch (error) {
    console.error("Get bill error:", error);
    res.status(500).json({ error: "Failed to get bill details" });
  }
});

// 6. Assign Items to Participants
router.post("/:billId/assign-items", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const { assignments } = req.body; // [{ participantId, itemId, quantity, amount }]
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Verify bill ownership
    const bill = await prisma.bill.findFirst({
      where: { billId, hostId: userId },
    });

    if (!bill) {
      return res.status(403).json({ error: "Only bill host can assign items" });
    }

    // Delete existing assignments
    await prisma.itemAssignment.deleteMany({ where: { billId } });

    // Create new assignments
    if (assignments && assignments.length > 0) {
      await prisma.itemAssignment.createMany({
        data: assignments.map(assignment => ({
          billId,
          itemId: assignment.itemId,
          participantId: assignment.participantId,
          quantityAssigned: assignment.quantity,
          amountAssigned: parseFloat(assignment.amount),
        })),
      });
    }

    res.json({ message: "Items assigned successfully" });
  } catch (error) {
    console.error("Assign items error:", error);
    res.status(500).json({ error: "Failed to assign items" });
  }
});

// 7. Add Participants by Host (Host decides who pays what)
router.post("/:billId/add-participants", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const { participants } = req.body; // [{ userId, items: [{ itemId, quantity, amount }] }]
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Verify bill ownership
    const bill = await prisma.bill.findFirst({
      where: { billId, hostId: userId },
      include: { host: true, billItems: true },
    });

    if (!bill) {
      return res.status(403).json({ error: "Only bill host can add participants" });
    }

    const results = { added: [], failed: [] };

    await prisma.$transaction(async (tx) => {
      for (const participantData of participants) {
        try {
          const { userId: friendId, items } = participantData;

          // Check if user exists (can be friend or non-friend)
          const friend = await tx.user.findUnique({ where: { userId: friendId } });
          if (!friend) {
            results.failed.push({ userId: friendId, reason: "User not found" });
            continue;
          }

          // Check if already participant
          const existingParticipant = await tx.billParticipant.findFirst({
            where: { billId, userId: friendId },
          });

          if (existingParticipant) {
            results.failed.push({ userId: friendId, reason: "Already participant" });
            continue;
          }

          // Check if user is friend of host
          const isFriend = await tx.friend.findFirst({
            where: {
              OR: [
                { userId: bill.hostId, friendUserId: friendId },
                { userId: friendId, friendUserId: bill.hostId },
              ],
              status: "active",
            },
          });

          const participantType = isFriend ? "friend" : "guest";

          // Calculate total amount for this participant
          const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

          // Create participant
          const participant = await tx.billParticipant.create({
            data: {
              billId,
              userId: friendId,
              amountShare: totalAmount,
              paymentStatus: "pending",
            },
          });

          // Create item assignments
          if (items && items.length > 0) {
            await tx.itemAssignment.createMany({
              data: items.map(item => ({
                billId,
                itemId: item.itemId,
                participantId: participant.participantId,
                quantityAssigned: item.quantity,
                amountAssigned: parseFloat(item.amount),
              })),
            });
          }

          // Create notification for participant (different for friend vs guest)
          const notificationMessage = isFriend 
            ? `${bill.host.name} assigned you items in '${bill.billName}' - Total: Rp ${totalAmount.toLocaleString()}`
            : `${bill.host.name} added you as guest to '${bill.billName}' - Total: Rp ${totalAmount.toLocaleString()}. Join to pay your share.`;

          await tx.notification.create({
            data: {
              userId: friendId,
              billId,
              type: "bill_assignment",
              title: isFriend ? "Bill Assignment" : "Guest Bill Assignment",
              message: notificationMessage,
            },
          });

          // Create activity log
          await tx.activityLog.create({
            data: {
              userId: friendId,
              billId,
              activityType: "bill_assigned",
              title: "Bill Assigned",
              description: `${bill.host.name} assigned you items in '${bill.billName}'`,
            },
          });

          results.added.push({ 
            userId: friendId, 
            name: friend.name, 
            totalAmount,
            itemCount: items.length 
          });
        } catch (error) {
          results.failed.push({ userId: participantData.userId, reason: "Assignment failed" });
        }
      }
    });

    res.json({
      message: "Participants added and assigned",
      ...results,
    });
  } catch (error) {
    console.error("Add participants error:", error);
    res.status(500).json({ error: "Failed to add participants" });
  }
});

// 7.1. Add Participant by Username (Guest Support)
router.post("/:billId/add-participant-by-username", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const { username, items } = req.body; // { username: "someuser", items: [{ itemId, quantity, amount }] }
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Verify bill ownership
    const bill = await prisma.bill.findFirst({
      where: { billId, hostId: userId },
      include: { host: true },
    });

    if (!bill) {
      return res.status(403).json({ error: "Only bill host can add participants" });
    }

    // Find user by username
    const targetUser = await prisma.user.findFirst({
      where: {
        auth: {
          username: { equals: username, mode: "insensitive" }
        }
      },
      include: {
        auth: {
          select: { username: true }
        }
      }
    });

    if (!targetUser) {
      return res.status(404).json({ 
        error: "User not found",
        message: `No user found with username '${username}'`
      });
    }

    // Check if already participant
    const existingParticipant = await prisma.billParticipant.findFirst({
      where: { billId, userId: targetUser.userId },
    });

    if (existingParticipant) {
      return res.status(400).json({ error: "User is already a participant" });
    }

    // Check if user is friend of host
    const isFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: bill.hostId, friendUserId: targetUser.userId },
          { userId: targetUser.userId, friendUserId: bill.hostId },
        ],
        status: "active",
      },
    });

    const participantType = isFriend ? "friend" : "guest";
    const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    const result = await prisma.$transaction(async (tx) => {
      // Create participant
      const participant = await tx.billParticipant.create({
        data: {
          billId,
          userId: targetUser.userId,
          amountShare: totalAmount,
          paymentStatus: "pending",
        },
      });

      // Create item assignments
      if (items && items.length > 0) {
        await tx.itemAssignment.createMany({
          data: items.map(item => ({
            billId,
            itemId: item.itemId,
            participantId: participant.participantId,
            quantityAssigned: item.quantity,
            amountAssigned: parseFloat(item.amount),
          })),
        });
      }

      // Create notification
      const notificationMessage = isFriend 
        ? `${bill.host.name} assigned you items in '${bill.billName}' - Total: Rp ${totalAmount.toLocaleString()}`
        : `${bill.host.name} added you as guest to '${bill.billName}' - Total: Rp ${totalAmount.toLocaleString()}. Use bill code: ${bill.billCode}`;

      await tx.notification.create({
        data: {
          userId: targetUser.userId,
          billId,
          type: "bill_assignment",
          title: isFriend ? "Bill Assignment" : "Guest Bill Assignment",
          message: notificationMessage,
        },
      });

      // Create activity log
      await tx.activityLog.create({
        data: {
          userId: targetUser.userId,
          billId,
          activityType: "bill_assigned",
          title: isFriend ? "Bill Assigned" : "Added as Guest",
          description: `${bill.host.name} ${isFriend ? 'assigned you items' : 'added you as guest'} in '${bill.billName}'`,
        },
      });

      return { participant, participantType };
    });

    res.json({
      success: true,
      message: `User added as ${participantType}`,
      participant: {
        userId: targetUser.userId,
        username: targetUser.auth.username,
        name: targetUser.name,
        type: participantType,
        totalAmount,
        itemCount: items.length
      },
      billCode: bill.billCode
    });
  } catch (error) {
    console.error("Add participant by username error:", error);
    res.status(500).json({ error: "Failed to add participant" });
  }
});

// 8. Invite Friends to Bill (Original)
router.post("/:billId/invite", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const { friendIds, message } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!friendIds || friendIds.length === 0) {
      return res.status(400).json({ error: "Friend IDs required" });
    }

    // Verify bill ownership
    const bill = await prisma.bill.findFirst({
      where: { billId, hostId: userId },
      include: { host: true },
    });

    if (!bill) {
      return res.status(403).json({ error: "Only bill host can invite friends" });
    }

    const results = { invited: [], failed: [] };

    for (const friendId of friendIds) {
      try {
        // Check if friend exists
        const friend = await prisma.user.findUnique({ where: { userId: friendId } });
        if (!friend) {
          results.failed.push({ userId: friendId, reason: "User not found" });
          continue;
        }

        // Check if already participant
        const existingParticipant = await prisma.billParticipant.findFirst({
          where: { billId, userId: friendId },
        });

        if (existingParticipant) {
          results.failed.push({ userId: friendId, reason: "Already participant" });
          continue;
        }

        // Create notification
        await prisma.notification.create({
          data: {
            userId: friendId,
            billId,
            type: "bill_invitation",
            title: "Bill Invitation",
            message: message || `${bill.host.name} invited you to split '${bill.billName}'`,
          },
        });

        results.invited.push({ userId: friendId, name: friend.name });
      } catch (error) {
        results.failed.push({ userId: friendId, reason: "Invitation failed" });
      }
    }

    res.json({
      message: "Invitations sent",
      ...results,
      inviteLink: `https://splitr.app/join/${bill.billCode}`,
    });
  } catch (error) {
    console.error("Invite friends error:", error);
    res.status(500).json({ error: "Failed to send invitations" });
  }
});

// 10. Get Item Assignments
router.get("/:billId/assignments", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Check if user is participant or host
    const bill = await prisma.bill.findFirst({
      where: {
        billId,
        OR: [
          { hostId: userId },
          { billParticipants: { some: { userId } } },
        ],
      },
      include: {
        billItems: {
          include: {
            itemAssignments: {
              include: {
                participant: {
                  include: {
                    user: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
        billParticipants: {
          include: {
            user: {
              select: { userId: true, name: true },
            },
          },
        },
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const userParticipant = bill.billParticipants.find(p => p.userId === userId);
    const userAssignments = bill.billItems.flatMap(item => 
      item.itemAssignments.filter(assignment => 
        assignment.participant.userId === userId
      ).map(assignment => ({
        itemName: item.itemName,
        quantity: assignment.quantityAssigned,
        amount: assignment.amountAssigned,
      }))
    );

    res.json({
      billId: bill.billId,
      billName: bill.billName,
      totalAmount: bill.totalAmount,
      yourShare: userParticipant?.amountShare || 0,
      yourItems: userAssignments,
      allItems: bill.billItems.map(item => ({
        itemId: item.itemId,
        itemName: item.itemName,
        price: item.price,
        quantity: item.quantity,
        assignments: item.itemAssignments.map(assignment => ({
          participantName: assignment.participant.user?.name || assignment.participant.tempName,
          quantity: assignment.quantityAssigned,
          amount: assignment.amountAssigned,
        })),
      })),
      participants: bill.billParticipants.map(p => ({
        participantId: p.participantId,
        name: p.user?.name || p.tempName,
        amountShare: p.amountShare,
        paymentStatus: p.paymentStatus,
      })),
    });
  } catch (error) {
    console.error("Get assignments error:", error);
    res.status(500).json({ error: "Failed to get assignments" });
  }
});

// Join Bill by Username (Check Assignment)
router.post("/join-by-username", authenticateToken, async (req, res) => {
  try {
    const { billCode, username } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billCode || !username) {
      return res.status(400).json({ error: "Bill code and username required" });
    }

    // Verify user's username matches
    const userAuth = await prisma.userAuth.findUnique({
      where: { userId },
      select: { username: true },
    });

    if (userAuth.username !== username) {
      return res.status(403).json({ 
        error: "Username mismatch", 
        message: "You can only join with your own username" 
      });
    }

    const bill = await prisma.bill.findUnique({
      where: { billCode },
      include: {
        billItems: true,
        host: true,
        billParticipants: true,
        billInvites: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.status !== "active") {
      return res.status(400).json({ error: "Bill is no longer active" });
    }

    // Check if already participant
    const existingParticipant = bill.billParticipants.find(p => p.userId === userId);
    if (existingParticipant) {
      return res.status(400).json({ error: "Already joined this bill" });
    }

    // Check if user is assigned to this bill (has notification)
    const isAssigned = await prisma.notification.findFirst({
      where: {
        userId,
        billId: bill.billId,
        type: "bill_assignment",
      },
    });

    if (!isAssigned) {
      return res.status(403).json({ 
        error: "Not assigned to this bill", 
        message: "You must be assigned items in this bill to join" 
      });
    }

    // Get current user info
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // User is already in billParticipants from assignment, just update status
      const participant = await tx.billParticipant.findFirst({
        where: { billId: bill.billId, userId },
      });

      if (!participant) {
        return res.status(404).json({ error: "Participant record not found" });
      }

      // Create activity logs
      await tx.activityLog.createMany({
        data: [
          {
            userId: bill.hostId,
            billId: bill.billId,
            activityType: "participant_joined",
            title: "Assigned User Joined",
            description: `${user.name} joined your bill '${bill.billName}' after assignment`,
          },
          {
            userId,
            billId: bill.billId,
            activityType: "bill_joined",
            title: "Joined Assigned Bill",
            description: `You joined '${bill.billName}' where you were assigned items`,
          },
        ],
      });

      // Create notification for host
      await tx.notification.create({
        data: {
          userId: bill.hostId,
          billId: bill.billId,
          type: "participant_joined",
          title: "Assigned User Joined",
          message: `${user.name} joined your bill '${bill.billName}' and can now pay their assigned items`,
        },
      });

      return { participant };
    });

    res.json({
      message: "Successfully joined assigned bill",
      billId: bill.billId,
      billName: bill.billName,
      totalAmount: parseFloat(bill.totalAmount),
      yourShare: parseFloat(result.participant.amountShare),
      host: {
        name: bill.host.name,
        account: bill.host.bniAccountNumber,
      },
      items: bill.billItems,
    });
  } catch (error) {
    console.error("Join bill by username error:", error);
    res.status(500).json({ error: "Failed to join bill" });
  }
});

// Join Bill by ID (More Secure)
router.post("/join-by-id", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billId) {
      return res.status(400).json({ error: "Bill ID required" });
    }

    const bill = await prisma.bill.findUnique({
      where: { billId },
      include: {
        billItems: true,
        host: true,
        billParticipants: true,
        billInvites: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.status !== "active") {
      return res.status(400).json({ error: "Bill is no longer active" });
    }

    // Check if already participant
    const existingParticipant = bill.billParticipants.find(p => p.userId === userId);
    if (existingParticipant) {
      return res.status(400).json({ error: "Already joined this bill" });
    }

    // Strict Security Check: Must be explicitly invited or assigned
    const isInvited = await prisma.notification.findFirst({
      where: {
        userId,
        billId: bill.billId,
        type: { in: ["bill_invitation", "bill_assignment"] },
      },
    });

    if (!isInvited) {
      return res.status(403).json({ 
        error: "Access denied", 
        message: "You must be explicitly invited to join this bill" 
      });
    }

    // Get current user info
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      // Add as participant
      const participant = await tx.billParticipant.create({
        data: {
          billId: bill.billId,
          userId,
          amountShare: 0, // Will be calculated or assigned by host
          paymentStatus: "pending",
        },
      });

      // Create activity logs
      await tx.activityLog.createMany({
        data: [
          {
            userId: bill.hostId,
            billId: bill.billId,
            activityType: "participant_joined",
            title: "New Participant",
            description: `${user.name} joined your bill '${bill.billName}'`,
          },
          {
            userId,
            billId: bill.billId,
            activityType: "bill_joined",
            title: "Joined Bill",
            description: `You joined '${bill.billName}' hosted by ${bill.host.name}`,
          },
        ],
      });

      // Create notification for host
      await tx.notification.create({
        data: {
          userId: bill.hostId,
          billId: bill.billId,
          type: "participant_joined",
          title: "New Participant",
          message: `${user.name} joined your bill '${bill.billName}'`,
        },
      });

      return { participant };
    });

    res.json({
      message: "Successfully joined bill",
      billId: bill.billId,
      billName: bill.billName,
      totalAmount: parseFloat(bill.totalAmount),
      host: {
        name: bill.host.name,
        account: bill.host.bniAccountNumber,
      },
      items: bill.billItems,
    });
  } catch (error) {
    console.error("Join bill by ID error:", error);
    res.status(500).json({ error: "Failed to join bill" });
  }
});

// 11. Get User Bills
router.get("/", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const bills = await prisma.bill.findMany({
      where: {
        OR: [
          { hostId: userId },
          { billParticipants: { some: { userId } } },
        ],
      },
      include: {
        host: true,
        billParticipants: {
          where: { userId },
        },
        category: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      bills: bills.map(bill => ({
        billId: bill.billId,
        billCode: bill.billCode,
        billName: bill.billName,
        totalAmount: bill.totalAmount,
        status: bill.status,
        category: bill.category?.categoryName,
        isHost: bill.hostId === userId,
        hostName: bill.host.name,
        yourShare: bill.billParticipants[0]?.amountShare || 0,
        paymentStatus: bill.billParticipants[0]?.paymentStatus || "not_participant",
        createdAt: bill.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get bills error:", error);
    res.status(500).json({ error: "Failed to get bills" });
  }
});

module.exports = router;