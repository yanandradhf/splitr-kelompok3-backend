const express = require('express');
const router = express.Router();

// Import all route modules at the top (fix lazy loading)
const activitiesRoutes = require('./activity.routes');
const authRoutes = require('./auth.routes');
const billRoutes = require('./bill.routes');
const paymentRoutes = require('./payment.routes');
const profileRoutes = require('./profile.routes');
const notificationRoutes = require('./notification.routes');
const friendsRoutes = require('./friends.routes');
const groupsRoutes = require('./groups.routes');
const categoriesRoutes = require('./categories.routes');
const receiptRoutes = require('./receipt.routes');
const uploadRoutes = require('./upload.routes');

// Mount routes with consistent formatting
router.use('/activities', activitiesRoutes);
router.use('/auth', authRoutes);
router.use('/bills', billRoutes);
router.use('/payments', paymentRoutes);
router.use('/profile', profileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/friends', friendsRoutes);
router.use('/groups', groupsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/receipts', receiptRoutes);
router.use('/upload', uploadRoutes);

module.exports = router;