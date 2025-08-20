const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

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

// 1. Get Notifications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;
    const prisma = req.prisma;
    const userId = req.user.userId;

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
        isRead: notif.isRead,
        sentAt: notif.sentAt,
        createdAt: notif.createdAt,
      })),
      unreadCount,
      totalCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// 2. Mark Notification as Read
router.put("/:notificationId/read", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

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
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// 3. Mark All Notifications as Read
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

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
    console.error("Mark all read error:", error);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// 4. Create Test Notifications (for testing)
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
