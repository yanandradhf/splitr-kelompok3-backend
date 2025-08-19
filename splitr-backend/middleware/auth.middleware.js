const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

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
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

module.exports = { authenticateToken };
