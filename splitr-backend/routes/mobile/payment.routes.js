const express = require("express");
const bcrypt = require("bcryptjs");
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

// 7. Verify PIN
router.post("/verify-pin", authenticateToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!pin) {
      return res.status(400).json({ error: "PIN required" });
    }

    const user = await prisma.user.findUnique({
      where: { userId },
    });

    const isValidPin = await bcrypt.compare(pin, user.encryptedPinHash);

    res.json({
      valid: isValidPin,
      message: isValidPin ? "PIN verified" : "Invalid PIN",
    });
  } catch (error) {
    console.error("PIN verification error:", error);
    res.status(500).json({ error: "PIN verification failed" });
  }
});

// 8. Process Payment (Instant)
router.post("/pay", authenticateToken, async (req, res) => {
  try {
    const { billId, amount, pin, paymentType = "instant" } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billId || !amount || !pin) {
      return res.status(400).json({ error: "Bill ID, amount, and PIN required" });
    }

    // Verify PIN
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    const isValidPin = await bcrypt.compare(pin, user.encryptedPinHash);
    if (!isValidPin) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    // Get bill and participant info
    const bill = await prisma.bill.findUnique({
      where: { billId },
      include: { host: true },
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // Check BNI account balance
    const account = await prisma.bniDummyAccount.findUnique({
      where: { nomorRekening: user.bniAccountNumber },
    });

    if (!account || parseFloat(account.saldo) < parseFloat(amount)) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Create payment record
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
    
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.payment.create({
        data: {
          billId,
          userId,
          amount: parseFloat(amount),
          paymentMethod: "BNI_TRANSFER",
          paymentType,
          status: "completed",
          transactionId,
          bniReferenceNumber: `BNI${Math.random().toString(36).substr(2, 8)}`,
          fromBranch: user.bniBranchCode,
          toBranch: bill.host.bniBranchCode,
          paidAt: new Date(),
        },
      });

      // Update participant status
      await tx.billParticipant.updateMany({
        where: { billId, userId },
        data: {
          paymentStatus: "paid",
          paidAt: new Date(),
        },
      });

      // Deduct balance (simulate payment)
      await tx.bniDummyAccount.update({
        where: { nomorRekening: user.bniAccountNumber },
        data: {
          saldo: {
            decrement: parseFloat(amount),
          },
        },
      });

      return payment;
    });

    res.json({
      status: "success",
      paymentId: payment.paymentId,
      transactionId: payment.transactionId,
      bniReferenceNumber: payment.bniReferenceNumber,
      amount: payment.amount,
      paidAt: payment.paidAt,
      message: "Payment successful",
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ error: "Payment failed" });
  }
});

// 9. Schedule Payment
router.post("/schedule", authenticateToken, async (req, res) => {
  try {
    const { billId, amount, scheduledDate, pin } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!billId || !amount || !scheduledDate || !pin) {
      return res.status(400).json({ error: "All fields required" });
    }

    // Verify PIN
    const user = await prisma.user.findUnique({ where: { userId } });
    const isValidPin = await bcrypt.compare(pin, user.encryptedPinHash);
    if (!isValidPin) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    // Get bill
    const bill = await prisma.bill.findUnique({
      where: { billId },
      include: { host: true },
    });

    if (!bill || !bill.allowScheduledPayment) {
      return res.status(400).json({ error: "Scheduled payment not allowed" });
    }

    // Create scheduled payment
    const schedule = await prisma.scheduledPayment.create({
      data: {
        billId,
        userId,
        amount: parseFloat(amount),
        scheduledDate: new Date(scheduledDate),
        status: "scheduled",
        pinVerifiedAt: new Date(),
      },
    });

    res.json({
      status: "scheduled",
      scheduleId: schedule.scheduleId,
      scheduledDate: schedule.scheduledDate,
      amount: schedule.amount,
      message: "Payment scheduled successfully",
    });
  } catch (error) {
    console.error("Schedule payment error:", error);
    res.status(500).json({ error: "Failed to schedule payment" });
  }
});

// 10. Get Scheduled Payments
router.get("/scheduled", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const scheduledPayments = await prisma.scheduledPayment.findMany({
      where: { userId },
      include: {
        bill: {
          include: {
            host: true,
            category: true,
          },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    res.json({
      scheduledPayments: scheduledPayments.map(payment => ({
        scheduleId: payment.scheduleId,
        billName: payment.bill.billName,
        hostName: payment.bill.host.name,
        amount: payment.amount,
        status: payment.status,
        scheduledDate: payment.scheduledDate,
        createdAt: payment.createdAt,
        category: payment.bill.category?.categoryName,
      })),
    });
  } catch (error) {
    console.error("Get scheduled payments error:", error);
    res.status(500).json({ error: "Failed to get scheduled payments" });
  }
});

// 11. Get Payment History
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const payments = await prisma.payment.findMany({
      where: { userId },
      include: {
        bill: {
          include: {
            host: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      payments: payments.map(payment => ({
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        billName: payment.bill.billName,
        hostName: payment.bill.host.name,
        amount: payment.amount,
        status: payment.status,
        paymentType: payment.paymentType,
        paidAt: payment.paidAt,
        category: payment.bill.category?.categoryName,
      })),
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({ error: "Failed to get payment history" });
  }
});

module.exports = router;