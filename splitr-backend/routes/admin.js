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

// GET /api/admin/dashboard/charts/transactions - Transaction Trends Line Chart
router.get("/dashboard/charts/transactions", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let startDate,
      endDate,
      chartData = [];
    const now = new Date();

    switch (period) {
      case "7days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6); // Last 7 days including today
        startDate.setHours(0, 0, 0, 0);

        // Generate 7 days data
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);

          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [payments, scheduled] = await Promise.all([
            prisma.payment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
              },
            }),
            prisma.scheduledPayment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
              },
            }),
          ]);

          chartData.push({
            label: currentDate.toLocaleDateString("en-US", {
              weekday: "short",
            }), // Mon, Tue, etc
            date: currentDate.toISOString().split("T")[0],
            transactions: payments + scheduled,
            payments_count: payments,
            scheduled_count: scheduled,
          });
        }
        break;

      case "30days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29); // Last 30 days including today
        startDate.setHours(0, 0, 0, 0);

        // Generate 30 days data
        for (let i = 0; i < 30; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);

          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [payments, scheduled] = await Promise.all([
            prisma.payment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
              },
            }),
            prisma.scheduledPayment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
              },
            }),
          ]);

          const showLabel = i % 5 === 0 || i === 29; // Show label every 5 days and last day
          chartData.push({
            label: showLabel
              ? currentDate.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "", // 04 Aug
            full_label: currentDate.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            }),
            date: currentDate.toISOString().split("T")[0],
            transactions: payments + scheduled,
            payments_count: payments,
            scheduled_count: scheduled,
          });
        }
        break;

      case "thismonth":
        // From 1st of current month to today
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        const daysInCurrentMonth = now.getDate(); // Only up to today

        for (let i = 1; i <= daysInCurrentMonth; i++) {
          const currentDate = new Date(now.getFullYear(), now.getMonth(), i);
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [payments, scheduled] = await Promise.all([
            prisma.payment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
              },
            }),
            prisma.scheduledPayment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
              },
            }),
          ]);

          const showLabel = i % 5 === 1 || i === daysInCurrentMonth; // Show label every 5 days and last day
          chartData.push({
            label: showLabel
              ? `${i} ${now.toLocaleDateString("en-US", { month: "short" })}`
              : "", // 1 Aug, 6 Aug
            full_label: `${i} ${now.toLocaleDateString("en-US", {
              month: "short",
            })}`,
            date: currentDate.toISOString().split("T")[0],
            transactions: payments + scheduled,
            payments_count: payments,
            scheduled_count: scheduled,
          });
        }
        break;

      case "year":
        // 12 months data
        for (let i = 0; i < 12; i++) {
          const monthStart = new Date(now.getFullYear(), i, 1);
          const monthEnd = new Date(now.getFullYear(), i + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);

          const [payments, scheduled] = await Promise.all([
            prisma.payment.count({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
              },
            }),
            prisma.scheduledPayment.count({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
              },
            }),
          ]);

          chartData.push({
            label: monthStart.toLocaleDateString("en-US", { month: "short" }), // Jan, Feb, etc
            month: i + 1,
            transactions: payments + scheduled,
            payments_count: payments,
            scheduled_count: scheduled,
          });
        }
        break;

      default:
        return res.status(400).json({
          error: "Invalid period. Use: 7days, 30days, thismonth, year",
        });
    }

    res.json({
      period,
      total_points: chartData.length,
      data: chartData,
    });
  } catch (error) {
    console.error("Transaction trends error:", error);
    res.status(500).json({ error: "Failed to fetch transaction trends" });
  }
});

// GET /api/admin/dashboard/charts/categories - Category Distribution Pie Chart
router.get("/dashboard/charts/categories", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let startDate, endDate;
    const now = new Date();

    // Calculate date range based on period
    switch (period) {
      case "7days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "30days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "thismonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        return res.status(400).json({ error: "Invalid period" });
    }

    // Get category data with counts
    const categoryData = await prisma.$queryRaw`
      SELECT 
        bc.category_name,
        bc.category_icon,
        COUNT(DISTINCT b.bill_id)::int as bill_count,
        COUNT(p.payment_id)::int as transaction_count
      FROM bill_categories bc
      LEFT JOIN bills b ON bc.category_id = b.category_id
      LEFT JOIN payments p ON b.bill_id = p.bill_id 
        AND p.created_at >= ${startDate} 
        AND p.created_at <= ${endDate}
        AND p.status = 'completed'
      GROUP BY bc.category_id, bc.category_name, bc.category_icon
      ORDER BY transaction_count DESC
    `;

    // Calculate total and percentages
    const totalTransactions = categoryData.reduce(
      (sum, cat) => sum + cat.transaction_count,
      0
    );

    const chartData = categoryData.map((cat) => ({
      category: cat.category_name,
      icon: cat.category_icon,
      transactions: cat.transaction_count,
      bills: cat.bill_count,
      percentage:
        totalTransactions > 0
          ? parseFloat(
              ((cat.transaction_count / totalTransactions) * 100).toFixed(1)
            )
          : 0,
    }));

    res.json({
      period,
      total_transactions: totalTransactions,
      data: chartData,
    });
  } catch (error) {
    console.error("Categories chart error:", error);
    res.status(500).json({ error: "Failed to fetch categories data" });
  }
});

// GET /api/admin/dashboard/charts/payment-methods - Payment Methods Pie Chart
router.get("/dashboard/charts/payment-methods", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let startDate, endDate;
    const now = new Date();

    // Calculate date range based on period
    switch (period) {
      case "7days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "30days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "thismonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        return res.status(400).json({ error: "Invalid period" });
    }

    const [instantPayments, scheduledPayments] = await Promise.all([
      prisma.payment.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "completed",
        },
      }),
      prisma.scheduledPayment.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "completed",
        },
      }),
    ]);

    const total = instantPayments + scheduledPayments;

    const data = [
      {
        method: "Instant Payment",
        count: instantPayments,
        percentage:
          total > 0
            ? parseFloat(((instantPayments / total) * 100).toFixed(1))
            : 0,
      },
      {
        method: "Scheduled Payment",
        count: scheduledPayments,
        percentage:
          total > 0
            ? parseFloat(((scheduledPayments / total) * 100).toFixed(1))
            : 0,
      },
    ];

    res.json({
      period,
      total_transactions: total,
      data,
    });
  } catch (error) {
    console.error("Payment methods chart error:", error);
    res.status(500).json({ error: "Failed to fetch payment methods data" });
  }
});

// GET /api/admin/dashboard/charts/daily-amount - Daily Amount Split Bar Chart
router.get("/dashboard/charts/daily-amount", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let chartData = [];
    const now = new Date();

    switch (period) {
      case "7days":
        // Last 7 days
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);

          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [paymentAmount, scheduledAmount] = await Promise.all([
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                status: "completed",
              },
              _sum: { amount: true },
            }),
            prisma.scheduledPayment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                status: "completed",
              },
              _sum: { amount: true },
            }),
          ]);

          const totalAmount =
            parseFloat(paymentAmount._sum.amount || 0) +
            parseFloat(scheduledAmount._sum.amount || 0);

          chartData.push({
            label: currentDate.toLocaleDateString("en-US", {
              weekday: "short",
            }), // Mon, Tue, etc
            date: currentDate.toISOString().split("T")[0],
            amount: totalAmount,
            amount_formatted: `Rp ${(totalAmount / 1000000).toFixed(1)}M`, // 38.5M
            instant_amount: parseFloat(paymentAmount._sum.amount || 0),
            scheduled_amount: parseFloat(scheduledAmount._sum.amount || 0),
          });
        }
        break;

      case "30days":
        // Last 30 days
        const start30 = new Date(now);
        start30.setDate(start30.getDate() - 29);
        start30.setHours(0, 0, 0, 0);

        for (let i = 0; i < 30; i++) {
          const currentDate = new Date(start30);
          currentDate.setDate(start30.getDate() + i);

          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [paymentAmount, scheduledAmount] = await Promise.all([
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                status: "completed",
              },
              _sum: { amount: true },
            }),
            prisma.scheduledPayment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                status: "completed",
              },
              _sum: { amount: true },
            }),
          ]);

          const totalAmount =
            parseFloat(paymentAmount._sum.amount || 0) +
            parseFloat(scheduledAmount._sum.amount || 0);
          const showLabel = i % 5 === 0 || i === 29; // Show label every 5 days

          chartData.push({
            label: showLabel
              ? currentDate.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "",
            full_label: currentDate.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            }),
            date: currentDate.toISOString().split("T")[0],
            amount: totalAmount,
            amount_formatted: `Rp ${(totalAmount / 1000000).toFixed(1)}M`,
            instant_amount: parseFloat(paymentAmount._sum.amount || 0),
            scheduled_amount: parseFloat(scheduledAmount._sum.amount || 0),
          });
        }
        break;

      case "thismonth":
        // This month from 1st to today
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const daysInCurrentMonth = now.getDate();

        for (let i = 1; i <= daysInCurrentMonth; i++) {
          const currentDate = new Date(now.getFullYear(), now.getMonth(), i);
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [paymentAmount, scheduledAmount] = await Promise.all([
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                status: "completed",
              },
              _sum: { amount: true },
            }),
            prisma.scheduledPayment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                status: "completed",
              },
              _sum: { amount: true },
            }),
          ]);

          const totalAmount =
            parseFloat(paymentAmount._sum.amount || 0) +
            parseFloat(scheduledAmount._sum.amount || 0);
          const showLabel = i % 5 === 1 || i === daysInCurrentMonth;

          chartData.push({
            label: showLabel
              ? `${i} ${now.toLocaleDateString("en-US", { month: "short" })}`
              : "",
            full_label: `${i} ${now.toLocaleDateString("en-US", {
              month: "short",
            })}`,
            date: currentDate.toISOString().split("T")[0],
            amount: totalAmount,
            amount_formatted: `Rp ${(totalAmount / 1000000).toFixed(1)}M`,
            instant_amount: parseFloat(paymentAmount._sum.amount || 0),
            scheduled_amount: parseFloat(scheduledAmount._sum.amount || 0),
          });
        }
        break;

      case "year":
        // 12 months data
        for (let i = 0; i < 12; i++) {
          const monthStart = new Date(now.getFullYear(), i, 1);
          const monthEnd = new Date(now.getFullYear(), i + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);

          const [paymentAmount, scheduledAmount] = await Promise.all([
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
                status: "completed",
              },
              _sum: { amount: true },
            }),
            prisma.scheduledPayment.aggregate({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
                status: "completed",
              },
              _sum: { amount: true },
            }),
          ]);

          const totalAmount =
            parseFloat(paymentAmount._sum.amount || 0) +
            parseFloat(scheduledAmount._sum.amount || 0);

          chartData.push({
            label: monthStart.toLocaleDateString("en-US", { month: "short" }), // Jan, Feb, etc
            month: i + 1,
            amount: totalAmount,
            amount_formatted: `Rp ${(totalAmount / 1000000000).toFixed(2)}B`, // 1.25B
            instant_amount: parseFloat(paymentAmount._sum.amount || 0),
            scheduled_amount: parseFloat(scheduledAmount._sum.amount || 0),
          });
        }
        break;

      default:
        return res.status(400).json({ error: "Invalid period" });
    }

    // Calculate totals
    const totalAmount = chartData.reduce((sum, item) => sum + item.amount, 0);
    const maxAmount = Math.max(...chartData.map((item) => item.amount));

    res.json({
      period,
      total_amount: totalAmount,
      max_amount: maxAmount,
      total_points: chartData.length,
      data: chartData,
    });
  } catch (error) {
    console.error("Daily amount chart error:", error);
    res.status(500).json({ error: "Failed to fetch daily amount data" });
  }
});

// GET /api/admin/transactions - Enhanced Transaction Table with Filters
router.get("/transactions", async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      status,
      payment_method,
      date_from,
      date_to,
      search,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    // Status filter
    if (status && status !== "all") {
      where.status = status.toLowerCase();
    }

    // Payment method filter
    if (payment_method && payment_method !== "all") {
      if (payment_method.toLowerCase() === "instant") {
        where.paymentType = "instant";
      } else if (payment_method.toLowerCase() === "scheduled") {
        where.paymentType = "scheduled";
      }
    }

    // Date range filter
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Search functionality
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { bniAccountNumber: { contains: search } } },
        { transactionId: { contains: search, mode: "insensitive" } },
        { bill: { host: { name: { contains: search, mode: "insensitive" } } } },
        { bill: { host: { bniAccountNumber: { contains: search } } } },
      ];
    }

    // Sort options
    const orderBy = {};
    switch (sort_by) {
      case "transaction_date":
        orderBy.createdAt = sort_order;
        break;
      case "amount":
        orderBy.amount = sort_order;
        break;
      case "status":
        orderBy.status = sort_order;
        break;
      case "sender":
        orderBy.user = { name: sort_order };
        break;
      case "recipient":
        orderBy.bill = { host: { name: sort_order } };
        break;
      default:
        orderBy.createdAt = sort_order;
    }

    // Get transactions with relations
    const [transactions, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              bniAccountNumber: true,
              bniBranchCode: true,
            },
          },
          bill: {
            select: {
              billName: true,
              category: {
                select: {
                  categoryName: true,
                  categoryIcon: true,
                },
              },
              host: {
                select: {
                  name: true,
                  bniAccountNumber: true,
                  bniBranchCode: true,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    // Format response sesuai mockup table
    const formattedTransactions = transactions.map((tx) => ({
      transaction_id:
        tx.transactionId || `TXN-${tx.paymentId.slice(-8).toUpperCase()}`,
      transaction_date: tx.createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }), // July 18, 2025
      sender: {
        name: tx.user.name,
        account: tx.user.bniAccountNumber,
        branch_code: tx.user.bniBranchCode,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          tx.user.name
        )}&background=ff6b35&color=fff`,
      },
      recipient: {
        name: tx.bill.host.name,
        account: tx.bill.host.bniAccountNumber,
        branch_code: tx.bill.host.bniBranchCode,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          tx.bill.host.name
        )}&background=4ecdc4&color=fff`,
      },
      amount: parseFloat(tx.amount),
      amount_formatted: `Rp ${parseInt(tx.amount).toLocaleString("id-ID")}`,
      payment_method: tx.paymentType === "instant" ? "Instant" : "Scheduled",
      status:
        tx.status === "completed"
          ? "Completed"
          : tx.status === "failed"
          ? "Failed"
          : "Pending",
      status_color:
        tx.status === "completed"
          ? "green"
          : tx.status === "failed"
          ? "red"
          : "orange",
      bill_name: tx.bill.billName,
      bill_category: {
        name: tx.bill.category?.categoryName || "Other",
        icon: tx.bill.category?.categoryIcon || "📦",
      },
      created_at: tx.createdAt.toISOString(),
      paid_at: tx.paidAt?.toISOString() || null,
      bni_reference: tx.bniReferenceNumber,
    }));

    // Calculate summary statistics
    const summary = {
      total_transactions: total,
      completed_transactions: transactions.filter(
        (tx) => tx.status === "completed"
      ).length,
      failed_transactions: transactions.filter((tx) => tx.status === "failed")
        .length,
      pending_transactions: transactions.filter((tx) => tx.status === "pending")
        .length,
      total_amount: transactions.reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0
      ),
      completed_amount: transactions
        .filter((tx) => tx.status === "completed")
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
    };

    res.json({
      data: formattedTransactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
        has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
        has_prev_page: parseInt(page) > 1,
      },
      filters: {
        status: status || "all",
        payment_method: payment_method || "all",
        date_from: date_from || null,
        date_to: date_to || null,
        search: search || null,
        sort_by,
        sort_order,
      },
      summary,
    });
  } catch (error) {
    console.error("Transactions list error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /api/admin/transactions/export - Clean Filter-based Export
router.get("/transactions/export", async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      format = "csv",
      // Filter parameters (sync dengan table filters)
      status,
      payment_method,
      date_from,
      date_to,
      search,
      sort_by = "created_at",
      sort_order = "desc",
      // Export scope
      scope = "current_page", // 'current_page' atau 'all_filtered'
      page = 1,
      limit = 10,
    } = req.query;

    console.log("Export request:", {
      scope,
      status,
      payment_method,
      date_from,
      date_to,
      search,
    });

    // Build where clause SAMA PERSIS dengan table query
    const where = {};

    // Status filter
    if (status && status !== "all") {
      where.status = status.toLowerCase();
    }

    // Payment method filter
    if (payment_method && payment_method !== "all") {
      if (payment_method.toLowerCase() === "instant") {
        where.paymentType = "instant";
      } else if (payment_method.toLowerCase() === "scheduled") {
        where.paymentType = "scheduled";
      }
    }

    // Date range filter
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { bniAccountNumber: { contains: search } } },
        { transactionId: { contains: search, mode: "insensitive" } },
        { bill: { host: { name: { contains: search, mode: "insensitive" } } } },
        { bill: { host: { bniAccountNumber: { contains: search } } } },
      ];
    }

    // Sort options
    const orderBy = {};
    switch (sort_by) {
      case "transaction_date":
        orderBy.createdAt = sort_order;
        break;
      case "amount":
        orderBy.amount = sort_order;
        break;
      case "status":
        orderBy.status = sort_order;
        break;
      case "sender":
        orderBy.user = { name: sort_order };
        break;
      case "recipient":
        orderBy.bill = { host: { name: sort_order } };
        break;
      default:
        orderBy.createdAt = sort_order;
    }

    // Determine pagination based on scope
    let skip, take;
    if (scope === "current_page") {
      // Export current page only (yang tampil di table)
      skip = (parseInt(page) - 1) * parseInt(limit);
      take = parseInt(limit);
    } else {
      // Export all filtered data
      skip = 0;
      take = undefined; // No limit
    }

    // Get transactions
    const [transactions, totalFiltered] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              bniAccountNumber: true,
              bniBranchCode: true,
            },
          },
          bill: {
            select: {
              billName: true,
              category: {
                select: {
                  categoryName: true,
                  categoryIcon: true,
                },
              },
              host: {
                select: {
                  name: true,
                  bniAccountNumber: true,
                  bniBranchCode: true,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    console.log(
      `Found ${transactions.length} transactions to export (${totalFiltered} total filtered)`
    );

    if (format === "csv") {
      // Generate CSV content
      const csvHeader =
        [
          "Transaction ID",
          "Date",
          "Sender Name",
          "Sender Account",
          "Recipient Name",
          "Recipient Account",
          "Amount (IDR)",
          "Payment Method",
          "Status",
          "Bill Name",
          "Category",
        ].join(",") + "\n";

      const csvRows = transactions
        .map((tx) => {
          const row = [
            tx.transactionId || `TXN-${tx.paymentId.slice(-8).toUpperCase()}`,
            tx.createdAt.toLocaleDateString("en-GB"), // 18/07/2025
            `"${tx.user.name}"`,
            tx.user.bniAccountNumber,
            `"${tx.bill.host.name}"`,
            tx.bill.host.bniAccountNumber,
            `"${parseInt(tx.amount).toLocaleString("id-ID")}"`, // Format rupiah
            tx.paymentType === "instant" ? "Instant" : "Scheduled",
            tx.status === "completed"
              ? "Completed"
              : tx.status === "failed"
              ? "Failed"
              : "Pending",
            `"${tx.bill.billName}"`,
            `"${tx.bill.category?.categoryName || "Other"}"`,
          ];
          return row.join(",");
        })
        .join("\n");

      const csvContent = csvHeader + csvRows;

      // Generate filename berdasarkan filter dan scope
      let filename = "splitr-transactions";

      // Add date range to filename
      if (date_from && date_to) {
        filename += `-${date_from}-to-${date_to}`;
      } else if (date_from) {
        filename += `-from-${date_from}`;
      } else if (date_to) {
        filename += `-until-${date_to}`;
      }

      // Add filter info
      if (status && status !== "all") {
        filename += `-${status}`;
      }
      if (payment_method && payment_method !== "all") {
        filename += `-${payment_method}`;
      }
      if (search) {
        filename += `-search-${search.replace(/[^a-zA-Z0-9]/g, "")}`;
      }

      // Add scope info
      if (scope === "current_page") {
        filename += `-page${page}`;
      } else {
        filename += "-all";
      }

      filename += `-${new Date().toISOString().split("T")[0]}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send("\uFEFF" + csvContent); // Add BOM for Excel compatibility
    } else {
      // Return JSON for PDF generation atau frontend processing
      const formattedTransactions = transactions.map((tx) => ({
        transaction_id:
          tx.transactionId || `TXN-${tx.paymentId.slice(-8).toUpperCase()}`,
        transaction_date: tx.createdAt.toLocaleDateString("en-GB"),
        transaction_time: tx.createdAt.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sender: {
          name: tx.user.name,
          account: tx.user.bniAccountNumber,
          branch_code: tx.user.bniBranchCode,
        },
        recipient: {
          name: tx.bill.host.name,
          account: tx.bill.host.bniAccountNumber,
          branch_code: tx.bill.host.bniBranchCode,
        },
        amount: parseFloat(tx.amount),
        amount_formatted: `Rp ${parseInt(tx.amount).toLocaleString("id-ID")}`,
        payment_method: tx.paymentType === "instant" ? "Instant" : "Scheduled",
        status:
          tx.status === "completed"
            ? "Completed"
            : tx.status === "failed"
            ? "Failed"
            : "Pending",
        status_color:
          tx.status === "completed"
            ? "green"
            : tx.status === "failed"
            ? "red"
            : "orange",
        bill_name: tx.bill.billName,
        bill_category: {
          name: tx.bill.category?.categoryName || "Other",
          icon: tx.bill.category?.categoryIcon || "📦",
        },
        bni_reference: tx.bniReferenceNumber,
      }));

      res.json({
        success: true,
        data: formattedTransactions,
        export_info: {
          scope: scope,
          total_exported: transactions.length,
          total_filtered: totalFiltered,
          page: scope === "current_page" ? parseInt(page) : null,
          limit: scope === "current_page" ? parseInt(limit) : null,
          export_date: new Date().toISOString(),
          filters: {
            status: status || "all",
            payment_method: payment_method || "all",
            date_from: date_from || null,
            date_to: date_to || null,
            search: search || null,
            sort_by,
            sort_order,
          },
        },
      });
    }
  } catch (error) {
    console.error("Export transactions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export transactions",
      message: error.message,
    });
  }
});

// GET /api/admin/transactions/export-count - Get Export Count Preview
router.get("/transactions/export-count", async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      status,
      payment_method,
      date_from,
      date_to,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    // Build where clause sama seperti export
    const where = {};

    if (status && status !== "all") {
      where.status = status.toLowerCase();
    }

    if (payment_method && payment_method !== "all") {
      if (payment_method.toLowerCase() === "instant") {
        where.paymentType = "instant";
      } else if (payment_method.toLowerCase() === "scheduled") {
        where.paymentType = "scheduled";
      }
    }

    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { bniAccountNumber: { contains: search } } },
        { transactionId: { contains: search, mode: "insensitive" } },
      ];
    }

    const totalFiltered = await prisma.payment.count({ where });
    const currentPageCount = Math.min(parseInt(limit), totalFiltered);

    res.json({
      current_page_count: currentPageCount,
      all_filtered_count: totalFiltered,
      page: parseInt(page),
      limit: parseInt(limit),
      has_filters:
        !!(status && status !== "all") ||
        !!(payment_method && payment_method !== "all") ||
        !!date_from ||
        !!date_to ||
        !!search,
    });
  } catch (error) {
    console.error("Export count error:", error);
    res.status(500).json({ error: "Failed to get export count" });
  }
});
// GET /api/admin/transactions/stats - Transaction Statistics
router.get("/transactions/stats", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { date_from, date_to } = req.query;

    // Build date filter
    const where = {};
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [totalStats, statusStats, methodStats, amountStats] =
      await Promise.all([
        // Total transactions
        prisma.payment.count({ where }),

        // Status breakdown
        prisma.payment.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
          _sum: { amount: true },
        }),

        // Payment method breakdown
        prisma.payment.groupBy({
          by: ["paymentType"],
          where,
          _count: { _all: true },
          _sum: { amount: true },
        }),

        // Amount statistics
        prisma.payment.aggregate({
          where: { ...where, status: "completed" },
          _sum: { amount: true },
          _avg: { amount: true },
          _min: { amount: true },
          _max: { amount: true },
        }),
      ]);

    res.json({
      total_transactions: totalStats,
      status_breakdown: statusStats.map((stat) => ({
        status: stat.status,
        count: stat._count._all,
        total_amount: parseFloat(stat._sum.amount || 0),
        percentage:
          totalStats > 0
            ? parseFloat(((stat._count._all / totalStats) * 100).toFixed(1))
            : 0,
      })),
      method_breakdown: methodStats.map((stat) => ({
        method: stat.paymentType === "instant" ? "Instant" : "Scheduled",
        count: stat._count._all,
        total_amount: parseFloat(stat._sum.amount || 0),
        percentage:
          totalStats > 0
            ? parseFloat(((stat._count._all / totalStats) * 100).toFixed(1))
            : 0,
      })),
      amount_statistics: {
        total_amount: parseFloat(amountStats._sum.amount || 0),
        average_amount: parseFloat(amountStats._avg.amount || 0),
        min_amount: parseFloat(amountStats._min.amount || 0),
        max_amount: parseFloat(amountStats._max.amount || 0),
      },
    });
  } catch (error) {
    console.error("Transaction stats error:", error);
    res.status(500).json({ error: "Failed to fetch transaction statistics" });
  }
});
module.exports = router;
