const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

// 1. Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const prisma = req.prisma;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const auth = await prisma.userAuth.findUnique({
      where: { username },
      include: { user: true },
    });

    if (!auth || !await bcrypt.compare(password, auth.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: auth.user.userId }, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      token,
      user: {
        userId: auth.user.userId,
        name: auth.user.name,
        email: auth.user.email,
        username: auth.username,
        bniAccountNumber: auth.user.bniAccountNumber,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// 2. Validate BNI Account
router.post("/validate-bni", async (req, res) => {
  try {
    const { namaRekening, nomorRekening } = req.body;
    const prisma = req.prisma;

    if (!namaRekening || !nomorRekening) {
      return res.status(400).json({ error: "Nama rekening and nomor rekening required" });
    }

    const account = await prisma.bniDummyAccount.findFirst({
      where: { namaRekening, nomorRekening, isActive: true },
    });

    if (!account) {
      return res.status(400).json({ valid: false, message: "BNI account not found or mismatch" });
    }

    res.json({ valid: true, branchCode: account.branchCode });
  } catch (error) {
    console.error("BNI validation error:", error);
    res.status(500).json({ error: "Validation failed" });
  }
});

// 3. Send OTP (Mock)
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const prisma = req.prisma;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Generate OTP (always 123456 for testing)
    const otpCode = "123456";

    // Delete existing OTP
    await prisma.otpCode.deleteMany({ where: { email } });

    // Save new OTP
    await prisma.otpCode.create({
      data: {
        email,
        otpCode,
        purpose: "registration",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    res.json({ message: "OTP sent to email", otp: otpCode }); // Show OTP for testing
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// 4. Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const prisma = req.prisma;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP required" });
    }

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        email,
        otpCode: otp,
        purpose: "registration",
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { otpId: otpRecord.otpId },
      data: { isUsed: true },
    });

    // Generate temp token
    const tempToken = jwt.sign({ email, verified: true }, JWT_SECRET, { expiresIn: "10m" });

    res.json({ verified: true, tempToken });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "OTP verification failed" });
  }
});

// 5. Complete Registration
router.post("/register", async (req, res) => {
  try {
    const { tempToken, username, password, pin, namaRekening, nomorRekening, phone } = req.body;
    const prisma = req.prisma;

    if (!tempToken || !username || !password || !pin || !namaRekening || !nomorRekening || !phone) {
      return res.status(400).json({ error: "All fields required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Validate BNI account
    const bniAccount = await prisma.bniDummyAccount.findFirst({
      where: { namaRekening, nomorRekening, isActive: true },
    });

    if (!bniAccount) {
      return res.status(400).json({ error: "Invalid BNI account" });
    }

    // Check username
    const existingAuth = await prisma.userAuth.findUnique({ where: { username } });
    if (existingAuth) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Create user and auth
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: namaRekening,
          email: decoded.email,
          phone,
          bniAccountNumber: nomorRekening,
          bniBranchCode: bniAccount.branchCode,
          encryptedPinHash: await bcrypt.hash(pin, 10),
          isVerified: true,
        },
      });

      const auth = await tx.userAuth.create({
        data: {
          userId: user.userId,
          username,
          passwordHash: await bcrypt.hash(password, 10),
        },
      });

      return { user, auth };
    });

    const token = jwt.sign({ userId: result.user.userId }, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      token,
      user: {
        userId: result.user.userId,
        name: result.user.name,
        email: result.user.email,
        username: result.auth.username,
        bniAccountNumber: result.user.bniAccountNumber,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// 6. Get BNI Account Balance
router.get("/bni-balance/:accountNumber", async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const prisma = req.prisma;

    const account = await prisma.bniDummyAccount.findUnique({
      where: { nomorRekening: accountNumber },
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({
      accountNumber: account.nomorRekening,
      accountName: account.namaRekening,
      balance: parseFloat(account.saldo),
      branchCode: account.branchCode,
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

module.exports = router;