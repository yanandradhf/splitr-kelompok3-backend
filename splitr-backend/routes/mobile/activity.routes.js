const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../../middleware/auth.middleware");

// const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

// Middleware to verify token
// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (!token) {
//     return res.status(401).json({ error: 'Access token required' });
//   }

//   jwt.verify(token, JWT_SECRET, (err, user) => {
//     if (err) return res.status(403).json({ error: 'Invalid token' });
//     req.user = user;
//     next();
//   });
// };

// 22. Get Activities
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;
    const prisma = req.prisma;
    const userId = req.user.userId;

    const where = {
      userId,
      ...(unreadOnly === "true" && { isRead: false }),
    };

    const [activities, totalCount, unreadCount] = await Promise.all([
      prisma.activityLog.findMany({
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
      prisma.activityLog.count({ where }),
      prisma.activityLog.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    ]);

    res.json({
      activities: activities.map((activity) => ({
        activityId: activity.activityId,
        type: activity.activityType,
        title: activity.title,
        description: activity.description,
        billId: activity.billId,
        billName: activity.bill?.billName,
        isRead: activity.isRead,
        createdAt: activity.createdAt,
      })),
      unreadCount,
      totalCount,
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Failed to get activities" });
  }
});

// 23. Mark Activity as Read
router.put("/:activityId/read", authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    await prisma.activityLog.updateMany({
      where: {
        activityId,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    res.json({ message: "Activity marked as read" });
  } catch (error) {
    console.error("Mark activity read error:", error);
    res.status(500).json({ error: "Failed to mark activity as read" });
  }
});

// 24. Mark All Activities as Read
router.put("/read-all", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const result = await prisma.activityLog.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: "All activities marked as read",
      count: result.count,
    });
  } catch (error) {
    console.error("Mark all read error:", error);
    res.status(500).json({ error: "Failed to mark all activities as read" });
  }
});

module.exports = router;
