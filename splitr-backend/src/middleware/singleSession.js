/**
 * Single Session Middleware
 * Ensures only one active session per user (Banking Security)
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

const enforceSingleSession = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const prisma = req.prisma;

    // Check if this is the current active session
    const auth = await prisma.userAuth.findUnique({
      where: { authId: decoded.authId },
      select: { refreshToken: true, refreshTokenExp: true }
    });

    if (!auth || !auth.refreshToken) {
      return res.status(401).json({ 
        error: 'Session expired. Please login again.',
        code: 'SESSION_EXPIRED'
      });
    }

    // Compare current token with stored active session token
    if (auth.refreshToken !== token) {
      return res.status(401).json({ 
        error: 'Your account has been accessed from another device. Please login again.',
        code: 'SESSION_REPLACED'
      });
    }

    // Check if session is expired
    if (auth.refreshTokenExp && new Date() > auth.refreshTokenExp) {
      return res.status(401).json({ 
        error: 'Session expired. Please login again.',
        code: 'SESSION_EXPIRED'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Session expired. Please login again.',
        code: 'SESSION_EXPIRED'
      });
    }
    
    console.error('Single session check error:', error);
    return res.status(401).json({ 
      error: 'Invalid session',
      code: 'SESSION_INVALID'
    });
  }
};

module.exports = { enforceSingleSession };