const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Simple session storage (in-memory, reset ketika server restart)
const adminSessions = new Map();

// POST /api/admin/login - Simple Admin Login
router.post("/login", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Find admin user
    const admin = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await prisma.adminUser.update({
      where: { adminId: admin.adminId },
      data: { lastLoginAt: new Date() },
    });

    // Simple session ID
    const sessionId = `admin_session_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store session (simple in-memory)
    adminSessions.set(sessionId, {
      adminId: admin.adminId,
      username: admin.username,
      role: admin.role,
      loginAt: new Date(),
    });

    res.json({
      message: "Login successful",
      sessionId,
      admin: {
        adminId: admin.adminId,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/admin/logout - Simple Admin Logout
router.post("/logout", async (req, res) => {
  try {

    // Simple session ID
    const sessionId = req.body.sessionId;

    // Store session (simple in-memory)
    if (adminSessions.has(sessionId)) {
      // Delete the session
      adminSessions.delete(sessionId);
      console.log(`Admin session ${sessionId} successfully logged out.`);
      return res.json({ message: "Logout successful" });
    } else {
      // Session not found, likely already logged out or invalid
      return res.status(401).json({ error: "Invalid or expired session" });
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/admin/register - Simple Admin Logout
router.post("/register", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { username, password, email} = req.body; // 'role' is optional, will default if not provided

    // 1. Validate required input fields
    if (!username || !password || !email) {
      return res.status(400).json({ error: "Username, password, and email are required" });
    }

    // Optional: Basic email format validation (more robust validation can be added)
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // 2. Check if username or email already exists
    const existingUser = await prisma.adminUser.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (existingUser) {
      // Return a more specific error if needed, e.g., "Username already taken" or "Email already registered"
      return res.status(409).json({ error: "Username or email already exists" });
    }

    // 3. Hash the password for security
    const saltRounds = 10; // Number of salt rounds for bcrypt (higher is more secure, but slower)
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Create the new admin user in the database
    const newAdmin = await prisma.adminUser.create({
      data: {
        username: username,
        passwordHash: passwordHash,
        email: email
      },
      select: { // Select only the fields you want to return (exclude passwordHash)
        adminId: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      }
    });

    res.status(201).json({
      message: "Admin user registered successfully",
      admin: newAdmin
    });

  } catch (error) {
    console.error("Admin registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});
module.exports = router;