const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const nodemailer = require('nodemailer');
const { authenticateResetToken } = require("../../middleware/resetPassword.middleware");
const { NotFoundError, BadRequestError, ValidationError, DatabaseError, errorHandler } = require("../../middleware/error.middleware");

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || 'splitr_reset_password';

const REFRESH_TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_EXPIRATION_MS = 5 * 60 * 1000;

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    const error = new Error('Access token dibutuhkan');
    error.name = 'UnauthorizedError';
    return next(error);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      const error = new Error('Token invalid atau kadaluarsa');
      error.name = err.name === 'TokenExpiredError' ? 'ExpiredTokenError' : 'ForbiddenError';
      return next(error);
    }
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
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const prisma = req.prisma;

    if (!username || !password) {
      throw new ValidationError("Username and password required");
    }

    const auth = await prisma.userAuth.findUnique({
      where: { username },
      include: { user: true },
    });

    if (!auth || !await bcrypt.compare(password, auth.passwordHash)) {
      throw new ValidationError("Invalid credentials");
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
router.post("/validate-bni", async (req, res, next) => {
  try {
    const { namaRekening, nomorRekening } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!namaRekening || !nomorRekening) {
      throw new ValidationError("Nama rekening and nomor rekening required");
    }

    const account = await prisma.bniDummyAccount.findFirst({
      where: { namaRekening, nomorRekening, isActive: true },
    });

    if (!account) {
      throw new NotFoundError("BNI account not found or mismatch");
    }

    res.json({ valid: true, branchCode: account.branchCode });
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

// 4. Send OTP for Registration (Mock)
router.post("/send-otp", async (req, res, next) => {
  try {
    const { email } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!email) {
      throw new ValidationError("Email required");
    }
    if (email && (!email.includes('@') || !email.includes('.'))) {
      const error = new Error("Format email tidak valid");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ValidationError("Email already registered");
    }

    // Generate OTP (always 123456 for testing)
    const otpCode = "123456";

    // const otp = Math.floor(100000 + Math.random() * 900000); 

    // const url = 'https://sandbox.api.mailtrap.io/api/send';
    // const mailOptions = {
    //   from: 'splitr@mailtrap.com',
    //   to: email,
    //   subject: 'Hello from your app!',
    //   text: `Your OTP code is ${otpCode}`
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
    if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    next(error);
  }
});

// 4.1. Send OTP for Password Reset
router.post("/send-reset-otp", async (req, res, next) => {
  try {
    const { email } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!email) {
      const error = new Error("Email dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate email format
    if (!email.includes('@') || !email.includes('.')) {
      const error = new Error("Format email tidak valid");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      const error = new Error("Email tidak terdaftar");
      error.name = "NotFoundError";
      return next(error);
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
    // Classify database errors
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

// 4.2. Verify Reset OTP
router.post("/verify-reset-otp", async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!email || !otp) {
      const error = new Error("Email dan OTP dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate email format
    if (!email.includes('@') || !email.includes('.')) {
      const error = new Error("Format email tidak valid");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate OTP length
    if (otp.length != 6) {
      const error = new Error("OTP tidak sesuai");
      error.name = "ValidationError";
      return next(error);
    }
    // Validate OTP characters (only numbers)
    if (otp && !/^[0-9]+$/.test(otp)) {
      const error = new Error("PIN tidak sesuai");
      error.name = "ValidationError";
      return next(error);
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
      const error = new Error("OTP tidak valid atau sudah kadaluarsa");
      error.name = "ValidationError";
      return next(error);
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
    // Classify database errors
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

// 4.3. Reset Password
router.post("/reset-password", async (req, res, next) => {
  try {
    const { tempToken, newPassword, confirmPassword } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!tempToken || !newPassword || !confirmPassword) {
      const error = new Error("Semua field dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    if (newPassword !== confirmPassword) {
      const error = new Error("Password tidak cocok");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate password length
    if (newPassword.length < 8 || confirmPassword.length < 8) {
      const error = new Error("Password harus minimal 8 karakter");
      error.name = "ValidationError";
      return next(error);
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      const error = new Error("Token tidak valid atau sudah kadaluarsa");
      error.name = "UnauthorizedError";
      return next(error);
    }

    if (decoded.purpose !== "reset") {
      const error = new Error("Token tidak valid untuk reset password");
      error.name = "UnauthorizedError";
      return next(error);
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
      const error = new Error("User tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "User atau auth tidak ditemukan";
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

// 5. Verify OTP (Registration)
router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!email || !otp) {
      const error = new Error("Email dan OTP dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate email format
    if (!email.includes('@') || !email.includes('.')) {
      const error = new Error("Format email tidak valid");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate OTP length
    if (otp.length != 6) {
      const error = new Error("OTP tidak sesuai");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate OTP characters (only numbers)
    if (otp && !/^[0-9]+$/.test(otp)) {
      const error = new Error("OTP tidak sesuai");
      error.name = "ValidationError";
      return next(error);
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
      const error = new Error("OTP tidak valid atau sudah kadaluarsa");
      error.name = "ValidationError";
      return next(error);
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
    // Classify database errors
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

// 6. Complete Registration
router.post("/register", async (req, res, next) => {
  try {
    const { tempToken, username, password, pin, namaRekening, nomorRekening, phone } = req.body;
    const prisma = req.prisma;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!tempToken || !username || !password || !pin || !namaRekening || !nomorRekening || !phone) {
      const error = new Error("Semua field dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate password length
    if (password.length < 8) {
      const error = new Error("Password minimal 8 karakter");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate PIN length
    if (pin.length !== 6) {
      const error = new Error("PIN tidak sesuai");
      error.name = "ValidationError";
      return next(error);
    }

    // Validate PIN characters (only numbers)
    if (pin && !/^[0-9]+$/.test(pin)) {
      const error = new Error("PIN tidak sesuai");
      error.name = "ValidationError";
      return next(error);
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      const error = new Error("Token tidak valid atau sudah kadaluarsa");
      error.name = "UnauthorizedError";
      return next(error);
    }

    // Validate BNI account
    const bniAccount = await prisma.bniDummyAccount.findFirst({
      where: { namaRekening, nomorRekening, isActive: true },
    });

    if (!bniAccount) {
      const error = new Error("Akun BNI tidak valid");
      error.name = "NotFoundError";
      return next(error);
    }

    // Check username
    const existingAuth = await prisma.userAuth.findUnique({ where: { username } });
    if (existingAuth) {
      const error = new Error("Username sudah digunakan");
      error.name = "ConflictError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2002') {
      error.name = "ConflictError";
      error.message = "Username atau email sudah digunakan";
    } else if (error.code === 'P2025') {
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

// 7. Get My BNI Account Details
router.get("/my-account", authenticateToken, async (req, res, next) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!userId) {
      const error = new Error("User ID tidak ditemukan di dalam token");
      error.name = "UnauthorizedError";
      return next(error);
    }

    // Get user's BNI account number
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { bniAccountNumber: true, name: true },
    });

    if (!user || !user.bniAccountNumber) {
      const error = new Error("Akun BNI tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    // Get account details
    const account = await prisma.bniDummyAccount.findUnique({
      where: { nomorRekening: user.bniAccountNumber },
    });

    if (!account) {
      const error = new Error("Detail akun tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "User atau akun tidak ditemukan";
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
router.post("/logout", authenticateToken, async (req, res, next) => {
  try {
    const prisma = req.prisma;
    const { authId } = req.user;

    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

    if (!authId) {
      const error = new Error("Auth ID tidak ditemukan di dalam token");
      error.name = "UnauthorizedError";
      return next(error);
    }

    // The client should still send the refresh token they want to invalidate.
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      const error = new Error("Authorization header tidak ada");
      error.name = "UnauthorizedError";
      return next(error);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      const error = new Error("Token dibutuhkan untuk logout");
      error.name = "ValidationError";
      return next(error);
    }

    // Find the user authentication record using the authId from the access token.
    const auth = await prisma.userAuth.findUnique({
      where: { authId: authId },
    });

    // Check if the user auth record exists AND if the provided refresh token matches the stored one.
    if (!auth || auth.refreshToken !== token) {
      const error = new Error("Token tidak valid untuk user ini");
      error.name = "UnauthorizedError";
      return next(error);
    }

    // Update the UserAuth record to clear the refresh token and its expiration
    await prisma.userAuth.update({
      where: { authId: auth.authId },
      data: {
        refreshToken: null,
        refreshTokenExp: null,
        loginAttempts: 0,
        lockedUntil: null
      },
    });

    res.json({ message: "Logout successful." });
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "User auth tidak ditemukan";
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

module.exports = router;