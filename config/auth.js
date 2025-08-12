module.exports = {
  sessionSecret: process.env.SESSION_SECRET,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  adminCredentials: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  }
};