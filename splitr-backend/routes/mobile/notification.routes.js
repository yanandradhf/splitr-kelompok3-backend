const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "splitr_secret_key";

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const error = new Error('Access token dibutuhkan');
    error.name = 'UnauthorizedError';
    return next(error);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      const error = new Error('Token invalid atau kadaluarsa');
      error.name = err.name === 'TokenExpiredError' ? 'ExpiredTokenError' : 'ForbiddenError';
      return next(error);
    }
    req.user = user;
    next();
  });
};

// 1. Get Notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!userId) {
      const error = new Error("User ID tidak ditemukan di dalam token");
      error.name = "UnauthorizedError";
      return next(error);
    }

    const where = {
      userId,
      ...(unreadOnly === "true" && { isRead: false }),
    };

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          bill: {
            select: {
              billId: true,
              billName: true,
            },
          },
          group: {
            select: {
              groupId: true,
              groupName: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    res.json({
      notifications: notifications.map((notif) => ({
        notificationId: notif.notificationId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        billId: notif.billId,
        billName: notif.bill?.billName,
        groupId: notif.groupId,
        groupName: notif.group?.groupName,
        metadata: notif.metadata,
        isRead: notif.isRead,
        sentAt: notif.sentAt,
        createdAt: notif.createdAt,
      })),
      unreadCount,
      totalCount,
    });
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2002') {
      error.name = "ConflictError";
    } else if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    next(error);
  }
});

// 2. Mark Notification as Read
router.put("/:notificationId/read", authenticateToken, async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!userId) {
      const error = new Error("User ID tidak ditemukan di dalam token");
      error.name = "UnauthorizedError";
      return next(error);
    }

    if (!notificationId) {
      const error = new Error("ID notifikasi dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    await prisma.notification.updateMany({
      where: {
        notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Notifikasi tidak ditemukan";
    } else if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    
    next(error);
  }
});

// 3. Mark All Notifications as Read
router.put("/read-all", authenticateToken, async (req, res, next) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!userId) {
      const error = new Error("User ID tidak ditemukan di dalam token");
      error.name = "UnauthorizedError";
      return next(error);
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: "All notifications marked as read",
      count: result.count,
    });
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
    } else if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    
    next(error);
  }
});

// 4. Handle Group Notification Actions
router.post("/group-action", authenticateToken, async (req, res, next) => {
  try {
    const { notificationId, action } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!userId) {
      const error = new Error("User ID tidak ditemukan di dalam token");
      error.name = "UnauthorizedError";
      return next(error);
    }

    if (!notificationId || !action) {
      const error = new Error("ID notifikasi dan action dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Get notification
    const notification = await prisma.notification.findFirst({
      where: {
        notificationId,
        userId,
        type: "group_invitation",
      },
    });

    if (!notification) {
      const error = new Error("Notifikasi undangan grup tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    if (action === "view_group") {
      // Just mark as read
      await prisma.notification.update({
        where: { notificationId },
        data: { isRead: true },
      });

      return res.json({ 
        message: "Notification marked as read",
        groupId: notification.groupId 
      });
    }

    const error = new Error("Action tidak valid. Hanya 'view_group' yang didukung.");
    error.name = "ValidationError";
    return next(error);
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Notifikasi tidak ditemukan";
    } else if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    
    next(error);
  }
});

// 5. Handle Bill Notification Actions
router.post("/bill-action", authenticateToken, async (req, res, next) => {
  try {
    const { notificationId, action } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!userId) {
      const error = new Error("User ID tidak ditemukan di dalam token");
      error.name = "UnauthorizedError";
      return next(error);
    }

    if (!notificationId || !action) {
      const error = new Error("ID notifikasi dan action dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Get notification
    const notification = await prisma.notification.findFirst({
      where: {
        notificationId,
        userId,
        type: { in: ["bill_invitation", "bill_assignment", "payment_reminder", "bill_expired"] },
      },
      include: {
        bill: {
          select: {
            billId: true,
            billCode: true,
            billName: true,
            status: true,
            maxPaymentDate: true
          }
        }
      }
    });

    if (!notification) {
      const error = new Error("Notifikasi tagihan tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    // Mark notification as read
    await prisma.notification.update({
      where: { notificationId },
      data: { isRead: true },
    });

    switch (action) {
      case "join_bill":
        return res.json({
          message: "Redirect to join bill",
          redirectTo: `/bills/join/${notification.bill.billCode}`,
          billData: {
            billId: notification.bill.billId,
            billCode: notification.bill.billCode,
            billName: notification.bill.billName
          }
        });

      case "view_bill":
        return res.json({
          message: "Redirect to bill detail",
          redirectTo: `/bills/${notification.bill.billId}`,
          billData: {
            billId: notification.bill.billId,
            billName: notification.bill.billName,
            status: notification.bill.status
          }
        });

      case "pay_now":
        return res.json({
          message: "Redirect to payment",
          redirectTo: `/bills/${notification.bill.billId}/pay`,
          billData: {
            billId: notification.bill.billId,
            billName: notification.bill.billName
          }
        });

      default:
        const error = new Error("Action tidak valid");
        error.name = "ValidationError";
        return next(error);
    }
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Notifikasi tidak ditemukan";
    } else if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    
    next(error);
  }
});

// 6. Create Test Notifications (for testing)
router.post("/test", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const testNotifications = [
      {
        userId,
        type: "payment_reminder",
        title: "Tagihan Nungguin Nih",
        message:
          "Rp 80,000 buat 'Bakso Malam Minggu' masih nunggu dibayar, jangan kabur ya",
        isRead: false,
      },
      {
        userId,
        type: "payment_success",
        title: "Dompet Aman",
        message:
          "Kamu baru aja bayar Rp 60,000 untuk 'Ayam Geprek Kantor'. Mantap!",
        isRead: false,
      },
      {
        userId,
        type: "bill_invitation",
        title: "Ada Tagihan Masuk",
        message:
          "Budi ngajak kamu split 'Martabak Malam Jumat'. Siap-siap keluar duit!",
        isRead: false,
      },
      {
        userId,
        type: "payment_failed",
        title: "Oops, Gagal Transfer",
        message:
          "Rp 35,000 buat 'Nasi Goreng Tengah Malam' gagal. Saldo lagi diet ya?",
        isRead: false,
      },
      {
        userId,
        type: "session_completed",
        title: "Akhirnya Lunas Semua",
        message:
          "Sesi 'Ngopi Bareng Anak Kos' resmi kelar. Semua orang udah bayar.",
        isRead: false,
      },
    ];

    await prisma.notification.createMany({
      data: testNotifications,
    });

    res.json({
      message: "Test notifications created",
      count: testNotifications.length,
    });
  } catch (error) {
    console.error("Create test notifications error:", error);
    res.status(500).json({ error: "Failed to create test notifications" });
  }
});

module.exports = router;
