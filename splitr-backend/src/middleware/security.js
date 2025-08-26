/**
 * Security Middleware
 * Handles CSRF protection and other security measures
 */

const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/[<>]/g, '');
};

// Log sanitization to prevent log injection
const sanitizeForLog = (input) => {
  if (typeof input !== 'string') return input;
  return encodeURIComponent(input);
};

module.exports = {
  createRateLimit,
  sanitizeInput,
  sanitizeForLog,
};