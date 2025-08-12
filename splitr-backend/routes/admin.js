const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Simple session storage (in-memory, reset ketika server restart)
const adminSessions = new Map();

// POST /api/admin/login - Simple Admin Login
router.post("/login", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Find admin user
    const admin = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await prisma.adminUser.update({
      where: { adminId: admin.adminId },
      data: { lastLoginAt: new Date() },
    });

    // Simple session ID
    const sessionId = `admin_session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store session (simple in-memory)
    adminSessions.set(sessionId, {
      adminId: admin.adminId,
      username: admin.username,
      role: admin.role,
      loginAt: new Date(),
    });

    res.json({
      message: "Login successful",
      sessionId,
      admin: {
        adminId: admin.adminId,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/admin/dashboard/summary
router.get("/dashboard/summary", async (req, res) => {
  try {
    const prisma = req.prisma;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Parallel queries for better performance
    const [
      todayPayments,
      todayScheduled,
      allTimeStats,
      todaySuccessful,
      todayFailed,
    ] = await Promise.all([
      // Today's instant payments
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: today, lt: tomorrow },
        },
        _count: { paymentId: true },
        _sum: { amount: true },
      }),

      // Today's scheduled payments
      prisma.scheduledPayment.aggregate({
        where: {
          createdAt: { gte: today, lt: tomorrow },
        },
        _count: { scheduleId: true },
        _sum: { amount: true },
      }),

      // All time statistics
      prisma.payment.aggregate({
        _count: { paymentId: true },
        _sum: { amount: true },
      }),

      // Today's successful transactions
      prisma.payment.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          status: "completed",
        },
      }),

      // Today's failed transactions
      prisma.payment.count({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          status: "failed",
        },
      }),
    ]);

    // Calculate totals
    const todayTransactionCount =
      (todayPayments._count.paymentId || 0) +
      (todayScheduled._count.scheduleId || 0);
    const todayTotalAmount =
      parseFloat(todayPayments._sum.amount || 0) +
      parseFloat(todayScheduled._sum.amount || 0);

    // Calculate success and fail rates
    const successRate =
      todayTransactionCount > 0
        ? (todaySuccessful / todayTransactionCount) * 100
        : 0;
    const failedRate =
      todayTransactionCount > 0
        ? (todayFailed / todayTransactionCount) * 100
        : 0;

    res.json({
      today: {
        transaction_count: todayTransactionCount,
        amount_split: todayTotalAmount,
        success_rate: parseFloat(successRate.toFixed(1)),
        failed_rate: parseFloat(failedRate.toFixed(1)),
      },
      all_time: {
        total_transactions: allTimeStats._count.paymentId || 0,
        total_amount: parseFloat(allTimeStats._sum.amount || 0),
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const prisma = req.prisma;

    // Get pagination parameters from the query string
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
    const skip = (page - 1) * limit;
    const search = req.query.search || "all"; // Default to 'all'
    const status = req.query.status;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (search && search !== "all") {
      whereClause.OR = [
        {
          user: {
            name: { contains: search, mode: "insensitive" },
          },

        },
      ];
    }
    // Parallel queries to get paginated data and the total count
    const [payments, totalCount] = await Promise.all([
      // Fetch a paginated list of payments
      prisma.payment.findMany({
        skip,
        take: limit,
        // You can add 'orderBy' and 'select' to control the data returned
        orderBy: {
          createdAt: "desc",
        },
      }),

      // Get the total number of payments for pagination metadata
      prisma.payment.count(),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Send the paginated data along with metadata
    res.json({
      data: payments,
      meta: {
        total_items: totalCount,
        current_page: page,
        items_per_page: limit,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("API transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    const prisma = req.prisma;
    const transactionId = req.params.id;

    const transaction = await prisma.payment.findUnique({
      where: {
        paymentId: transactionId,
      },
      include: {
        user: true, // Optionally include the related user data
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(transaction);
  } catch (error) {
    console.error("Fetch transaction by ID error:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});
// ... ALL OTHER ROUTES ...

// IMPORTANT: Export router at the end
module.exports = router;