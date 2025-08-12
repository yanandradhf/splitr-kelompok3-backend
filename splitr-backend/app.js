const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

// Initialize Prisma Client
const prisma = new PrismaClient();

const app = express();

// Middleware
app.use(logger("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Make Prisma available to all routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Health Check Endpoint
app.get("/health", async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    // Get basic stats
    const [userCount, paymentCount, totalAmount] = await Promise.all([
      prisma.user.count(),
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "completed" },
      }),
    ]);

    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: "connected",
      stats: {
        total_users: userCount,
        total_transactions: paymentCount,
        total_amount: parseFloat(totalAmount._sum.amount || 0),
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: error.message,
    });
  }
});

// Import routes
const indexRouter = require("./routes/index");
const adminRouter = require("./routes/admin");
const dashboardRouter = require("./routes/dashboard");
const transactionRouter = require("./routes/transaction");

// Use routes
app.use("/", indexRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin/dashboard", dashboardRouter);
app.use("/api/admin/transactions", transactionRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    available_endpoints: [
      "GET /health",
      "GET /api/admin/dashboard/summary",
      "GET /api/admin/dashboard/charts/transactions",
      "GET /api/admin/transactions",
    ],
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔄 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
