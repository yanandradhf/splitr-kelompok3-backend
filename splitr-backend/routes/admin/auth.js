const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { NotFoundError, BadRequestError, ValidationError, DatabaseError, errorHandler } = require("../../middleware/error.middleware");

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your_very_secure_secret_key';
const JWT_EXPIRY = '1h';

// POST /api/admin/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!username || !password) {
      const error = new Error("Username and password are required");
      error.name = "ValidationError";
      return next(error);
    }

    const admin = await prisma.adminUser.findUnique({
      where: { username },
    });

    if (!admin || !await bcrypt.compare(password, admin.passwordHash)) {
      const error = new Error("Invalid credentials");
      error.name = "UnauthorizedError";
      return next(error);
    }

    await prisma.adminUser.update({
      where: { adminId: admin.adminId },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign({
      adminId: admin.adminId,
      username: admin.username,
      role: admin.role,
    }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });

    res.json({
      message: "Login successful",
      token,
      admin: {
        adminId: admin.adminId,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
    } else if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    next(error);
  }
});

// POST /api/admin/auth/logout
router.post("/logout", (req, res, next) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: "Username, password, and email are required" });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const existingUser = await req.prisma.adminUser.findFirst({
      where: { OR: [{ username }, { email }] }
    });

    if (existingUser) {
      return res.status(409).json({ error: "Username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newAdmin = await req.prisma.adminUser.create({
      data: { username, passwordHash, email },
      select: {
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