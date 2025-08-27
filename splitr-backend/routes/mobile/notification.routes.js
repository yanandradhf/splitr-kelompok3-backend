const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "splitr_secret_key";

// Import secure authentication middleware
const { authenticateSecure } = require('../../middleware/auth.middleware');

// Use secure authentication for all notification routes
const authenticateToken = authenticateSecure;

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

// 4. Handle Group Notification Actions
router.post("/group-action", authenticateToken, async (req, res) => {
  try {
    const { notificationId, action } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!notificationId || !action) {
      return res.status(400).json({ error: "Notification ID and action required" });
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
      return res.status(404).json({ error: "Group invitation notification not found" });
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

    return res.status(400).json({ error: "Invalid action. Only 'view_group' is supported." });
  } catch (error) {
    console.error("Group notification action error:", error);
    res.status(500).json({ error: "Failed to handle group action" });
  }
});

// 5. Handle Bill Notification Actions
router.post("/bill-action", authenticateToken, async (req, res) => {
  try {
    const { notificationId, action } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!notificationId || !action) {
      return res.status(400).json({ error: "Notification ID and action required" });
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
      return res.status(404).json({ error: "Bill notification not found" });
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
        return res.status(400).json({ 
          error: "Invalid action", 
          validActions: ["join_bill", "view_bill", "pay_now"]
        });
    }
  } catch (error) {
    console.error("Bill notification action error:", error);
    res.status(500).json({ error: "Failed to handle bill action" });
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
