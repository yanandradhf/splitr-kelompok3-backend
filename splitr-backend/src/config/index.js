/**
 * Application Configuration
 * Centralized configuration management
 */

require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },

  // Email Configuration
  email: {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
  },

  // Cloudinary Configuration
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // External Services
  services: {
    googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  },

  // App Settings
  app: {
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES) || 5,
    sessionExpiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS) || 2,
    paymentDelaySeconds: parseInt(process.env.PAYMENT_DELAY_SECONDS) || 10,
    scheduledPaymentDelayMinutes: parseInt(process.env.SCHEDULED_PAYMENT_DELAY_MINUTES) || 1,
  },
};

module.exports = config;