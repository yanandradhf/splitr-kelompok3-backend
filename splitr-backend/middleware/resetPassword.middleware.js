const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_RESET_SECRET || 'splitr_reset_password';

const authenticateResetToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.query;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Password reset token is missing.' });
    }

    const passwordResetToken = await req.prisma.userAuth.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (userAuth.refreshTokenExp < new Date()) {
      // Optional: Delete the expired token to clean up the database
      await req.prisma.userAuth.delete({ where: { refreshToken } });
      return res.status(401).json({ error: 'Password reset token has expired.' });
    }

    req.user = userAuth.user;
    req.refreshToken = passwordResetToken; // Store the token record
    next();


    jwt.verify(token,JWT_SECRET, async (err, decoded) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return res.status(401).json({ error: "Access token expired" });
        }
        return res.status(403).json({ error: "Invalid access token" });
      }

      // Get user from database
      const user = await req.prisma.user.findUnique({
        where: { userId: decoded.userId },
        include: { auth: true },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    console.error("Reset password middleware error:", error);
    res.status(500).json({ error: "Reset password authentication failed" });
  }
};

module.exports = { authenticateResetToken };
