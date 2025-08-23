const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { NotFoundError, BadRequestError, ValidationError, DatabaseError } = require("../../middleware/error.middleware");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../public/uploads/profiles");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${req.user.userId}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 800 * 800 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files (jpeg, jpg, png, gif) are allowed"));
    }
  },
});

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
router.get("/", authenticateToken, async (req, res, next) => {
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
      throw new NotFoundError("User profile not found");
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
        profilePictureUrl: user.profilePictureUrl,
        profilePictureName: user.profilePictureName,
        createdAt: user.createdAt,
      },
      stats: {
        totalBills,
        totalSpent: parseFloat(totalSpent._sum.amount || 0),
        pendingPayments,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 2. Update Profile
router.put("/", authenticateToken, async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(email && { email }),
        updatedAt: new Date(),
      },
      select: {
        userId: true,
        name: true,
        phone: true,
        email: true,
        profilePictureUrl: true,
        profilePictureName: true,
      },
    });

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// 2.1. Upload Profile Picture
router.put("/upload-picture", authenticateToken, upload.single("profilePicture"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new BadRequestError("No image file provided");
    }

    const prisma = req.prisma;
    const userId = req.user.userId;
    const filename = req.file.filename;
    const profilePictureUrl = `/uploads/profiles/${filename}`;

    // Get current user to delete old profile picture
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { profilePictureName: true },
    });

    // Delete old profile picture if exists
    if (currentUser?.profilePictureName) {
      const oldFilePath = path.join(
        __dirname,
        "../../public/uploads/profiles",
        currentUser.profilePictureName
      );
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update user with new profile picture
    const updatedUser = await prisma.user.update({
      where: { userId },
      data: {
        profilePictureUrl: profilePictureUrl,
        profilePictureName: filename,
        updatedAt: new Date(),
      },
      select: {
        userId: true,
        name: true,
        profilePictureUrl: true,
        profilePictureName: true,
      },
    });

    res.json({
      message: "Profile picture updated successfully",
      profilePictureUrl: updatedUser.profilePictureUrl,
      user: updatedUser,
    });
  } catch (error) {
    // Delete uploaded file if database update fails
    if (req.file) {
      const filePath = path.join(
        __dirname,
        "../../public/uploads/profiles",
        req.file.filename
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
});

// 2.2. Delete Profile Picture
router.delete("/delete-picture", authenticateToken, async (req, res, next) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Get current user to delete profile picture file
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { profilePictureName: true },
    });

    if (!currentUser?.profilePictureName) {
      throw new NotFoundError("No profile picture found");
    }

    // Delete file from filesystem
    const filePath = path.join(
      __dirname,
      "../../public/uploads/profiles",
      currentUser.profilePictureName
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update user to remove profile picture
    await prisma.user.update({
      where: { userId },
      data: {
        profilePictureUrl: null,
        profilePictureName: null,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: "Profile picture deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

// 2.3. Get Profile Picture
router.get("/picture", authenticateToken, async (req, res, next) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { profilePictureName: true },
    });

    if (!user?.profilePictureName) {
      throw new NotFoundError("No profile picture found");
    }

    const filePath = path.join(
      __dirname,
      "../../public/uploads/profiles",
      user.profilePictureName
    );

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("Profile picture file not found");
    }

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

// 3. Change Password
router.put("/change-password", authenticateToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new ValidationError("Current password, new password, and confirm password required");
    }

    if (newPassword !== confirmPassword) {
      throw new ValidationError("New password and confirm password do not match");
    }

    // Verify current password
    const auth = await prisma.userAuth.findUnique({
      where: { userId },
    });

    if (!auth) {
      throw new NotFoundError("User authentication not found");
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      auth.passwordHash
    );
    if (!isValidPassword) {
      throw new ValidationError("Current password is incorrect");
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
    next(error);
  }
});

// 4. Change PIN
router.put("/change-pin", authenticateToken, async (req, res, next) => {
  try {
    const { currentPin, newPin, confirmPin } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!currentPin || !newPin || !confirmPin) {
      throw new ValidationError("Current PIN, new PIN, and confirm PIN required");
    }

    if (newPin !== confirmPin) {
      throw new ValidationError("New PIN and confirm PIN do not match");
    }

    // Verify current PIN
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user || !user.encryptedPinHash) {
      throw new NotFoundError("User PIN not found");
    }

    const isValidPin = await bcrypt.compare(currentPin, user.encryptedPinHash);
    if (!isValidPin) {
      throw new ValidationError("Current PIN is incorrect");
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
    next(error);
  }
});

// 5. Email Notifications Toggle
router.put("/email-notifications-toggle", authenticateToken, async (req, res, next) => {
  try {
    const { emailNotifToggle } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (typeof emailNotifToggle !== "boolean") {
      throw new ValidationError("Invalid input: emailNotifToggle must be a boolean");
    }

    await prisma.user.update({
      where: { userId },
      data: {
        emailNotifToggle,
        updatedAt: new Date(),
      },
      select: {
        userId: true,
        emailNotifToggle,
      },
    });

    res.json({
      message: `Email notifications ${emailNotifToggle ? "enabled" : "disabled"} successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// 6. Get Transaction History
router.get("/history", authenticateToken, async (req, res, next) => {
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
    next(error);
  }
});

// 7. Get Spending Analytics
router.get("/analytics", authenticateToken, async (req, res, next) => {
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
    next(error);
  }
});

module.exports = router;