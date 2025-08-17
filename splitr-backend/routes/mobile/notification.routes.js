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
      notifications: notifications.map(notif => ({
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
        title: "Payment Reminder",
        message: "Don't forget to pay Rp 100,000 for 'Lunch at Pizza Hut'",
        isRead: false,
      },
      {
        userId,
        type: "payment_success",
        title: "Payment Successful",
        message: "Your payment of Rp 50,000 has been processed successfully",
        isRead: false,
      },
      {
        userId,
        type: "bill_invitation",
        title: "New Bill Invitation",
        message: "Ahmad invited you to split 'Coffee Meeting'",
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