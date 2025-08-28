const express = require("express");
const router = express.Router();
const authenticateJWT=require("./../../middleware/auth.js")

// Middleware to check prisma connection
function checkPrisma(req, res, next) {
  if (!req.prisma) {
    return res.status(500).json({ error: "Database connection not available" });
  }
  next();
}

// GET /api/admin/dashboard/summary
router.get("/summary", checkPrisma, async (req, res) => {
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
          paymentType: "instant",
        },
        _count: { paymentId: true },
        _sum: { amount: true },
      }),

      // Today's scheduled payments
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          paymentType: "scheduled",
        },
        _count: { paymentId: true },
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
          status: { in: ["completed", "completed_scheduled", "completed_late"] },
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
      (todayScheduled._count.paymentId || 0);
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
router.get("/charts/transactions", checkPrisma, async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let chartData = [];
    const now = new Date();

    switch (period) {
      case "7days":
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);

          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [payments, scheduled] = await Promise.all([
            prisma.payment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                paymentType: "instant",
              },
            }),
            prisma.payment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                paymentType: "scheduled",
              },
            }),
          ]);

          chartData.push({
            label: currentDate.toLocaleDateString("en-US", {
              weekday: "short",
            }),
            date: currentDate.toISOString().split("T")[0],
            transactions: payments + scheduled,
            payments_count: payments,
            scheduled_count: scheduled,
          });
        }
        break;

      case "30days":
      case "thismonth":
        const days = period === "30days" ? 30 : new Date().getDate();
        const start = period === "30days" ? 
          new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000) :
          new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);

        for (let i = 0; i < days; i++) {
          const currentDate = new Date(start);
          currentDate.setDate(start.getDate() + i);
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [payments, scheduled] = await Promise.all([
            prisma.payment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                paymentType: "instant",
              },
            }),
            prisma.payment.count({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                paymentType: "scheduled",
              },
            }),
          ]);

          chartData.push({
            label: i % 5 === 0 ? currentDate.getDate().toString() : "",
            date: currentDate.toISOString().split("T")[0],
            transactions: payments + scheduled,
            payments_count: payments,
            scheduled_count: scheduled,
          });
        }
        break;

      case "year":
        for (let i = 0; i < 12; i++) {
          const monthStart = new Date(now.getFullYear(), i, 1);
          const monthEnd = new Date(now.getFullYear(), i + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);

          const [payments, scheduled] = await Promise.all([
            prisma.payment.count({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
                paymentType: "instant",
              },
            }),
            prisma.payment.count({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
                paymentType: "scheduled",
              },
            }),
          ]);

          chartData.push({
            label: monthStart.toLocaleDateString("en-US", { month: "short" }),
            date: monthStart.toISOString().split("T")[0],
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
router.get("/charts/categories", checkPrisma, async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let startDate, endDate;
    const now = new Date();

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
        AND p.status IN ('completed', 'completed_scheduled', 'completed_late')
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
router.get("/charts/payment-methods", checkPrisma, async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let startDate, endDate;
    const now = new Date();

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
          paymentType: "instant",
          status: { in: ["completed", "completed_late"] },
        },
      }),
      prisma.payment.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          paymentType: "scheduled",
          status: "completed_scheduled",
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
router.get("/charts/daily-amount", checkPrisma, async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    let chartData = [];
    const now = new Date();

    switch (period) {
      case "7days":
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
                paymentType: "instant",
                status: { in: ["completed", "completed_late"] },
              },
              _sum: { amount: true },
            }),
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                paymentType: "scheduled",
                status: "completed_scheduled",
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
            }),
            date: currentDate.toISOString().split("T")[0],
            amount: totalAmount,
            amount_formatted: `Rp ${(totalAmount / 1000000).toFixed(1)}M`,
            instant_amount: parseFloat(paymentAmount._sum.amount || 0),
            scheduled_amount: parseFloat(scheduledAmount._sum.amount || 0),
          });
        }
        break;

      case "30days":
      case "thismonth":
        const days = period === "30days" ? 30 : new Date().getDate();
        const start = period === "30days" ? 
          new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000) :
          new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);

        for (let i = 0; i < days; i++) {
          const currentDate = new Date(start);
          currentDate.setDate(start.getDate() + i);
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);

          const [paymentAmount, scheduledAmount] = await Promise.all([
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                paymentType: "instant",
                status: { in: ["completed", "completed_late"] },
              },
              _sum: { amount: true },
            }),
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: currentDate, lt: nextDate },
                paymentType: "scheduled",
                status: "completed_scheduled",
              },
              _sum: { amount: true },
            }),
          ]);

          const totalAmount =
            parseFloat(paymentAmount._sum.amount || 0) +
            parseFloat(scheduledAmount._sum.amount || 0);

          chartData.push({
            label: i % 5 === 0 ? currentDate.getDate().toString() : "",
            date: currentDate.toISOString().split("T")[0],
            amount: totalAmount,
            amount_formatted: `Rp ${(totalAmount / 1000000).toFixed(1)}M`,
            instant_amount: parseFloat(paymentAmount._sum.amount || 0),
            scheduled_amount: parseFloat(scheduledAmount._sum.amount || 0),
          });
        }
        break;

      case "year":
        for (let i = 0; i < 12; i++) {
          const monthStart = new Date(now.getFullYear(), i, 1);
          const monthEnd = new Date(now.getFullYear(), i + 1, 0);
          monthEnd.setHours(23, 59, 59, 999);

          const [paymentAmount, scheduledAmount] = await Promise.all([
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
                paymentType: "instant",
                status: { in: ["completed", "completed_late"] },
              },
              _sum: { amount: true },
            }),
            prisma.payment.aggregate({
              where: {
                createdAt: { gte: monthStart, lte: monthEnd },
                paymentType: "scheduled",
                status: "completed_scheduled",
              },
              _sum: { amount: true },
            }),
          ]);

          const totalAmount =
            parseFloat(paymentAmount._sum.amount || 0) +
            parseFloat(scheduledAmount._sum.amount || 0);

          chartData.push({
            label: monthStart.toLocaleDateString("en-US", { month: "short" }),
            date: monthStart.toISOString().split("T")[0],
            amount: totalAmount,
            amount_formatted: `Rp ${(totalAmount / 1000000000).toFixed(2)}B`,
            instant_amount: parseFloat(paymentAmount._sum.amount || 0),
            scheduled_amount: parseFloat(scheduledAmount._sum.amount || 0),
          });
        }
        break;

      default:
        return res.status(400).json({ error: "Invalid period" });
    }

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