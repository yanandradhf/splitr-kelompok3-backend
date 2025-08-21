const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const upload  = require("../../middleware/fileUpload.middleware")

const JWT_SECRET = process.env.JWT_SECRET || "splitr_secret_key";

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// 1. Get Profile
router.get("/", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        auth: {
          select: {
            username: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get stats
    const [totalBills, totalSpent, pendingPayments] = await Promise.all([
      prisma.bill.count({
        where: {
          OR: [{ hostId: userId }, { billParticipants: { some: { userId } } }],
        },
      }),
      prisma.payment.aggregate({
        where: { userId, status: "completed" },
        _sum: { amount: true },
      }),
      prisma.payment.count({
        where: { userId, status: "pending" },
      }),
    ]);

    res.json({
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        username: user.auth?.username,
        phone: user.phone,
        bniAccountNumber: user.bniAccountNumber,
        bniBranchCode: user.bniBranchCode,
        isVerified: user.isVerified,
        defaultPaymentMethod: user.defaultPaymentMethod,
        createdAt: user.createdAt,
      },
      stats: {
        totalBills,
        totalSpent: parseFloat(totalSpent._sum.amount || 0),
        pendingPayments,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// 2. Update Profile
router.put("/", authenticateToken, async (req, res) => {
// router.put("/", authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const { name, phone, email, defaultPaymentMethod } = req.body;
    // const { name, phone, email, defaultPaymentMethod, emailNotifEnabled, autoDebitEnabled, twoFactorAuthEnabled } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // if (req.file) {
    //   const fileBuffer = req.file.buffer;
    //   const originalName = req.file.originalname;
    // }

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(email && { email }),
        ...(defaultPaymentMethod && { defaultPaymentMethod }),
        // ...(profilePicture && { profilePicture:fileBuffer }),
        // ...(profilePictureName && { profilePictureName:originalName }),
        // ...(typeof autoDebitEnabled !== 'undefined' && { autoDebitEnabled }),
        // ...(typeof emailNotifEnabled !== 'undefined' && { emailNotifEnabled }),
        // ...(typeof twoFactorAuthEnabled !== 'undefined' && { twoFactorAuthEnabled }),
        updatedAt: new Date(),
      },
      select: {
        userId: true,
        name: true,
        phone: true,
        email: true,
        defaultPaymentMethod: true,
        // profilePicture: true,
        // emailNotifEnabled: true,
        // twoFactorAuthEnabled: true
      },
    });

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// 3. Change Password
router.put("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "Current password, new password, and confirm password required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New password and confirm password do not match" });
    }

    // Verify current password
    const auth = await prisma.userAuth.findUnique({
      where: { userId },
    });

    if (!auth) {
      return res.status(404).json({ error: "User authentication not found" });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, auth.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Update password
    await prisma.userAuth.update({
      where: { userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
      },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// 4. Change PIN
router.put("/change-pin", authenticateToken, async (req, res) => {
  try {
    const { currentPin, newPin, confirmPin } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!currentPin || !newPin || !confirmPin) {
      return res.status(400).json({ error: "Current PIN, new PIN, and confirm PIN required" });
    }

    if (newPin !== confirmPin) {
      return res.status(400).json({ error: "New PIN and confirm PIN do not match" });
    }

    // Verify current PIN
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user || !user.encryptedPinHash) {
      return res.status(404).json({ error: "User PIN not found" });
    }

    const isValidPin = await bcrypt.compare(currentPin, user.encryptedPinHash);
    if (!isValidPin) {
      return res.status(400).json({ error: "Current PIN is incorrect" });
    }

    // Update PIN
    await prisma.user.update({
      where: { userId },
      data: {
        encryptedPinHash: await bcrypt.hash(newPin, 10),
      },
    });

    res.json({ message: "PIN changed successfully" });
  } catch (error) {
    console.error("Change PIN error:", error);
    res.status(500).json({ error: "Failed to change PIN" });
  }
});

// 5. Email Notifications Toogle
router.put(
  "/email-notifications-toogle",
  authenticateToken,
  async (req, res) => {
    try {
      const { emailNotifToogle } = req.body;
      const prisma = req.prisma;
      const userId = req.user.userId;

      // Check if the emailNotifEnabled value is a boolean
      if (typeof emailNotifToogle !== "boolean") {
        return res
          .status(400)
          .json({
            error: "Invalid input: emailNotifEnabled must be a boolean.",
          });
      }

      await prisma.user.update({
        where: { userId },
        data: {
          emailNotifToogle,
          updatedAt: new Date(),
        },
        select: {
          userId: true,
          emailNotifToogle,
        },
      });

      res.json({
        message: `Email notifications enabled ${
          emailNotifToogle ? "enabled" : "disabled"
        } successfully`,
      });
    } catch (error) {
      console.error("Enable email notifications error:", error);
      res.status(500).json({ error: "Failed to enable email notifications" });
    }
  }
);

// 6. Get Transaction History
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const prisma = req.prisma;
    const userId = req.user.userId;

    const where = {
      userId,
      ...(status && { status }),
    };

    const [payments, totalItems] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        include: {
          bill: {
            select: {
              billId: true,
              billName: true,
              host: {
                select: {
                  name: true,
                },
              },
              category: {
                select: {
                  categoryName: true,
                  categoryIcon: true,
                },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      history: payments.map((payment) => ({
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        billId: payment.bill.billId,
        billName: payment.bill.billName,
        hostName: payment.bill.host.name,
        amount: parseFloat(payment.amount),
        status: payment.status,
        paymentType: payment.paymentType,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        category: payment.bill.category?.categoryName || "Other",
        categoryIcon: payment.bill.category?.categoryIcon || "📦",
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems,
      },
    });
  } catch (error) {
    console.error("Get history error:", error);
    res.status(500).json({ error: "Failed to get transaction history" });
  }
});

// 7. Get Spending Analytics
router.get("/analytics", authenticateToken, async (req, res) => {
  try {
    const { period = "30days" } = req.query;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case "7days":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30days":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "thismonth":
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get payments in date range
    const payments = await prisma.payment.findMany({
      where: {
        userId,
        status: "completed",
        paidAt: { gte: startDate },
      },
      include: {
        bill: {
          include: {
            category: true,
          },
        },
      },
    });

    // Calculate stats
    const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const average = payments.length > 0 ? total / payments.length : 0;
    const amounts = payments.map((p) => parseFloat(p.amount));
    const highest = Math.max(...amounts, 0);
    const lowest = Math.min(...amounts, 0);

    // Group by category
    const categoryMap = new Map();
    payments.forEach((payment) => {
      const category = payment.bill.category?.categoryName || "Other";
      const icon = payment.bill.category?.categoryIcon || "📦";
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, icon, amount: 0, count: 0 });
      }
      const cat = categoryMap.get(category);
      cat.amount += parseFloat(payment.amount);
      cat.count += 1;
    });

    const byCategory = Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      percentage: total > 0 ? (cat.amount / total) * 100 : 0,
    }));

    res.json({
      period,
      spending: { total, average, highest, lowest },
      byCategory,
      transactionCount: payments.length,
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

module.exports = router;
