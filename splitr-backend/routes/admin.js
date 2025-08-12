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

router.get("/dashboard/charts/transactions", async (req, res) => {
  try {
    const prisma = req.prisma;
    const period = parseInt(req.query.period,10);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeksData = [];

    // Parallel queries for better performance
    for (let i = 0; i < period/7; i++) {
      const weekEndDate = new Date(today);
      weekEndDate.setDate(weekEndDate.getDate() - 7 * i);
      const weekStartDate = new Date(weekEndDate);
      weekStartDate.setDate(weekStartDate.getDate() - 7);

      const [weeklyPayments, weeklyScheduled, weeklySuccessful, weeklyFailed] =
        await Promise.all([
          // Today's instant payments
          prisma.payment.aggregate({
            where: {
              createdAt: { gte: weekStartDate, lt: weekEndDate },
            },
            _count: { paymentId: true },
            _sum: { amount: true },
          }),

          // Today's scheduled payments
          prisma.scheduledPayment.aggregate({
            where: {
              createdAt: { gte: weekStartDate, lt: weekEndDate },
            },
            _count: { scheduleId: true },
            _sum: { amount: true },
          }),

          // Today's successful transactions
          prisma.payment.count({
            where: {
              createdAt: { gte: weekStartDate, lt: weekEndDate },
              status: "completed",
            },
          }),

          // Today's failed transactions
          prisma.payment.count({
            where: {
              createdAt: { gte: weekStartDate, lt: weekEndDate },
              status: "failed",
            },
          }),
        ]);

      // Calculate totals
      const weeklyTransactionCount =
        (weeklyPayments._count.paymentId || 0) +
        (weeklyScheduled._count.scheduleId || 0);
      const weeklyTotalAmount =
        parseFloat(weeklyPayments._sum.amount || 0) +
        parseFloat(weeklyScheduled._sum.amount || 0);

      // Calculate success and fail rates
      const successRate =
        weeklyTransactionCount > 0
          ? (weeklySuccessful / weeklyTransactionCount) * 100
          : 0;
      const failedRate =
        weeklyTransactionCount > 0
          ? (weeklyFailed / weeklyTransactionCount) * 100
          : 0;

      weeksData.push({
        week: i+1, // To label weeks from 1 to 4
        transaction_count: weeklyTransactionCount,
        amount_split: weeklyTotalAmount,
        success_rate: parseFloat(successRate.toFixed(1)),
        failed_rate: parseFloat(failedRate.toFixed(1)),
      });
    }

    res.json({
      weekly_data: weeksData,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.get("/dashboard/charts/payment-methods", async (req, res) => {
  try {
    const prisma = req.prisma;

    // Group payments by payment method and calculate count and sum of amounts
    const paymentMethodSummary = await prisma.payment.groupBy({
      by: ["paymentMethod"], // Grouping payments by the 'paymentMethod' field
      _count: {
        paymentId: true, // Count the total number of payments for each method
      },
      _sum: {
        amount: true, // Sum the total amount for each payment method
      },
      orderBy: {
        paymentMethod: "asc", // Optional: Order the results alphabetically by payment method
      },
    });

    res.json(paymentMethodSummary);
  } catch (error) {
    console.error("Payment method summary error:", error);
    res.status(500).json({ error: "Failed to fetch payment method summary" });
  }
});

router.get("/dashboard/charts/categories", async (req, res) => {
  try {
    const prisma = req.prisma;

    // Group payments by payment method and calculate count and sum of amounts
    const billCategorySummary = await prisma.bill.groupBy({
      by: ["categoryId"], // Grouping payments by the 'paymentMethod' field
      _count: {
        billId: true, // Count the total number of payments for each method
      },
      _sum: {
        totalAmount: true, // Sum the total amount for each payment method
      },
    });
    const categoryIds = billCategorySummary.map(group => group.categoryId).filter(id => id !== null);
    const categories = await prisma.billCategory.findMany({
      where: {
        categoryId: {
          in: categoryIds,
        },
      },
      select: {
        categoryId: true,
        categoryName: true,
      },
    });

    // 3. Map the names to the grouped data
    const categoryNameMap = new Map(categories.map(cat => [cat.categoryId, cat.categoryName]));
    const billsWithCategoryNames = billCategorySummary.map(group => ({
      categoryId: group.categoryId,
      categoryName: categoryNameMap.get(group.categoryId) || "Uncategorized",
      billCount: group._count.billId,
      totalAmount: group._sum.totalAmount,
    }));

    res.json(billsWithCategoryNames);
  } catch (error) {
    console.error("Payment method summary error:", error);
    res.status(500).json({ error: "Failed to fetch payment method summary" });
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
      whereClause.category = [
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

router.get("/analytics/geographic", async (req, res) => {
  try {
    const prisma = req.prisma;

    const branchSummary = await prisma.payment.groupBy({
      by: [ "toBranch"], // Grouping by both fields
      _count: {
        paymentId: true, // Count payments in each group
      },
      _sum: {
        amount: true, // Sum the amount for payments in each group
      },
      // You can also add orderBy if you want to sort the groups
      orderBy: [
        {
          toBranch: "asc",
        },
      ],
    });
    res.json(branchSummary);
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});
// ... ALL OTHER ROUTES ...

// IMPORTANT: Export router at the end
module.exports = router;