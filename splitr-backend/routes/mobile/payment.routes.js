const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
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

// 1. Get Payment Info for Bill
router.get("/info/:billId", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Get bill and participant info
    const bill = await prisma.bill.findUnique({
      where: { billId },
      include: {
        host: { select: { name: true, bniAccountNumber: true } },
        billParticipants: {
          where: { userId },
          select: { amountShare: true, paymentStatus: true }
        }
      }
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const participant = bill.billParticipants[0];
    if (!participant) {
      return res.status(403).json({ error: "You are not a participant in this bill" });
    }

    // Calculate payment deadline
    const now = new Date();
    const maxPaymentDate = new Date(bill.maxPaymentDate);
    const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
    
    let paymentDeadline;
    let canSchedule = false;
    
    if (bill.allowScheduledPayment) {
      paymentDeadline = maxPaymentDate;
      canSchedule = true;
    } else {
      paymentDeadline = deadline24h;
      canSchedule = false;
    }

    const isExpired = now > paymentDeadline;

    res.json({
      success: true,
      paymentInfo: {
        billId: bill.billId,
        billName: bill.billName,
        yourAmount: parseFloat(participant.amountShare),
        paymentStatus: participant.paymentStatus,
        hostName: bill.host.name,
        hostAccount: bill.host.bniAccountNumber,
        paymentDeadline,
        canSchedule,
        allowScheduledPayment: bill.allowScheduledPayment,
        isExpired,
        timeRemaining: isExpired ? 0 : Math.max(0, paymentDeadline.getTime() - now.getTime())
      }
    });
  } catch (error) {
    console.error("Get payment info error:", error);
    res.status(500).json({ error: "Failed to get payment info" });
  }
});

// 2. Create Payment (Instant or Scheduled)
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const {
      billId,
      amount,
      pin,
      scheduledDate // Tambah scheduledDate parameter
    } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billId || !amount || !pin) {
      return res.status(400).json({ 
        error: "Bill ID, amount, and PIN required" 
      });
    }

    // Verify PIN (simplified - in production use proper hashing)
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { encryptedPinHash: true, name: true, bniAccountNumber: true }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify PIN using bcrypt
    const isPinValid = await bcrypt.compare(pin, user.encryptedPinHash);
    if (!isPinValid) {
      return res.status(401).json({ 
        error: "Invalid PIN",
        message: "Please check your 6-digit PIN" 
      });
    }

    // Get bill and participant info
    const bill = await prisma.bill.findUnique({
      where: { billId },
      include: {
        host: { select: { name: true, bniAccountNumber: true } },
        billParticipants: {
          where: { userId },
          select: { participantId: true, amountShare: true, paymentStatus: true }
        }
      }
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const participant = bill.billParticipants[0];
    if (!participant) {
      return res.status(403).json({ error: "You are not a participant in this bill" });
    }

    if (participant.paymentStatus === "completed") {
      return res.status(400).json({ error: "Payment already completed" });
    }

    // Check payment deadline
    const now = new Date();
    const deadline24h = new Date(bill.createdAt.getTime() + 24 * 60 * 60 * 1000);
    const maxPaymentDate = new Date(bill.maxPaymentDate);
    
    let paymentDeadline = bill.allowScheduledPayment ? maxPaymentDate : deadline24h;
    
    if (now > paymentDeadline) {
      // Mark as failed if expired
      await prisma.billParticipant.update({
        where: { participantId: participant.participantId },
        data: { paymentStatus: "failed" }
      });
      return res.status(400).json({ 
        error: "Payment deadline expired",
        deadline: paymentDeadline
      });
    }

    // Verify amount matches participant's share
    if (parseFloat(amount) !== parseFloat(participant.amountShare)) {
      return res.status(400).json({ 
        error: "Amount mismatch",
        expected: parseFloat(participant.amountShare),
        provided: parseFloat(amount)
      });
    }

    // Determine payment type and status
    const paymentType = scheduledDate ? "scheduled" : "instant";
    const paymentStatus = scheduledDate ? "completed_scheduled" : "completed";
    
    // Generate transaction ID
    const transactionId = scheduledDate ? 
      `SCH${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}` :
      `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Simulate BNI transfer processing
    const paymentResult = await simulateBNITransfer({
      transactionId,
      amount: parseFloat(amount),
      fromAccount: user.bniAccountNumber,
      toAccount: bill.host.bniAccountNumber,
      scheduledDate
    });

    if (!paymentResult.success) {
      return res.status(400).json({
        error: "Payment failed",
        message: paymentResult.message,
        code: paymentResult.code
      });
    }

    // Create payment record and update participant status
    const result = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          billId,
          userId,
          amount: parseFloat(amount),
          paymentMethod: "BNI_TRANSFER",
          paymentType,
          transactionId,
          status: paymentStatus,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          paidAt: new Date(),
          bniReferenceNumber: paymentResult.bniTransactionId
        }
      });

      // Update participant status
      await tx.billParticipant.update({
        where: { participantId: participant.participantId },
        data: {
          paymentStatus: paymentStatus,
          paidAt: new Date()
        }
      });

      // Create activity log
      await tx.activityLog.create({
        data: {
          userId,
          billId,
          activityType: scheduledDate ? "payment_scheduled" : "payment_completed",
          title: scheduledDate ? "Payment Scheduled" : "Payment Completed",
          description: scheduledDate ? 
            `You scheduled payment of Rp ${amount.toLocaleString()} for '${bill.billName}' on ${new Date(scheduledDate).toLocaleDateString()}` :
            `You paid Rp ${amount.toLocaleString()} for '${bill.billName}'`
        }
      });

      // Create notification for host
      await tx.notification.create({
        data: {
          userId: bill.hostId,
          billId,
          type: "payment_received",
          title: "Payment Received",
          message: `${user.name} paid Rp ${amount.toLocaleString()} for '${bill.billName}'`
        }
      });

      return { payment };
    });

    res.json({
      success: true,
      paymentType,
      message: scheduledDate ? "Payment scheduled successfully!" : "Payment completed successfully!",
      receipt: {
        paymentId: result.payment.paymentId,
        transactionId,
        bniReferenceNumber: paymentResult.bniTransactionId,
        amount: parseFloat(amount),
        status: paymentStatus,
        scheduledDate: null,
        paidAt: result.payment.paidAt,
        bill: {
          billId: bill.billId,
          billName: bill.billName,
          hostName: bill.host.name,
          hostAccount: bill.host.bniAccountNumber
        },
        breakdown: {
          yourShare: parseFloat(amount),
          adminFee: 0,
          transferFee: 0,
          totalPaid: parseFloat(amount)
        }
      },
      nextActions: {
        canViewReceipt: true,
        canViewBill: true,
        canGoHome: true
      }
    });

  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({ 
      error: "Payment processing failed",
      details: error.message 
    });
  }
});



// 4. Get Payment History
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const payments = await prisma.payment.findMany({
      where: { userId },
      include: {
        bill: {
          select: {
            billName: true,
            billCode: true,
            host: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: parseInt(skip),
      take: parseInt(limit)
    });

    const totalPayments = await prisma.payment.count({
      where: { userId }
    });

    res.json({
      success: true,
      payments: payments.map(payment => ({
        paymentId: payment.paymentId,
        billName: payment.bill.billName,
        billCode: payment.bill.billCode,
        hostName: payment.bill.host.name,
        amount: parseFloat(payment.amount),
        paymentMethod: payment.paymentMethod,
        paymentType: payment.paymentType,
        scheduledDate: payment.scheduledDate,
        transactionId: payment.transactionId,
        status: payment.status,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPayments,
        totalPages: Math.ceil(totalPayments / limit)
      }
    });

  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({ error: "Failed to get payment history" });
  }
});

// 5. Get Payment Receipt Detail
router.get("/:paymentId/receipt", authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    const payment = await prisma.payment.findFirst({
      where: { 
        paymentId,
        userId 
      },
      include: {
        bill: {
          select: {
            billId: true,
            billName: true,
            billCode: true,
            category: {
              select: {
                categoryName: true,
                categoryIcon: true
              }
            },
            host: {
              select: { name: true, bniAccountNumber: true }
            },
            billParticipants: {
              where: { userId },
              select: {
                subtotal: true,
                taxAmount: true,
                serviceAmount: true,
                discountAmount: true,
                amountShare: true
              }
            },
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
        },
        user: {
          select: { name: true, bniAccountNumber: true }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment receipt not found" });
    }

    const participant = payment.bill.billParticipants[0];
    const myItems = payment.bill.billItems
      .filter(item => item.itemAssignments.length > 0)
      .map(item => {
        const assignment = item.itemAssignments[0];
        return {
          itemName: item.itemName,
          quantity: assignment.quantityAssigned,
          price: parseFloat(item.price),
          amount: parseFloat(assignment.amountAssigned)
        };
      });

    res.json({
      success: true,
      receipt: {
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        bniReferenceNumber: payment.bniReferenceNumber,
        status: payment.status,
        paymentType: payment.paymentType,
        scheduledDate: payment.scheduledDate,
        amount: parseFloat(payment.amount),
        paidAt: payment.paidAt,
        paymentMethod: payment.paymentMethod,
        
        bill: {
          billId: payment.bill.billId,
          billName: payment.bill.billName,
          billCode: payment.bill.billCode,
          category: payment.bill.category?.categoryName || "Other",
          categoryIcon: payment.bill.category?.categoryIcon || "📦"
        },
        
        payer: {
          name: payment.user.name,
          account: payment.user.bniAccountNumber
        },
        
        recipient: {
          name: payment.bill.host.name,
          account: payment.bill.host.bniAccountNumber
        },
        
        yourItems: myItems,
        
        breakdown: {
          subtotal: parseFloat(participant?.subtotal || 0),
          taxAmount: parseFloat(participant?.taxAmount || 0),
          serviceAmount: parseFloat(participant?.serviceAmount || 0),
          discountAmount: parseFloat(participant?.discountAmount || 0),
          yourShare: parseFloat(participant?.amountShare || payment.amount),
          adminFee: 0,
          transferFee: 0,
          totalPaid: parseFloat(payment.amount)
        },
        
        createdAt: payment.createdAt
      },
      actions: {
        canDownloadReceipt: true,
        canViewBill: true,
        canContact: true
      }
    });

  } catch (error) {
    console.error("Get payment receipt error:", error);
    res.status(500).json({ error: "Failed to get payment receipt" });
  }
});

// 6. Get Payment Status
router.get("/:paymentId/status", authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    const payment = await prisma.payment.findFirst({
      where: { 
        paymentId,
        userId 
      },
      include: {
        bill: {
          select: {
            billName: true,
            billCode: true,
            host: {
              select: { name: true, bniAccountNumber: true }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json({
      success: true,
      payment: {
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        amount: parseFloat(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        paidAt: payment.paidAt,
        bniTransactionId: payment.bniTransactionId,
        bill: {
          billName: payment.bill.billName,
          billCode: payment.bill.billCode,
          hostName: payment.bill.host.name,
          hostAccount: payment.bill.host.bniAccountNumber
        }
      }
    });

  } catch (error) {
    console.error("Get payment status error:", error);
    res.status(500).json({ error: "Failed to get payment status" });
  }
});

// Helper function to simulate BNI transfer (always success for testing)
async function simulateBNITransfer({ transactionId, amount, fromAccount, toAccount, scheduledDate }) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (scheduledDate) {
    // Simulate scheduled payment success
    return {
      success: true,
      bniTransactionId: `SCH${Date.now()}${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      responseCode: "00",
      message: `Payment scheduled for ${scheduledDate}`
    };
  }

  // Always return success for testing
  return {
    success: true,
    bniTransactionId: `BNI${Date.now()}${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    responseCode: "00",
    message: "Transaction successful"
  };
}

module.exports = router;