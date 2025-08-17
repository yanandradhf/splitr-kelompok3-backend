const express = require("express");
const router = express.Router();

// Import admin sub-routes
const authRoutes = require("./auth");
const dashboardRoutes = require("./dashboard");
const transactionRoutes = require("./transaction");
const analyticsRoutes = require("./analytics");

// Mount routes
router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/transactions", transactionRoutes);
router.use("/analytics", analyticsRoutes);

// Backward compatibility (deprecated)
router.use("/", authRoutes); // /api/admin/login still works

module.exports = router;