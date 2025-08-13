const express = require("express");
const router = express.Router();
const authenticateJWT=require("./../middleware/auth.js")

// GET /api/admin/dashboard/summary
//router.get("/protected-admin-route", authenticateJWT, (req, res)
router.get("/summary", async (req, res) => {
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
router.get("/charts/transactions", async (req, res) => {
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
router.get("/charts/categories", async (req, res) => {
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
router.get("/charts/payment-methods", async (req, res) => {
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
router.get("/charts/daily-amount", async (req, res) => {
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

module.exports = router;