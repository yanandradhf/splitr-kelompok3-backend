const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const nodemailer = require('nodemailer');
const { authenticateResetToken } = require("../../middleware/resetPassword.middleware")

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || 'splitr_reset_password';

const REFRESH_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_EXPIRATION_MS = 5 * 60 * 1000;

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const emailTransport = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "def93edfdce17c",
    pass: "d3484cabeb4222"
  }
});

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

    //Tambah refreshtoken dimasukin ke db userauth
    const token = jwt.sign({ userId: auth.user.userId, authId: auth.authId }, JWT_SECRET, { expiresIn: "24h" });
    const refreshTokenExp = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_MS);

    await prisma.userAuth.update({
      where: { authId: auth.authId }, // Use authId for uniqueness
      data: {
        lastLoginAt: new Date(),
        loginAttempts: 0, // Reset login attempts on success
        refreshToken: token, // Store the newly generated refresh token
        refreshTokenExp: refreshTokenExp, // Store the refresh token's expiration
      },
    });

    res.json({
      token,
      refreshTokenExp,
      user: {
        authId: auth.authId,
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

// 2. Forget Password to change password
router.post("/forget-password", authenticateToken, async (req, res) => {
  try {
    const { newPassword, confirmPassword} = req.body;
    const prisma = req.prisma;

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header missing' });
    }

    const tempToken = authHeader.split(' ')[1];

    if (!tempToken) {
      return res.status(400).json({ error: "Temporary token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const auth = await prisma.userAuth.findUnique({
      where: {authId: decoded.authId,},
      select: { authId: true,},
    });

    if ( !newPassword || !confirmPassword ) {
      return res.status(400).json({ error: "Current password and new password required" });
    }

    if ( newPassword !==confirmPassword ) {
      return res.status(400).json({ error: "Password validation is false" });
    }

    // Update Password
    await prisma.userAuth.update({
      where: { authId: auth.authId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
      },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change PIN error:", error);
    res.status(500).json({ error: "Failed to change Password" });
  }
});

// 3. Validate BNI Account
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

// 4. Send OTP for Registration (Mock)
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

    // const otp = Math.floor(100000 + Math.random() * 900000); 

    // const url = 'https://sandbox.api.mailtrap.io/api/send';
    // const mailOptions = {
    //   from: 'splitr@mailtrap.com',
    //   to: toEmail,
    //   subject: 'Hello from your app!',
    //   text: `Your OTP code is ${otp}`
    // };

    // await emailTransport.sendMail(mailOptions);
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

// 4.1. Send OTP for Password Reset
router.post("/send-reset-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const prisma = req.prisma;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      return res.status(400).json({ error: "Email not registered" });
    }

    // Generate OTP (always 123456 for testing)
    const otpCode = "123456";

    // Delete existing reset OTP
    await prisma.otpCode.deleteMany({ where: { email, purpose: "reset_password" } });

    // Save new OTP
    await prisma.otpCode.create({
      data: {
        email,
        otpCode,
        purpose: "reset_password",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    res.json({ message: "Reset OTP sent to email", otp: otpCode }); // Show OTP for testing
  } catch (error) {
    console.error("Send reset OTP error:", error);
    res.status(500).json({ error: "Failed to send reset OTP" });
  }
});

// 4.2. Verify Reset OTP
router.post("/verify-reset-otp", async (req, res) => {
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
        purpose: "reset_password",
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

    // Generate temp token for reset
    const tempToken = jwt.sign({ email, purpose: "reset" }, JWT_SECRET, { expiresIn: "10m" });

    res.json({ verified: true, tempToken });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res.status(500).json({ error: "Reset OTP verification failed" });
  }
});

// 4.3. Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { tempToken, newPassword, confirmPassword } = req.body;
    const prisma = req.prisma;

    if (!tempToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    if (decoded.purpose !== "reset") {
      return res.status(400).json({ error: "Invalid token purpose" });
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update password
    await prisma.userAuth.update({
      where: { userId: user.userId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// 5. Verify OTP (Registration)
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

// 6. Complete Registration
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
      console.log('Creating user with data:', {
        name: namaRekening,
        email: decoded.email,
        phone,
        bniAccountNumber: nomorRekening,
        bniBranchCode: bniAccount.branchCode,
      });
      
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
      
      console.log('User created:', user.userId);
      console.log('Creating userAuth with username:', username);

      const auth = await tx.userAuth.create({
        data: {
          userId: user.userId,
          username,
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
      
      console.log('UserAuth created:', auth.authId);

      return { user, auth };
    });

    res.json({
      message: "Registration successful",
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

// 7. Get My BNI Account Details
router.get("/my-account", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Get user's BNI account number
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { bniAccountNumber: true, name: true },
    });

    if (!user || !user.bniAccountNumber) {
      return res.status(404).json({ error: "BNI account not found" });
    }

    // Get account details
    const account = await prisma.bniDummyAccount.findUnique({
      where: { nomorRekening: user.bniAccountNumber },
    });

    if (!account) {
      return res.status(404).json({ error: "Account details not found" });
    }

    // Get branch details separately
    const branch = await prisma.bniBranch.findUnique({
      where: { branchCode: account.branchCode },
    });

    res.json({
      accountNumber: account.nomorRekening,
      accountName: account.namaRekening,
      balance: parseFloat(account.saldo),
      branchCode: account.branchCode,
      branch: {
        branchName: branch?.branchName,
        city: branch?.city,
        province: branch?.province,
      },
    });
  } catch (error) {
    console.error("Get account error:", error);
    res.status(500).json({ error: "Failed to get account details" });
  }
});

// 8. Get BNI Account Balance (by account number)
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

// 8. Logout
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma; // Accessing Prisma client from the request object
    const { authId } = req.user;

    // The client should still send the refresh token they want to invalidate.
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        // Handle case where Authorization header is missing
        return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(400).json({ error: "Refresh token required for logout" });
    }

    // Find the user authentication record using the authId from the access token.
    // Then, verify that the provided refresh token matches the one stored for this user.
    const auth = await prisma.userAuth.findUnique({
      where: { authId: authId },
    });

    // Check if the user auth record exists AND if the provided refresh token matches the stored one.
    if (!auth || auth.refreshToken !== token) {
      // If the refresh token doesn't match or the record is not found,
      // it means the provided refresh token is either invalid, already cleared, or belongs to a different session.
      return res.status(401).json({ error: "Invalid token for this user." });
    }

    // Update the UserAuth record to clear the refresh token and its expiration
    await prisma.userAuth.update({
      where: { authId: auth.authId }, // Use the authId from the found record
      data: {
        refreshToken: null,      // Set refreshToken to null
        refreshTokenExp: null,   // Set refreshTokenExp to null
        loginAttempts: 0,        // Optionally reset login attempts
        lockedUntil: null        // Optionally clear any lockout
      },
    });


    // Send a success response. The client is then expected to delete their stored JWTs.
    res.json({ message: "Logout successful." });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

module.exports = router;