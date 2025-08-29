const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

// Import secure authentication middleware
const { authenticateSecure } = require('../../middleware/auth.middleware');

// Use secure authentication for all bill routes
const authenticateToken = authenticateSecure;

// 2. Transform Frontend Data (Helper endpoint)
router.post("/transform-frontend-data", authenticateToken, async (req, res) => {
  try {
    const frontendData = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // 1. Category mapping
    const categoryMapping = {
      "Food and Beverage": null, // Will find by name
      "Entertainment": null,
      "Transport": null,
      "Other": null
    };

    let categoryId = null;
    if (frontendData.category) {
      const category = await prisma.billCategory.findFirst({
        where: {
          categoryName: {
            contains: frontendData.category.includes("Food") ? "Food" : frontendData.category,
            mode: "insensitive"
          }
        }
      });
      categoryId = category?.categoryId;
    }

    // 2. Transform items
    const items = frontendData.items.map(item => ({
      itemName: item.name,
      price: item.price,
      quantity: item.qty,
      category: item.isSharing ? "sharing_item" : "food_item",
      isSharing: item.isSharing,
      isVerified: true
    }));

    // 3. Create item ID to index mapping
    const itemIdToIndex = {};
    frontendData.items.forEach((item, index) => {
      itemIdToIndex[item.id] = index;
    });

    // 4. Get usernames for member IDs
    const memberIds = frontendData.selectedMembers.filter(id => id !== "host");
    const userMap = {};
    
    for (const memberId of memberIds) {
      const user = await prisma.user.findUnique({
        where: { userId: memberId },
        include: { auth: { select: { username: true } } }
      });
      if (user) {
        userMap[memberId] = user.auth.username;
      }
    }

    // 5. Group assignments by member
    const memberAssignments = {};
    frontendData.assignments.forEach(assignment => {
      if (assignment.memberId === "host") return; // Skip host
      
      if (!memberAssignments[assignment.memberId]) {
        memberAssignments[assignment.memberId] = [];
      }
      
      const itemIndex = itemIdToIndex[assignment.itemId];
      const item = frontendData.items[itemIndex];
      
      memberAssignments[assignment.memberId].push({
        itemIndex,
        quantity: item.isSharing ? 1 : assignment.shareQty,
        amount: item.isSharing ? assignment.shareQty : (item.price * assignment.shareQty)
      });
    });

    // 6. Transform participants
    const participants = [];
    for (const memberId of Object.keys(memberAssignments)) {
      const username = userMap[memberId];
      if (username) {
        participants.push({
          username,
          items: memberAssignments[memberId]
        });
      }
    }

    // 7. Payment deadline
    const maxPaymentDate = frontendData.paymentMethod === "PAY_NOW" 
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    // 8. Build backend data
    const backendData = {
      billName: frontendData.billName,
      categoryId,
      totalAmount: frontendData.totals.grandTotal,
      maxPaymentDate,
      allowScheduledPayment: frontendData.paymentMethod === "PAY_LATER",
      splitMethod: "custom",
      currency: "IDR",
      items,
      participants,
      fees: frontendData.fees
    };

    res.json({
      success: true,
      backendData,
      mapping: {
        categoryId,
        userMap,
        itemIdToIndex,
        participantCount: participants.length
      }
    });
  } catch (error) {
    console.error("Transform data error:", error);
    res.status(500).json({ 
      error: "Failed to transform data",
      details: error.message 
    });
  }
});

// 3. Create Bill (Frontend Calculation with Breakdown)
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const {
      billName,
      categoryId,
      groupId,
      totalAmount,
      items,
      participants = [], // participants with assignments and breakdown
      fees = {}, // calculated fees from frontend
      receiptImageUrl,
      maxPaymentDate,
      allowScheduledPayment = true,
      splitMethod = "custom",
      currency = "IDR"
    } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billName || !totalAmount) {
      return res.status(400).json({ error: "Bill name and total amount required" });
    }

    // Generate unique bill code (max 8 chars)
    const billCode = `B${Date.now().toString().slice(-6)}`;

    // Get host info for notifications
    const host = await prisma.user.findUnique({
      where: { userId },
      select: { name: true, bniAccountNumber: true }
    });

    // Use transaction for complete bill creation
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
          // Store fees as calculated by frontend
          taxPct: fees.taxPct || 0,
          servicePct: fees.servicePct || 0,
          discountPct: fees.discountPct || 0,
          discountNominal: fees.discountNominal || 0,
          subTotal: fees.subTotal || parseFloat(totalAmount),
          taxAmount: fees.taxAmount || 0,
          serviceAmount: fees.serviceAmount || 0,
          discountAmount: fees.discountAmount || 0,
        },
      });

      // 2. Create bill items with isSharing support
      const createdItems = [];
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const createdItem = await tx.billItem.create({
            data: {
              billId: bill.billId,
              itemName: item.itemName,
              price: parseFloat(item.price),
              quantity: item.quantity || 1,
              category: item.category || "food_item",
              isSharing: item.isSharing || false,
              ocrConfidence: item.ocrConfidence || null,
              isVerified: item.isVerified || true,
            },
          });
          createdItems.push({ ...createdItem, originalIndex: i });
        }
      }

      // 3. Add HOST as participant first (auto-completed payment)
      const hostParticipantData = participants?.find(p => p.userId === userId);
      const hostBreakdown = hostParticipantData?.breakdown || {};
      const hostTotalAmount = hostBreakdown.totalAmount || 0;
      
      if (hostTotalAmount > 0) {
        // Create host as participant with completed payment
        const hostParticipant = await tx.billParticipant.create({
          data: {
            billId: bill.billId,
            userId: userId,
            amountShare: hostTotalAmount,
            subtotal: hostBreakdown.subtotal || 0,
            taxAmount: hostBreakdown.taxAmount || 0,
            serviceAmount: hostBreakdown.serviceAmount || 0,
            discountAmount: hostBreakdown.discountAmount || 0,
            paymentStatus: "completed", // Host auto-completed
            paidAt: new Date(), // Mark as paid now
          },
        });

        // Create host's item assignments (use existing hostParticipantData)
        if (hostParticipantData && hostParticipantData.items) {
          const hostAssignments = [];
          for (const assignedItem of hostParticipantData.items) {
            let billItem;
            if (assignedItem.tempItemId) {
              const originalItemIndex = items.findIndex(item => item.tempItemId === assignedItem.tempItemId);
              if (originalItemIndex !== -1) {
                billItem = createdItems.find(item => item.originalIndex === originalItemIndex);
              }
            }
            if (billItem) {
              hostAssignments.push({
                billId: bill.billId,
                itemId: billItem.itemId,
                participantId: hostParticipant.participantId,
                quantityAssigned: assignedItem.quantity,
                amountAssigned: parseFloat(assignedItem.amount || 0),
              });
            }
          }
          if (hostAssignments.length > 0) {
            await tx.itemAssignment.createMany({ data: hostAssignments });
          }
        }

        // Create host's payment record
        await tx.payment.create({
          data: {
            amount: hostTotalAmount,
            paymentMethod: "host_advance",
            paymentType: "instant",
            status: "completed",
            transactionId: `HOST_${Date.now()}`,
            bniReferenceNumber: `HOST_${bill.billCode}`,
            paidAt: new Date(),
            bill: { connect: { billId: bill.billId } },
            user: { connect: { userId: userId } }
          }
        });
      }

      // 4. Add other participants and create assignments
      const participantNotifications = [];
      if (participants && participants.length > 0) {
        for (const participantData of participants) {
          const { userId: participantUserId, items: assignedItems } = participantData;

          // Skip host (already processed above)
          if (participantUserId === userId) continue;

          // Find user by userId
          const targetUser = await tx.user.findUnique({
            where: { userId: participantUserId },
            select: { userId: true, name: true }
          });

          if (!targetUser) {
            throw new Error(`User with userId '${participantUserId}' not found`);
          }

          // Use breakdown from frontend
          const breakdown = participantData.breakdown || {};
          const participantTotalAmount = breakdown.totalAmount || 0;
          const assignments = [];

          for (const assignedItem of assignedItems) {
            let billItem;
            
            // Support both tempItemId and itemIndex for backward compatibility
            if (assignedItem.tempItemId) {
              // Find by tempItemId (match with original items array)
              const originalItemIndex = items.findIndex(item => item.tempItemId === assignedItem.tempItemId);
              if (originalItemIndex === -1) {
                throw new Error(`Item with tempItemId '${assignedItem.tempItemId}' not found`);
              }
              billItem = createdItems.find(item => item.originalIndex === originalItemIndex);
            } else if (assignedItem.itemIndex !== undefined) {
              // Legacy support for itemIndex
              billItem = createdItems.find(item => item.originalIndex === assignedItem.itemIndex);
            }
            
            if (!billItem) {
              throw new Error(`Item at index ${assignedItem.itemIndex || 'undefined'} not found`);
            }

            const itemAmount = parseFloat(assignedItem.amount || 0);
            
            assignments.push({
              billId: bill.billId,
              itemId: billItem.itemId,
              quantityAssigned: assignedItem.quantity,
              amountAssigned: itemAmount
            });
          }

          // Create participant with breakdown
          const participant = await tx.billParticipant.create({
            data: {
              billId: bill.billId,
              userId: targetUser.userId,
              amountShare: participantTotalAmount,
              subtotal: breakdown.subtotal || 0,
              taxAmount: breakdown.taxAmount || 0,
              serviceAmount: breakdown.serviceAmount || 0,
              discountAmount: breakdown.discountAmount || 0,
              paymentStatus: "pending", // Other participants pending
            },
          });

          // Create item assignments
          if (assignments.length > 0) {
            await tx.itemAssignment.createMany({
              data: assignments.map(assignment => ({
                billId: assignment.billId,
                itemId: assignment.itemId,
                participantId: participant.participantId,
                quantityAssigned: assignment.quantityAssigned,
                amountAssigned: assignment.amountAssigned,
              })),
            });
          }

          // Prepare notification data with breakdown from frontend (exclude host)
          participantNotifications.push({
            userId: targetUser.userId,
            amount: participantTotalAmount,
            breakdown: breakdown
          });
        }
      }

      // 5. Create bill invite for sharing
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

      // 6. Create activity log
      await tx.activityLog.create({
        data: {
          userId,
          billId: bill.billId,
          activityType: "bill_created",
          title: "Bill Created",
          description: `You created a new bill: ${billName}`,
        },
      });

      return { bill, createdItems, participantNotifications, hostTotalAmount, hostBreakdown };
    });

    // 7. Send notifications
    const NotificationService = require('../../services/notification.service');
    const notificationService = new NotificationService(prisma);

    // Send bill created notification to host
    await notificationService.sendBillCreated(
      userId,
      result.bill.billId,
      billName,
      result.participantNotifications.length,
      billCode
    );

    // Send bill assignment notifications to participants only (exclude host)
    if (result.participantNotifications.length > 0) {
      for (const participant of result.participantNotifications) {
        // Participants only (host already excluded from participantNotifications)
        await notificationService.sendBillAssignment(
          participant.userId,
          result.bill.billId,
          billName,
          host.name,
          participant.amount,
          billCode
        );
      }
    }

    // Get complete bill data
    const completeBill = await prisma.bill.findUnique({
      where: { billId: result.bill.billId },
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
      items: completeBill.billItems.map((item, index) => {
        const originalItem = items[index];
        return {
          itemId: item.itemId,
          tempItemId: originalItem?.tempItemId, // Return frontend temp ID
          itemName: item.itemName,
          price: parseFloat(item.price),
          quantity: item.quantity,
          category: item.category,
          isSharing: item.isSharing,
          isVerified: item.isVerified
        };
      }),
      host: {
        name: completeBill.host.name,
        account: completeBill.host.bniAccountNumber,
      },
      inviteLink: completeBill.billInvites[0]?.inviteLink,
      qrCodeUrl: completeBill.billInvites[0]?.qrCodeUrl,
      fees: {
        taxPct: parseFloat(completeBill.taxPct || 0),
        servicePct: parseFloat(completeBill.servicePct || 0),
        discountPct: parseFloat(completeBill.discountPct || 0),
        discountNominal: parseFloat(completeBill.discountNominal || 0),
        subTotal: parseFloat(completeBill.subTotal || 0),
        taxAmount: parseFloat(completeBill.taxAmount || 0),
        serviceAmount: parseFloat(completeBill.serviceAmount || 0),
        discountAmount: parseFloat(completeBill.discountAmount || 0)
      },
      calculatedByFrontend: true,
      participantsAdded: result.participantNotifications.length + (result.hostTotalAmount > 0 ? 1 : 0), // Include host if they have items
      notificationsSent: result.participantNotifications.length, // Only other participants get notifications
      participantBreakdowns: [
        // Include host breakdown if they have items
        ...(result.hostTotalAmount > 0 ? [{ userId: userId, breakdown: result.hostBreakdown }] : []),
        // Include other participants
        ...result.participantNotifications.map(p => ({
          userId: p.userId,
          breakdown: p.breakdown
        }))
      ]
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
      return res.status(400).json({ 
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

// 4.0 Get Personal Bill Detail (Participant View - from notification or activity)
router.get("/personal/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Try to find bill by billId first, then by billCode
    let bill = await prisma.bill.findUnique({
      where: { billId: identifier },
      include: {
        host: { select: { name: true, bniAccountNumber: true } },
        billParticipants: {
          where: { userId },
          select: { 
            amountShare: true, 
            paymentStatus: true, 
            paidAt: true,
            subtotal: true,
            taxAmount: true,
            serviceAmount: true,
            discountAmount: true
          }
        },
        payments: {
          where: { 
            userId,
            paymentType: 'scheduled'
          },
          select: {
            scheduledDate: true,
            paymentType: true,
            status: true
          }
        },
        category: true,
        billItems: {
          include: {
            itemAssignments: {
              where: {
                participant: { userId }
              },
              select: {
                quantityAssigned: true,
                amountAssigned: true
              }
            }
          }
        }
      }
    });

    // If not found by billId, try billCode
    if (!bill) {
      bill = await prisma.bill.findUnique({
        where: { billCode: identifier },
        include: {
          host: { select: { name: true, bniAccountNumber: true } },
          billParticipants: {
            where: { userId },
            select: { amountShare: true, paymentStatus: true, paidAt: true }
          },
          category: true,
          billItems: {
            include: {
              itemAssignments: {
                where: {
                  participant: { userId }
                },
                select: {
                  quantityAssigned: true,
                  amountAssigned: true
                }
              }
            }
          }
        }
      });
    }

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const participant = bill.billParticipants[0];
    if (!participant) {
      return res.status(400).json({ error: "You are not a participant in this bill" });
    }

    const now = new Date();
    const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const maxPaymentDate = bill.maxPaymentDate ? new Date(bill.maxPaymentDate) : null;
    const paymentDeadline = bill.allowScheduledPayment && maxPaymentDate ? maxPaymentDate : deadline24h;
    const isExpired = now > paymentDeadline;
    
    const myItems = bill.billItems
      .filter(item => item.itemAssignments.length > 0)
      .map(item => {
        const assignment = item.itemAssignments[0];
        return {
          itemName: item.itemName,
          price: parseFloat(item.price),
          quantity: assignment.quantityAssigned,
          amount: parseFloat(assignment.amountAssigned),
          category: item.category,
          isSharing: item.isSharing,
          // For shared items, show proportional data
          displayQuantity: item.isSharing ? assignment.quantityAssigned : assignment.quantityAssigned,
          displayAmount: parseFloat(assignment.amountAssigned)
        };
      });

    // Use breakdown data from database (calculated by frontend during create)
    const mySubtotal = parseFloat(participant.subtotal || 0);
    const myTaxAmount = parseFloat(participant.taxAmount || 0);
    const myServiceAmount = parseFloat(participant.serviceAmount || 0);
    const myDiscountAmount = parseFloat(participant.discountAmount || 0);
    const myTotalAfterFees = parseFloat(participant.amountShare); // Final amount from database
    
    // Calculate percentage for display only
    const sharePercentage = myTotalAfterFees / parseFloat(bill.totalAmount);

    // Action buttons for participants - allow payment even if overdue
    const actions = {
      canPay: (participant.paymentStatus === 'pending' || participant.paymentStatus === 'scheduled'),
      canSchedule: participant.paymentStatus === 'pending' && bill.allowScheduledPayment && !isExpired,
      showDeadline: participant.paymentStatus === 'pending' || participant.paymentStatus === 'scheduled',
      isPaid: participant.paymentStatus === 'completed',
      isFailed: participant.paymentStatus === 'failed',
      isScheduled: participant.paymentStatus === 'scheduled',
      isOverdue: isExpired && (participant.paymentStatus === 'pending' || participant.paymentStatus === 'scheduled')
    };

    res.json({
      success: true,
      viewType: "personal", // Indicates this is personal view
      bill: {
        billId: bill.billId,
        billCode: bill.billCode,
        billName: bill.billName,
        totalBillAmount: parseFloat(bill.totalAmount),
        yourShare: parseFloat(participant.amountShare),
        paymentStatus: participant.paymentStatus,
        paidAt: participant.paidAt,
        scheduledDate: bill.payments[0]?.scheduledDate || null,
        paymentType: bill.payments[0]?.paymentType || null,
        category: bill.category?.categoryName,
        hostName: bill.host.name,
        hostAccount: bill.host.bniAccountNumber,
        paymentDeadline,
        isExpired,
        canSchedule: bill.allowScheduledPayment,
        myItems,
        itemCount: myItems.length,
        myBreakdown: {
          subtotal: mySubtotal,
          taxAmount: myTaxAmount,
          serviceAmount: myServiceAmount,
          discountAmount: myDiscountAmount,
          totalAfterFees: myTotalAfterFees,
          sharePercentage: Math.round(sharePercentage * 100 * 100) / 100
        },
        billBreakdown: {
          subTotal: parseFloat(bill.subTotal || 0),
          taxPct: parseFloat(bill.taxPct || 0),
          taxAmount: parseFloat(bill.taxAmount || 0),
          servicePct: parseFloat(bill.servicePct || 0),
          serviceAmount: parseFloat(bill.serviceAmount || 0),
          discountPct: parseFloat(bill.discountPct || 0),
          discountAmount: parseFloat(bill.discountAmount || 0),
          totalAmount: parseFloat(bill.totalAmount)
        },
        actions,
        // Add explicit button flags for mobile UI
        showPayButton: actions.canPay,
        showScheduleButton: actions.canSchedule,
        createdAt: bill.createdAt,
      }
    });
  } catch (error) {
    console.error("Get personal bill detail error:", error);
    res.status(500).json({ error: "Failed to get personal bill details" });
  }
});

// 4.0.1 Get Bill from Notification (Alias for backward compatibility)
router.get("/from-notification/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Try to find bill by billId first, then by billCode
    let bill = await prisma.bill.findUnique({
      where: { billId: identifier },
      include: {
        host: { select: { name: true, bniAccountNumber: true } },
        billParticipants: {
          where: { userId },
          select: { 
            amountShare: true, 
            paymentStatus: true, 
            paidAt: true,
            subtotal: true,
            taxAmount: true,
            serviceAmount: true,
            discountAmount: true
          }
        },
        category: true,
        billItems: {
          include: {
            itemAssignments: {
              where: {
                participant: { userId }
              },
              select: {
                quantityAssigned: true,
                amountAssigned: true
              }
            }
          }
        }
      }
    });

    // If not found by billId, try billCode
    if (!bill) {
      bill = await prisma.bill.findUnique({
        where: { billCode: identifier },
        include: {
          host: { select: { name: true, bniAccountNumber: true } },
          billParticipants: {
            where: { userId },
            select: { 
              amountShare: true, 
              paymentStatus: true, 
              paidAt: true,
              subtotal: true,
              taxAmount: true,
              serviceAmount: true,
              discountAmount: true
            }
          },
          category: true,
          billItems: {
            include: {
              itemAssignments: {
                where: {
                  participant: { userId }
                },
                select: {
                  quantityAssigned: true,
                  amountAssigned: true
                }
              }
            }
          }
        }
      });
    }

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const participant = bill.billParticipants[0];
    if (!participant) {
      return res.status(400).json({ error: "You are not a participant in this bill" });
    }

    const now = new Date();
    const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const maxPaymentDate = bill.maxPaymentDate ? new Date(bill.maxPaymentDate) : null;
    const paymentDeadline = bill.allowScheduledPayment && maxPaymentDate ? maxPaymentDate : deadline24h;
    const isExpired = now > paymentDeadline;
    
    const myItems = bill.billItems
      .filter(item => item.itemAssignments.length > 0)
      .map(item => {
        const assignment = item.itemAssignments[0];
        return {
          itemName: item.itemName,
          price: parseFloat(item.price),
          quantity: assignment.quantityAssigned,
          amount: parseFloat(assignment.amountAssigned),
          category: item.category,
          isSharing: item.isSharing,
          displayQuantity: item.isSharing ? assignment.quantityAssigned : assignment.quantityAssigned,
          displayAmount: parseFloat(assignment.amountAssigned)
        };
      });

    // Action buttons for participants - allow payment even if overdue
    const actions = {
      canPay: (participant.paymentStatus === 'pending' || participant.paymentStatus === 'scheduled'),
      canSchedule: participant.paymentStatus === 'pending' && bill.allowScheduledPayment && !isExpired,
      showDeadline: participant.paymentStatus === 'pending' || participant.paymentStatus === 'scheduled',
      isPaid: participant.paymentStatus === 'completed',
      isFailed: participant.paymentStatus === 'failed',
      isScheduled: participant.paymentStatus === 'scheduled',
      isOverdue: isExpired && (participant.paymentStatus === 'pending' || participant.paymentStatus === 'scheduled')
    };

    res.json({
      success: true,
      viewType: "from_notification", // Indicates this is from notification
      bill: {
        billId: bill.billId,
        billCode: bill.billCode,
        billName: bill.billName,
        totalBillAmount: parseFloat(bill.totalAmount),
        yourShare: parseFloat(participant.amountShare),
        paymentStatus: participant.paymentStatus,
        paidAt: participant.paidAt,
        category: bill.category?.categoryName,
        hostName: bill.host.name,
        hostAccount: bill.host.bniAccountNumber,
        paymentDeadline,
        isExpired,
        canSchedule: bill.allowScheduledPayment,
        myItems,
        itemCount: myItems.length,
        myBreakdown: {
          subtotal: parseFloat(participant.subtotal || 0),
          taxAmount: parseFloat(participant.taxAmount || 0),
          serviceAmount: parseFloat(participant.serviceAmount || 0),
          discountAmount: parseFloat(participant.discountAmount || 0),
          totalAmount: parseFloat(participant.amountShare)
        },
        billBreakdown: {
          subTotal: parseFloat(bill.subTotal || 0),
          taxPct: parseFloat(bill.taxPct || 0),
          taxAmount: parseFloat(bill.taxAmount || 0),
          servicePct: parseFloat(bill.servicePct || 0),
          serviceAmount: parseFloat(bill.serviceAmount || 0),
          discountPct: parseFloat(bill.discountPct || 0),
          discountAmount: parseFloat(bill.discountAmount || 0),
          totalAmount: parseFloat(bill.totalAmount)
        },
        actions,
        // Add explicit button flags for mobile UI
        showPayButton: actions.canPay,
        showScheduleButton: actions.canSchedule,
        createdAt: bill.createdAt,
      }
    });
  } catch (error) {
    console.error("Get bill from notification error:", error);
    res.status(500).json({ error: "Failed to get bill details" });
  }
});

// 4.0. Get My Activity (All Bills - Hosted + Assigned) - MUST BE BEFORE /:identifier
router.get("/my-activity", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;
    const { status = "all", limit = 20, offset = 0 } = req.query;

    // Get all bills where user is either host or participant
    let whereCondition = {
      OR: [
        { hostId: userId }, // Bills I created
        { billParticipants: { some: { userId } } } // Bills I'm assigned to
      ]
    };

    // Filter by status if specified
    if (status !== "all") {
      whereCondition.status = status;
    }

    const bills = await prisma.bill.findMany({
      where: whereCondition,
      include: {
        host: { select: { name: true, bniAccountNumber: true } },
        billParticipants: {
          include: {
            user: {
              select: { name: true, bniAccountNumber: true, profilePhotoUrl: true }
            }
          }
        },
        payments: {
          select: {
            userId: true,
            scheduledDate: true,
            paymentType: true,
            status: true
          }
        },
        category: true,
        billItems: {
          include: {
            itemAssignments: {
              where: {
                participant: { userId }
              },
              select: {
                quantityAssigned: true,
                amountAssigned: true
              }
            }
          }
        },
        _count: {
          select: {
            billParticipants: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalBills = await prisma.bill.count({
      where: whereCondition
    });

    res.json({
      success: true,
      myActivity: bills.map(bill => {
        const isHost = bill.hostId === userId;
        const myParticipant = bill.billParticipants.find(p => p.userId === userId);
        
        const now = new Date();
        const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
        const maxPaymentDate = new Date(bill.maxPaymentDate);
        const paymentDeadline = bill.allowScheduledPayment ? maxPaymentDate : deadline24h;
        const isExpired = now > paymentDeadline;
        
        // Get my items (only for participants)
        const myItems = !isHost ? bill.billItems
          .filter(item => item.itemAssignments.length > 0)
          .map(item => {
            const assignment = item.itemAssignments[0];
            return {
              itemName: item.itemName,
              price: parseFloat(item.price),
              quantity: assignment.quantityAssigned,
              amount: parseFloat(assignment.amountAssigned),
              category: item.category,
              isSharing: item.isSharing,
              displayQuantity: item.isSharing ? assignment.quantityAssigned : assignment.quantityAssigned,
              displayAmount: parseFloat(assignment.amountAssigned)
            };
          }) : [];
        
        // For hosts: get all participants payment status (excluding host)
        const participantsStatus = isHost ? bill.billParticipants
          .filter(p => p.userId !== userId) // Exclude host from participants list
          .map(p => {
            // Get payment info for scheduled date (only for scheduled payments)
            const payment = bill.payments?.find(pay => pay.userId === p.userId && (pay.status === 'pending' || pay.paymentType === 'scheduled'));
            
            return {
              participantId: p.participantId,
              userId: p.userId,
              name: p.user?.name || 'Unknown',
              account: p.user?.bniAccountNumber,
              profilePhotoUrl: p.user?.profilePhotoUrl || null,
              amountShare: parseFloat(p.amountShare),
              paymentStatus: p.paymentStatus,
              paidAt: p.paidAt,
              scheduledDate: payment?.scheduledDate || null, // Add scheduled date
              breakdown: {
                subtotal: parseFloat(p.subtotal || 0),
                taxAmount: parseFloat(p.taxAmount || 0),
                serviceAmount: parseFloat(p.serviceAmount || 0),
                discountAmount: parseFloat(p.discountAmount || 0),
                totalAmount: parseFloat(p.amountShare)
              }
            };
          }) : [];
        
        // Payment summary for hosts - use database values only
        const otherParticipants = bill.billParticipants.filter(p => p.userId !== userId);
        const paymentSummary = isHost ? {
          totalParticipants: otherParticipants.length,
          paidCount: otherParticipants.filter(p => p.paymentStatus === 'completed' || p.paymentStatus === 'completed_scheduled' || p.paymentStatus === 'completed_late').length,
          pendingCount: otherParticipants.filter(p => p.paymentStatus === 'pending').length,
          failedCount: otherParticipants.filter(p => p.paymentStatus === 'failed').length,
          totalPaid: otherParticipants
            .filter(p => p.paymentStatus === 'completed' || p.paymentStatus === 'completed_scheduled' || p.paymentStatus === 'completed_late')
            .reduce((sum, p) => sum + parseFloat(p.amountShare), 0),
          totalPending: otherParticipants
            .filter(p => p.paymentStatus === 'pending')
            .reduce((sum, p) => sum + parseFloat(p.amountShare), 0),
          hostPayment: myParticipant ? {
            amountShare: parseFloat(myParticipant.amountShare),
            paymentStatus: myParticipant.paymentStatus,
            paidAt: myParticipant.paidAt
          } : null
        } : null;
        
        // Host financial summary - show what host advanced vs what's owed
        const hostFinancialSummary = isHost ? {
          hostAdvanced: myParticipant ? parseFloat(myParticipant.amountShare) : 0,
          totalOwedByOthers: otherParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0),
          totalPaidByOthers: otherParticipants
            .filter(p => p.paymentStatus === 'completed' || p.paymentStatus === 'completed_scheduled' || p.paymentStatus === 'completed_late')
            .reduce((sum, p) => sum + parseFloat(p.amountShare), 0),
          stillOwedToHost: otherParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0) - 
            otherParticipants
              .filter(p => p.paymentStatus === 'completed' || p.paymentStatus === 'completed_scheduled' || p.paymentStatus === 'completed_late')
              .reduce((sum, p) => sum + parseFloat(p.amountShare), 0)
        } : null;
        
        // Action buttons for participants - allow payment even if overdue
        const actions = !isHost && myParticipant ? {
          canPay: (myParticipant.paymentStatus === 'pending' || myParticipant.paymentStatus === 'scheduled'),
          canSchedule: myParticipant.paymentStatus === 'pending' && bill.allowScheduledPayment && !isExpired,
          showPayNow: (myParticipant.paymentStatus === 'pending' || myParticipant.paymentStatus === 'scheduled'),
          showSchedulePayment: myParticipant.paymentStatus === 'pending' && bill.allowScheduledPayment && !isExpired,
          isPaid: myParticipant.paymentStatus === 'completed' || myParticipant.paymentStatus === 'completed_scheduled' || myParticipant.paymentStatus === 'completed_late',
          isFailed: myParticipant.paymentStatus === 'failed',
          isScheduled: myParticipant.paymentStatus === 'scheduled',
          isOverdue: isExpired && (myParticipant.paymentStatus === 'pending' || myParticipant.paymentStatus === 'scheduled')
        } : null;
        
        // Payment status display text with overdue check
        let paymentStatusDisplay = myParticipant?.paymentStatus || "not_participant";
        if (myParticipant?.paymentStatus === 'pending') {
          paymentStatusDisplay = isExpired ? 'overdue' : 'pending'; // Terlambat atau belum bayar
        } else if (myParticipant?.paymentStatus === 'completed') {
          paymentStatusDisplay = 'completed'; // Instant payment completed
        } else if (myParticipant?.paymentStatus === 'completed_scheduled') {
          paymentStatusDisplay = 'completed_scheduled'; // Scheduled payment completed
        } else if (myParticipant?.paymentStatus === 'completed_late') {
          paymentStatusDisplay = 'completed_late'; // Late payment completed
        } else if (myParticipant?.paymentStatus === 'failed') {
          paymentStatusDisplay = 'failed'; // Gagal/kadaluarsa
        }

        return {
          billId: bill.billId,
          billCode: bill.billCode,
          billName: bill.billName,
          totalBillAmount: parseFloat(bill.totalAmount),
          yourShare: myParticipant ? parseFloat(myParticipant.amountShare) : 0,
          // For card display: hosts see total bill, participants see their share
          displayAmount: isHost ? parseFloat(bill.totalAmount) : (myParticipant ? parseFloat(myParticipant.amountShare) : 0),
          paymentStatus: myParticipant?.paymentStatus || "not_participant", // Original status
          paymentStatusDisplay: paymentStatusDisplay, // Display text
          paidAt: myParticipant?.paidAt,
          category: bill.category?.categoryName,
          hostName: bill.host.name,
          hostAccount: isHost ? null : bill.host.bniAccountNumber,
          paymentDeadline,
          isExpired,
          canSchedule: bill.allowScheduledPayment,
          isHost,
          role: isHost ? "host" : "participant",
          participantCount: bill._count.billParticipants,
          myItems: myItems,
          itemCount: myItems.length,
          myBreakdown: myParticipant ? {
            subtotal: parseFloat(myParticipant.subtotal || 0),
            taxAmount: parseFloat(myParticipant.taxAmount || 0),
            serviceAmount: parseFloat(myParticipant.serviceAmount || 0),
            discountAmount: parseFloat(myParticipant.discountAmount || 0),
            totalAmount: parseFloat(myParticipant.amountShare)
          } : null,
          billBreakdown: {
            subTotal: parseFloat(bill.subTotal || 0),
            taxPct: parseFloat(bill.taxPct || 0),
            taxAmount: parseFloat(bill.taxAmount || 0),
            servicePct: parseFloat(bill.servicePct || 0),
            serviceAmount: parseFloat(bill.serviceAmount || 0),
            discountPct: parseFloat(bill.discountPct || 0),
            discountAmount: parseFloat(bill.discountAmount || 0)
          },
          // HOST SPECIFIC DATA
          participantsStatus: participantsStatus,
          paymentSummary: paymentSummary,
          hostFinancialSummary: hostFinancialSummary,
          // PARTICIPANT SPECIFIC DATA
          actions: actions,
          // Add button visibility flags for mobile UI
          showPayButton: actions?.canPay || false,
          showScheduleButton: actions?.canSchedule || false,
          // Add scheduled date for mobile UI (show for both scheduled and completed_scheduled)
          scheduledDate: !isHost && (myParticipant?.paymentStatus === 'scheduled' || myParticipant?.paymentStatus === 'completed_scheduled') ? 
            bill.payments?.find(pay => pay.userId === userId && pay.paymentType === 'scheduled')?.scheduledDate : null,
          status: bill.status,
          createdAt: bill.createdAt,
        };
      }),
      pagination: {
        total: totalBills,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalBills
      }
    });
  } catch (error) {
    console.error("Get my activity error:", error);
    res.status(500).json({ error: "Failed to get activity" });
  }
});

// 4.1 Get My Assigned Bills (Participant POV) - MUST BE BEFORE /:billId
router.get("/assigned", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const bills = await prisma.bill.findMany({
      where: {
        AND: [
          { hostId: { not: userId } },
          { billParticipants: { some: { userId } } }
        ]
      },
      include: {
        host: { select: { name: true, bniAccountNumber: true } },
        billParticipants: {
          where: { userId },
          select: { amountShare: true, paymentStatus: true, paidAt: true }
        },
        category: true,
        billItems: {
          include: {
            itemAssignments: {
              where: {
                participant: {
                  userId
                }
              },
              select: {
                quantityAssigned: true,
                amountAssigned: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      assignedBills: bills.map(bill => {
        const participant = bill.billParticipants[0];
        
        const now = new Date();
        const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
        const maxPaymentDate = new Date(bill.maxPaymentDate);
        const paymentDeadline = bill.allowScheduledPayment ? maxPaymentDate : deadline24h;
        const isExpired = now > paymentDeadline;
        
        const myItems = bill.billItems
          .filter(item => item.itemAssignments.length > 0)
          .map(item => {
            const assignment = item.itemAssignments[0];
            return {
              itemName: item.itemName,
              price: parseFloat(item.price),
              quantity: assignment.quantityAssigned,
              amount: parseFloat(assignment.amountAssigned),
              category: item.category,
              isSharing: item.isSharing,
              // For shared items, show proportional data
              displayQuantity: item.isSharing ? assignment.quantityAssigned : assignment.quantityAssigned,
              displayAmount: parseFloat(assignment.amountAssigned)
            };
          });
        
        return {
          billId: bill.billId,
          billCode: bill.billCode,
          billName: bill.billName,
          totalBillAmount: parseFloat(bill.totalAmount),
          yourShare: parseFloat(participant.amountShare),
          paymentStatus: participant.paymentStatus,
          paidAt: participant.paidAt,
          category: bill.category?.categoryName,
          hostName: bill.host.name,
          hostAccount: bill.host.bniAccountNumber,
          paymentDeadline,
          isExpired,
          canSchedule: bill.allowScheduledPayment,
          myItems,
          itemCount: myItems.length,
          myBreakdown: {
            subtotal: parseFloat(participant.subtotal || 0),
            taxAmount: parseFloat(participant.taxAmount || 0),
            serviceAmount: parseFloat(participant.serviceAmount || 0),
            discountAmount: parseFloat(participant.discountAmount || 0),
            totalAmount: parseFloat(participant.amountShare)
          },
          billBreakdown: {
            subTotal: parseFloat(bill.subTotal || 0),
            taxPct: parseFloat(bill.taxPct || 0),
            taxAmount: parseFloat(bill.taxAmount || 0),
            servicePct: parseFloat(bill.servicePct || 0),
            serviceAmount: parseFloat(bill.serviceAmount || 0),
            discountPct: parseFloat(bill.discountPct || 0),
            discountAmount: parseFloat(bill.discountAmount || 0)
          },
          createdAt: bill.createdAt,
        };
      })
    });
  } catch (error) {
    console.error("Get assigned bills error:", error);
    res.status(500).json({ error: "Failed to get assigned bills" });
  }
});

// 4.1 Get Master Bill Detail (Complete View - Host/Admin perspective)
router.get("/master/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;
    
    console.log(`🔍 [MASTER BILL] User ${userId} accessing master bill: ${identifier}`);

    // Try to find by billId first, then by billCode
    let bill = await prisma.bill.findUnique({
      where: { billId: identifier },
      include: {
        billItems: {
          include: {
            itemAssignments: {
              include: {
                participant: {
                  include: {
                    user: {
                      select: { name: true, bniAccountNumber: true },
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
          where: { status: { startsWith: "completed" } },
          include: {
            user: {
              select: { name: true }
            }
          }
        },

      },
    });

    // If not found by billId, try billCode
    if (!bill) {
      bill = await prisma.bill.findUnique({
        where: { billCode: identifier },
        include: {
          billItems: {
            include: {
              itemAssignments: {
                include: {
                  participant: {
                    include: {
                      user: {
                        select: { name: true, bniAccountNumber: true },
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
            where: { status: { startsWith: "completed" } },
            include: {
              user: {
                select: { name: true }
              }
            }
          },
          scheduledPayments: {
            where: { status: "scheduled" },
            include: {
              user: {
                select: { name: true }
              }
            }
          },
        },
      });
    }

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const userParticipant = bill.billParticipants.find(p => p.userId === userId);
    const isHost = bill.hostId === userId;

    // Calculate payment summary based on billParticipants data
    const completedParticipants = bill.billParticipants.filter(p => p.paymentStatus === "completed" || p.paymentStatus === "completed_scheduled" || p.paymentStatus === "completed_late");
    const pendingParticipants = bill.billParticipants.filter(p => p.paymentStatus === "pending");
    const scheduledParticipants = bill.billParticipants.filter(p => p.paymentStatus === "scheduled");
    const failedParticipants = bill.billParticipants.filter(p => p.paymentStatus === "failed");
    
    // Calculate amounts
    const totalPaid = completedParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0);
    const totalPending = pendingParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0);
    const totalScheduled = scheduledParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0);
    const totalFailed = failedParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0);
    const remainingAmount = parseFloat(bill.totalAmount) - totalPaid;
    
    // Payment deadline calculation
    const now = new Date();
    const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const maxPaymentDate = bill.maxPaymentDate ? new Date(bill.maxPaymentDate) : null;
    const paymentDeadline = bill.allowScheduledPayment && maxPaymentDate ? maxPaymentDate : deadline24h;
    const isExpired = now > paymentDeadline;
    
    res.json({
      success: true,
      viewType: "master", // Indicates this is master/complete view
      bill: {
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
        paymentDeadline,
        isExpired,
        fees: {
          taxPct: parseFloat(bill.taxPct || 0),
          servicePct: parseFloat(bill.servicePct || 0),
          discountPct: parseFloat(bill.discountPct || 0),
          discountNominal: parseFloat(bill.discountNominal || 0),
          subTotal: parseFloat(bill.subTotal || 0),
          taxAmount: parseFloat(bill.taxAmount || 0),
          serviceAmount: parseFloat(bill.serviceAmount || 0),
          discountAmount: parseFloat(bill.discountAmount || 0)
        },
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
        userRole: isHost ? "host" : (userParticipant ? "participant" : "viewer"),
        items: bill.billItems.map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          price: parseFloat(item.price),
          quantity: item.quantity,
          category: item.category,
          isSharing: item.isSharing,
          ocrConfidence: item.ocrConfidence,
          isVerified: item.isVerified,
          totalAssigned: item.itemAssignments.reduce((sum, a) => sum + parseFloat(a.amountAssigned), 0),
          assignments: item.itemAssignments.map(assignment => ({
            participantId: assignment.participantId,
            participantName: assignment.participant.user?.name || assignment.participant.tempName,
            participantAccount: assignment.participant.user?.bniAccountNumber,
            quantity: assignment.quantityAssigned,
            amount: parseFloat(assignment.amountAssigned),
            isSharedPortion: item.isSharing
          })),
        })),
        participants: bill.billParticipants.map(p => {
          // Get scheduled payment info for this participant
          const scheduledPayment = bill.payments?.find(pay => 
            pay.userId === p.userId && pay.paymentType === 'scheduled'
          );
          
          return {
            participantId: p.participantId,
            userId: p.userId,
            name: p.user?.name || p.tempName,
            account: p.user?.bniAccountNumber,
            amountShare: parseFloat(p.amountShare),
            paymentStatus: p.paymentStatus,
            paidAt: p.paidAt,
            scheduledDate: scheduledPayment?.scheduledDate || null,
            paymentType: scheduledPayment?.paymentType || null,
            joinedAt: p.joinedAt,
            isHost: p.userId === bill.hostId,
            breakdown: {
              subtotal: parseFloat(p.subtotal || 0),
              taxAmount: parseFloat(p.taxAmount || 0),
              serviceAmount: parseFloat(p.serviceAmount || 0),
              discountAmount: parseFloat(p.discountAmount || 0),
              totalAmount: parseFloat(p.amountShare)
            }
          };
        }),
        yourShare: userParticipant ? parseFloat(userParticipant.amountShare) : 0,
        yourStatus: userParticipant?.paymentStatus || "not_participant",
        paymentSummary: {
          totalParticipants: bill.billParticipants.length,
          completedCount: completedParticipants.length,
          pendingCount: pendingParticipants.length,
          scheduledCount: scheduledParticipants.length,
          failedCount: failedParticipants.length,
          totalPaid,
          totalPending,
          totalScheduled,
          totalFailed,
          remainingAmount,
          completionPercentage: Math.round((totalPaid / parseFloat(bill.totalAmount)) * 100),
        },
        paymentHistory: {
          completed: bill.payments.map(payment => ({
            paymentId: payment.paymentId,
            transactionId: payment.transactionId,
            amount: parseFloat(payment.amount),
            payerName: payment.user?.name,
            paidAt: payment.paidAt,
            paymentMethod: payment.paymentMethod
          })),

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
      }
    });
  } catch (error) {
    console.error(`💥 [ERROR] Get master bill error for ${req.params.identifier}:`, error);
    res.status(500).json({ error: "Failed to get master bill details" });
  }
});

// 5. Get Bill Details (Smart Route - handles both billId and billCode) - LEGACY
router.get("/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;
    
    console.log(`🔍 [BILL ACCESS] User ${userId} accessing bill: ${identifier}`);

    // Try to find by billId first, then by billCode
    console.log(`📋 [SEARCH] Trying billId: ${identifier}`);
    let bill = await prisma.bill.findUnique({
      where: { billId: identifier },
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
          where: { status: { startsWith: "completed" } },
        },
      },
    });

    // If not found by billId, try billCode
    if (!bill) {
      bill = await prisma.bill.findUnique({
        where: { billCode: identifier },
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
            where: { status: { startsWith: "completed" } },
          },
          scheduledPayments: {
            where: { status: "scheduled" },
          },
        },
      });
    }

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const userParticipant = bill.billParticipants.find(p => p.userId === userId);
    const isHost = bill.hostId === userId;

    // Calculate payment summary based on billParticipants data
    const completedParticipants = bill.billParticipants.filter(p => p.paymentStatus.startsWith("completed"));
    const pendingParticipants = bill.billParticipants.filter(p => p.paymentStatus === "pending");
    
    // Calculate payment summary
    const totalPaid = completedParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0);
    const totalPending = pendingParticipants.reduce((sum, p) => sum + parseFloat(p.amountShare), 0);
    const remainingAmount = parseFloat(bill.totalAmount) - totalPaid;
    
    res.json({
      success: true,
      viewType: "legacy", // Indicates this is legacy endpoint
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
      fees: {
        taxPct: parseFloat(bill.taxPct || 0),
        servicePct: parseFloat(bill.servicePct || 0),
        discountPct: parseFloat(bill.discountPct || 0),
        discountNominal: parseFloat(bill.discountNominal || 0),
        subTotal: parseFloat(bill.subTotal || 0),
        taxAmount: parseFloat(bill.taxAmount || 0),
        serviceAmount: parseFloat(bill.serviceAmount || 0),
        discountAmount: parseFloat(bill.discountAmount || 0)
      },
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
        isSharing: item.isSharing,
        ocrConfidence: item.ocrConfidence,
        isVerified: item.isVerified,
        assignments: item.itemAssignments.map(assignment => ({
          participantName: assignment.participant.user?.name || assignment.participant.tempName,
          quantity: assignment.quantityAssigned,
          amount: parseFloat(assignment.amountAssigned),
          // For shared items, this represents the participant's share
          isSharedPortion: item.isSharing
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
        breakdown: {
          subtotal: parseFloat(p.subtotal || 0),
          taxAmount: parseFloat(p.taxAmount || 0),
          serviceAmount: parseFloat(p.serviceAmount || 0),
          discountAmount: parseFloat(p.discountAmount || 0),
          totalAmount: parseFloat(p.amountShare)
        }
      })),
      yourShare: userParticipant ? parseFloat(userParticipant.amountShare) : 0,
      yourStatus: userParticipant?.paymentStatus || "not_participant",
      paymentSummary: {
        totalPaid,
        totalPending,
        remainingAmount,
        completedPayments: bill.payments.length,
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
    console.error(`💥 [ERROR] Get bill error for ${req.params.identifier}:`, error);
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
      return res.status(400).json({ error: "Only bill host can assign items" });
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
      return res.status(400).json({ error: "Only bill host can add participants" });
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

          // Determine payment status
          const paymentStatus = (friendId === userId) ? "completed" : "pending";

          // Calculate total amount for this participant
          const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

          // Create participant
          const participant = await tx.billParticipant.create({
            data: {
              billId,
              userId: friendId,
              amountShare: totalAmount,
              paymentStatus,
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
          const notificationMessage = (friendId === userId)
            ? `Your payment for '${bill.billName}' has been marked as completed.`
            :isFriend 
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
            paymentStatus,
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
      return res.status(400).json({ error: "Only bill host can add participants" });
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

    // Check if user is the host
    const isHost = targetUser.userId === userId;

    // Check if user is friend of host
    const isFriend = !isHost && await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: bill.hostId, friendUserId: targetUser.userId },
          { userId: targetUser.userId, friendUserId: bill.hostId },
        ],
        status: "active",
      },
    });

    // Fetch prices of all items and calculate total amount
    const itemsWithPrice = [];
    for (const item of items) {
      const foundItem = await prisma.billItem.findFirst({
        where: { itemId: item.itemId, billId: billId },
        select: { price: true }
      });
      if (!foundItem) {
        return res.status(404).json({ error: `Item with ID ${item.itemId} not found in this bill.` });
      }
      itemsWithPrice.push({
        ...item,
        price: foundItem.price
      });
    }

    const totalAmount = itemsWithPrice.reduce((sum, item) => sum + parseFloat(item.price) * (item.quantity || 1), 0);

    const participantType = isHost ? "host" : (isFriend ? "friend" : "guest");

    // Determine payment status: if the target user is the host, their payment is completed.
    const paymentStatus = (targetUser.userId === userId) ? "completed" : "pending";

    const result = await prisma.$transaction(async (tx) => {
      // Create participant
      const participant = await tx.billParticipant.create({
        data: {
          billId,
          userId: targetUser.userId,
          amountShare: totalAmount,
          paymentStatus,
        },
      });

      // Only create payment record for host (completed)
      if (isHost) {
        await tx.payment.create({
          data: {
            billId,
            userId: targetUser.userId,
            amount: totalAmount,
            paymentMethod: "host_advance",
            paymentType: "instant",
            status: "completed",
            transactionId: `HOST_${Date.now()}`,
            bniReferenceNumber: `HOST_${bill.billCode}`,
            paidAt: new Date(),
          },
        });
      }

      // Create item assignments
      if (items && items.length > 0) {
        await tx.itemAssignment.createMany({
          data: itemsWithPrice.map(item => ({
            billId,
            itemId: item.itemId,
            participantId: participant.participantId,
            quantityAssigned: item.quantity,
            amountAssigned: parseFloat(item.price) * (item.quantity || 1),
          })),
        });
      }

      // Create notification
      let notificationMessage;
      let notificationTitle;
      if (targetUser.userId === userId) {
        // Special message for the host being added
        notificationMessage = `Your payment for '${bill.billName}' has been marked as completed.`;
        notificationTitle = "Payment Completed";
      } else if (isFriend) {
        notificationMessage = `${bill.host.name} assigned you items in '${bill.billName}' - Total: Rp ${totalAmount.toLocaleString()}`;
        notificationTitle = "Bill Assignment";
      } else {
        notificationMessage = `${bill.host.name} added you as guest to '${bill.billName}' - Total: Rp ${totalAmount.toLocaleString()}. Use bill code: ${bill.billCode}`;
        notificationTitle = "Guest Bill Assignment";
      }

      await tx.notification.create({
        data: {
          userId: targetUser.userId,
          billId,
          type: "bill_assignment",
          title: notificationTitle,
          message: notificationMessage,
        },
      });

      // Create activity log
      await tx.activityLog.create({
        data: {
          userId: targetUser.userId,
          billId,
          activityType: "bill_assigned",
          title: (targetUser.userId === userId) ? "Payment Completed" : (isFriend ? "Bill Assigned" : "Added as Guest"),
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

// 7.3 Re-assign item based on ID
router.put("/:billId/participant/:participantId/assign-items", authenticateToken, async (req, res) => {
  try {
    const { billId, participantId } = req.params;
    const { items } = req.body; // [{ itemId, quantity }] - 'amount' is derived from DB
    const prisma = req.prisma;
    const userId = req.user.userId; // This is the host's userId

    // 1. Verify bill ownership. Only the host can re-assign items.
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { hostId: true, billName: true }, // Select billName for notification
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.hostId !== userId) {
      return res.status(400).json({ error: "Only the bill host can re-assign items for this bill" });
    }

    // 2. Verify the participant exists and belongs to this bill.
    const targetParticipant = await prisma.billParticipant.findUnique({
      where: { participantId },
      include: { user: { select: { userId: true, name: true, bniAccountNumber: true } } }, // Include user for response/notifications
    });

    if (!targetParticipant || targetParticipant.billId !== billId) {
      return res.status(404).json({ error: "Participant not found or does not belong to this bill" });
    }

    // 3. Fetch prices of all items and calculate total amount.
    const itemsWithPrice = [];
    let totalAmount = 0;
    if (items && items.length > 0) {
      for (const item of items) {
        // Ensure itemId exists and belongs to this bill
        const foundItem = await prisma.billItem.findFirst({
          where: { itemId: item.itemId, billId: billId },
          select: { price: true, itemName: true } // Select itemName for clearer error messages
        });
        if (!foundItem) {
          return res.status(404).json({ error: `Item with ID ${item.itemId} not found in this bill.` });
        }
        const itemCalculatedAmount = parseFloat(foundItem.price) * (item.quantity || 1);
        itemsWithPrice.push({
          ...item,
          price: foundItem.price,
          calculatedAmount: itemCalculatedAmount // Store calculated amount for assignment creation
        });
        totalAmount += itemCalculatedAmount;
      }
    }

    // 4. Determine payment status: if the target participant is the host, their payment is completed.
    const isHostParticipant = targetParticipant.userId === userId;
    const paymentStatus = isHostParticipant ? "completed" : "pending";

    // 5. Perform all updates in a single, atomic transaction.
    await prisma.$transaction(async (tx) => {
      // Delete existing item assignments for this participant on this bill.
      await tx.itemAssignment.deleteMany({
        where: { participantId: targetParticipant.participantId },
      });

      // Create new item assignments if items are provided.
      if (itemsWithPrice.length > 0) {
        await tx.itemAssignment.createMany({
          data: itemsWithPrice.map(item => ({
            billId,
            itemId: item.itemId,
            participantId: targetParticipant.participantId,
            quantityAssigned: item.quantity,
            amountAssigned: item.calculatedAmount, // Use the pre-calculated amount
          })),
        });
      }

      // Update the participant's total amount share and payment status.
      await tx.billParticipant.update({
        where: { participantId: targetParticipant.participantId },
        data: {
          amountShare: totalAmount,
          paymentStatus: paymentStatus, // Update status based on host check
        },
      });

      // 6. Create notification for the participant whose items were re-assigned.
      let notificationMessage;
      let notificationTitle;
      
      // Determine if the participant is a friend of the host (if not the host)
      const isFriend = !isHostParticipant && await tx.friend.findFirst({
        where: {
          OR: [
            { userId: bill.hostId, friendUserId: targetParticipant.userId },
            { userId: targetParticipant.userId, friendUserId: bill.hostId },
          ],
          status: "active",
        },
      });

      if (isHostParticipant) {
        notificationMessage = `Your payment for '${bill.billName}' has been updated and marked as completed. New share: Rp ${totalAmount.toLocaleString()}`;
        notificationTitle = "Payment Updated & Completed";
      } else if (isFriend) {
        notificationMessage = `${bill.hostId === userId ? 'You' : bill.host.name} re-assigned your items in '${bill.billName}' - New Total: Rp ${totalAmount.toLocaleString()}`;
        notificationTitle = "Bill Item Re-assignment";
      } else { // Guest
        notificationMessage = `${bill.hostId === userId ? 'You' : bill.host.name} re-assigned your guest items in '${bill.billName}' - New Total: Rp ${totalAmount.toLocaleString()}.`;
        notificationTitle = "Guest Bill Item Re-assignment";
      }

      await tx.notification.create({
        data: {
          userId: targetParticipant.userId,
          billId,
          type: "bill_assignment_update", // New type for re-assignment
          title: notificationTitle,
          message: notificationMessage,
        },
      });

      // 7. Create activity log for the host.
      await tx.activityLog.create({
        data: {
          userId, // Host's userId
          billId,
          activityType: "participant_reassigned_items",
          title: "Participant Items Re-assigned",
          description: `You re-assigned items to ${targetParticipant.user?.name || 'a participant'} in '${bill.billName}'.`,
        },
      });
    });

    // 8. Fetch the updated participant details to return in the response.
    const updatedParticipant = await prisma.billParticipant.findUnique({
      where: { participantId },
      include: {
        user: { select: { userId: true, name: true, bniAccountNumber: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: "Participant items re-assigned successfully",
      participant: {
        participantId: updatedParticipant.participantId,
        userId: updatedParticipant.userId,
        name: updatedParticipant.user?.name || targetParticipant.tempName, // Use tempName if user not found
        account: updatedParticipant.user?.bniAccountNumber,
        amountShare: parseFloat(updatedParticipant.amountShare),
        paymentStatus: updatedParticipant.paymentStatus,
        itemCount: items ? items.length : 0,
      },
      totalAmountReassigned: totalAmount,
    });
  } catch (error) {
    console.error("Re-assign participant items error:", error);
    res.status(500).json({
      error: "Failed to re-assign participant items",
      details: error.message,
    });
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
      return res.status(400).json({ error: "Only bill host can invite friends" });
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
        isSharing: item.isSharing,
        // For shared items, this is your proportional share
        displayQuantity: item.isSharing ? assignment.quantityAssigned : assignment.quantityAssigned,
        displayAmount: parseFloat(assignment.amountAssigned)
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
        isSharing: item.isSharing,
        assignments: item.itemAssignments.map(assignment => ({
          participantName: assignment.participant.user?.name || assignment.participant.tempName,
          quantity: assignment.quantityAssigned,
          amount: assignment.amountAssigned,
          // For shared items, this represents the participant's share
          isSharedPortion: item.isSharing
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
      return res.status(400).json({ 
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
      return res.status(400).json({ 
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
      return res.status(400).json({ 
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



// 10.1. Get My Payment History
router.get("/my-payments", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;
    const { status = "all", limit = 20, offset = 0 } = req.query;

    let whereCondition = { payerId: userId };
    if (status !== "all") {
      whereCondition.status = status;
    }

    const payments = await prisma.payment.findMany({
      where: whereCondition,
      include: {
        bill: {
          select: {
            billName: true,
            billCode: true,
            host: {
              select: { name: true }
            }
          }
        },
        payer: {
          select: { name: true, bniAccountNumber: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const totalPayments = await prisma.payment.count({
      where: whereCondition
    });

    res.json({
      success: true,
      payments: payments.map(payment => ({
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        bniReferenceNumber: payment.bniReferenceNumber,
        amount: parseFloat(payment.amount),
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        bill: {
          billName: payment.bill.billName,
          billCode: payment.bill.billCode,
          hostName: payment.bill.host.name
        },
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        fees: {
          adminFee: parseFloat(payment.adminFee || 0),
          transferFee: parseFloat(payment.transferFee || 0)
        }
      })),
      pagination: {
        total: totalPayments,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < totalPayments
      }
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({ error: "Failed to get payment history" });
  }
});

// 11. Get User Bills
router.get("/", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;
    const { type = "all" } = req.query;

    let whereCondition;
    if (type === "assigned") {
      whereCondition = {
        AND: [
          { hostId: { not: userId } },
          { billParticipants: { some: { userId } } }
        ]
      };
    } else if (type === "hosted") {
      whereCondition = { hostId: userId };
    } else {
      whereCondition = {
        OR: [
          { hostId: userId },
          { billParticipants: { some: { userId } } },
        ],
      };
    }

    const bills = await prisma.bill.findMany({
      where: whereCondition,
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
      bills: bills.map(bill => {
        const participant = bill.billParticipants[0];
        const isHost = bill.hostId === userId;
        
        const now = new Date();
        const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
        const maxPaymentDate = new Date(bill.maxPaymentDate);
        const paymentDeadline = bill.allowScheduledPayment ? maxPaymentDate : deadline24h;
        const isExpired = now > paymentDeadline;
        
        return {
          billId: bill.billId,
          billCode: bill.billCode,
          billName: bill.billName,
          totalAmount: parseFloat(bill.totalAmount),
          status: bill.status,
          category: bill.category?.categoryName,
          isHost,
          hostName: bill.host.name,
          hostAccount: isHost ? null : bill.host.bniAccountNumber,
          yourShare: participant ? parseFloat(participant.amountShare) : 0,
          paymentStatus: participant?.paymentStatus || "not_participant",
          paymentDeadline,
          isExpired,
          canSchedule: bill.allowScheduledPayment,
          createdAt: bill.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("Get bills error:", error);
    res.status(500).json({ error: "Failed to get bills" });
  }
});



// 12. Edit bill
router.put("/:billId", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const {
      billName,
      categoryId,
      groupId,
      totalAmount,
      items, // [{ itemName, price, quantity, category, isVerified }]
      receiptImageUrl,
      maxPaymentDate,
      allowScheduledPayment,
      splitMethod,
      currency
    } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // 1. Verify bill ownership. Only the host can update a bill.
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { hostId: true },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.hostId !== userId) {
      return res.status(400).json({ error: "Only the bill host can update this bill" });
    }
    
    // 2. Perform all updates in an atomic transaction to ensure data consistency.
    await prisma.$transaction(async (tx) => {
      // First, delete all dependent records for a clean update.
      await tx.itemAssignment.deleteMany({
        where: { billId },
      });
      await tx.billItem.deleteMany({
        where: { billId },
      });
      
      // Update the main bill record.
      const updateBillData = {};
      if (billName !== undefined) updateBillData.billName = billName;
      if (categoryId !== undefined) updateBillData.categoryId = categoryId;
      if (groupId !== undefined) updateBillData.groupId = groupId;
      if (receiptImageUrl !== undefined) updateBillData.receiptImageUrl = receiptImageUrl;
      if (maxPaymentDate !== undefined) updateBillData.maxPaymentDate = maxPaymentDate ? new Date(maxPaymentDate) : null;
      if (allowScheduledPayment !== undefined) updateBillData.allowScheduledPayment = allowScheduledPayment;
      if (splitMethod !== undefined) updateBillData.splitMethod = splitMethod;
      if (currency !== undefined) updateBillData.currency = currency;
      
      // Calculate total amount from the new item list.
      const newTotalAmount = items.reduce((sum, item) => sum + parseFloat(item.price) * (item.quantity || 1), 0);
      updateBillData.totalAmount = newTotalAmount;

      await tx.bill.update({
        where: { billId },
        data: updateBillData,
      });

      // Recreate all bill items from the new input.
      if (items && items.length > 0) {
        await tx.billItem.createMany({
          data: items.map(item => ({
            billId,
            itemName: item.itemName,
            price: parseFloat(item.price),
            quantity: item.quantity || 1,
            category: item.category || "food_item",
            ocrConfidence: item.ocrConfidence || null,
            isVerified: item.isVerified || true,
          })),
        });
      }
      
      // OPTIONAL: Update a participant's amount share if needed based on new items.
      // This is not in the request but may be necessary for logical consistency.
      // E.g., if split method is "equal" and new items change the total.
      // This part would be custom to your application logic.
    });

    // 3. Fetch the completely updated bill to return in the response.
    const completeBill = await prisma.bill.findUnique({
      where: { billId },
      include: {
        billItems: true,
        host: true,
        group: true,
        category: true,
      },
    });

    if (!completeBill) {
        return res.status(404).json({ error: "Bill not found after update" });
    }

    res.status(200).json({
      success: true,
      message: "Bill updated successfully",
      bill: completeBill,
    });

  } catch (error) {
    console.error("Update bill error:", error);
    res.status(500).json({
      error: "Failed to update bill",
      details: error.message,
    });
  }
});

// 12. Delete Bills
router.delete("/:billId", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // 1. Verify bill ownership first. Only the host can delete a bill.
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { hostId: true },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (bill.hostId !== userId) {
      return res.status(400).json({ error: "Only the bill host can delete this bill" });
    }

    // 2. Use a transaction to ensure all related data is deleted atomically.
    // If one deletion fails, all of them will be rolled back.
    await prisma.$transaction(async (tx) => {
      // Delete Bill invites
      await tx.billInvite.deleteMany({
        where: { billId },
      });

      // Delete item assignments
      await tx.itemAssignment.deleteMany({
        where: { billId },
      });

      // Delete bill items
      await tx.billItem.deleteMany({
        where: { billId },
      });
      
      // Delete bill participants
      await tx.billParticipant.deleteMany({
        where: { billId },
      });

      // Delete activity logs related to the bill
      await tx.activityLog.deleteMany({
        where: { billId },
      });

      // Delete the main bill record
      await tx.bill.delete({
        where: { billId },
      });
    });

    res.status(200).json({
      success: true,
      message: "Bill and all related data deleted successfully",
      billId: billId,
    });
  } catch (error) {
    console.error("Delete bill error:", error);
    res.status(500).json({
      error: "Failed to delete bill",
      details: error.message,
    });
  }
});

// 14. Delete bill participant
router.delete("/:billId/participant/:participantId", authenticateToken, async (req, res) => {
  try {
    const { billId, participantId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // 1. Verify bill ownership. Only the host can remove participants.
    const bill = await prisma.bill.findFirst({
      where: { billId, hostId: userId },
      select: { billId: true },
    });

    if (!bill) {
      return res.status(400).json({ error: "Only the bill host can remove participants" });
    }

    // 2. Find the participant to ensure they exist and belong to the specified bill.
    const participant = await prisma.billParticipant.findUnique({
      where: { participantId },
    });

    if (!participant || participant.billId !== billId) {
      return res.status(404).json({ error: "Participant not found or does not belong to this bill" });
    }

    // 3. Use a transaction to delete the participant and their item assignments.
    // It's important to delete assignments first due to foreign key constraints.
    await prisma.$transaction(async (tx) => {
      // Delete item assignments linked to the participant
      await tx.itemAssignment.deleteMany({
        where: { participantId },
      });

      // Delete the bill participant record
      await tx.billParticipant.delete({
        where: { participantId },
      });
      
      // OPTIONAL: Log the activity
      await tx.activityLog.create({
        data: {
          userId,
          billId,
          activityType: "participant_removed",
          title: "Participant Removed",
          description: `You removed a participant from the bill.`,
        },
      });
    });

    res.status(200).json({
      success: true,
      message: "Participant removed successfully",
      participantId,
    });
  } catch (error) {
    console.error("Delete participant error:", error);
    res.status(500).json({
      error: "Failed to remove participant",
      details: error.message,
    });
  }
});

// Comments API - GET Comments
router.get("/:billId/comments", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Verify user is participant in this bill OR is the host
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { hostId: true }
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Bill not found"
      });
    }

    const isHost = bill.hostId === userId;
    const userParticipant = await prisma.billParticipant.findFirst({
      where: { billId, userId }
    });

    if (!userParticipant && !isHost) {
      return res.status(400).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "You are not a participant of this bill"
      });
    }

    // Get all comments for this bill
    const comments = await prisma.billComment.findMany({
      where: { billId },
      include: {
        user: {
          select: {
            name: true,
            profilePhotoUrl: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      success: true,
      data: {
        comments: comments.map(comment => ({
          id: comment.commentId,
          billId: comment.billId,
          userId: comment.userId,
          userName: comment.user.name,
          userAvatar: comment.user.profilePhotoUrl || null,
          message: comment.message,
          createdAt: comment.createdAt.toISOString()
        })),
        totalCount: comments.length
      }
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to get comments"
    });
  }
});

// Comments API - POST Comment
router.post("/:billId/comments", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const { message } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Message cannot be empty"
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Message cannot exceed 500 characters"
      });
    }

    // Verify bill exists and get host info
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: { billId: true, billName: true, hostId: true }
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Bill not found"
      });
    }

    // Verify user is participant in this bill OR is the host
    const isHost = bill.hostId === userId;
    const userParticipant = await prisma.billParticipant.findFirst({
      where: { billId, userId }
    });

    if (!userParticipant && !isHost) {
      return res.status(400).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "You are not a participant of this bill"
      });
    }

    // Check for spam - last comment within 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentComment = await prisma.billComment.findFirst({
      where: {
        billId,
        userId,
        createdAt: { gte: twoMinutesAgo }
      },
      orderBy: { createdAt: "desc" }
    });

    if (recentComment) {
      return res.status(429).json({
        success: false,
        error: "RATE_LIMIT",
        message: "Please wait 2 minutes before posting another comment"
      });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { userId },
      select: {
        name: true,
        profilePhotoUrl: true
      }
    });

    // Create comment
    const comment = await prisma.billComment.create({
      data: {
        billId,
        userId,
        message: message.trim()
      }
    });

    // Send notifications to other participants (including host if not the commenter)
    const otherParticipants = await prisma.billParticipant.findMany({
      where: {
        billId,
        userId: { not: userId }
      },
      include: {
        user: { select: { name: true } }
      }
    });

    // If commenter is not host, also notify the host
    const notificationTargets = [...otherParticipants];
    if (!isHost) {
      const hostUser = await prisma.user.findUnique({
        where: { userId: bill.hostId },
        select: { userId: true, name: true }
      });
      if (hostUser) {
        notificationTargets.push({
          userId: hostUser.userId,
          user: { name: hostUser.name }
        });
      }
    }

    // Create notifications for other participants and host
    if (notificationTargets.length > 0) {
      await prisma.notification.createMany({
        data: notificationTargets.map(target => ({
          userId: target.userId,
          billId,
          type: "bill_comment",
          title: "New Comment",
          message: `${user.name} commented on '${bill.billName}': ${message.trim().substring(0, 50)}${message.length > 50 ? '...' : ''}`,
          metadata: {
            action: "view_bill_master",
            billId: billId,
            billName: bill.billName,
            commenterId: userId,
            commenterName: user.name
          }
        }))
      });
    }

    res.status(201).json({
      success: true,
      data: {
        comment: {
          id: comment.commentId,
          billId: comment.billId,
          userId: comment.userId,
          userName: user.name,
          userAvatar: user.profilePhotoUrl || null,
          message: comment.message,
          createdAt: comment.createdAt.toISOString()
        }
      }
    });
  } catch (error) {
    console.error("Post comment error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Failed to post comment"
    });
  }
});

module.exports = router;