const express = require("express");
const jwt = require("jsonwebtoken");
const NotificationService = require("../../services/notification.service");
const router = express.Router();
const { errorHandler } = require("../../middleware/error.middleware");

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

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

// 1. Get Friends List
router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Validate required dependencies
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

    const friends = await prisma.friend.findMany({
      where: {
        userId,
        status: "active",
      },
      include: {
        friend: {
          select: {
            userId: true,
            name: true,
            email: true,
            bniAccountNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      friends: friends.map(friendship => ({
        friendshipId: friendship.friendshipId,
        friend: {
          userId: friendship.friend.userId,
          name: friendship.friend.name,
          email: friendship.friend.email,
          accountNumber: friendship.friend.bniAccountNumber,
        },
        status: friendship.status,
        createdAt: friendship.createdAt,
      })),
    });
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2002') {
      error.name = "ConflictError";
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

// 2. Search Users by Username (specific search)
router.get("/search", authenticateToken, async (req, res, next) => {
  try {
    const { username } = req.query;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Validate required dependencies
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

    // Validate input
    if (!username) {
      const error = new Error("Username dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Get existing friend IDs
    const existingFriends = await prisma.friend.findMany({
      where: { userId },
      select: { friendUserId: true },
    });
    const friendIds = existingFriends.map(f => f.friendUserId);

    // Search by exact username match (ignore friend filter for now)
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { userId: { not: userId } },
          {
            auth: {
              username: { equals: username, mode: "insensitive" }
            }
          }
        ],
      },
      select: {
        userId: true,
        name: true,
        email: true,
        bniAccountNumber: true,
        auth: {
          select: {
            username: true
          }
        }
      },
    });

    if (!user) {
      const error = new Error(`Tidak ada user dengan username '${username}'`);
      error.name = "NotFoundError";
      return next(error);
    }

    // Check if already friends
    const isAlreadyFriend = friendIds.includes(user.userId);

    res.json({ 
      found: true,
      user: {
        userId: user.userId,
        username: user.auth.username,
        name: user.name,
        email: user.email,
        accountNumber: user.bniAccountNumber
      },
      isAlreadyFriend,
      canAddFriend: !isAlreadyFriend
    });
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

// 3. Add Friend by Username
router.post("/add-by-username", authenticateToken, async (req, res, next) => {
  try {
    const { username } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Validate required dependencies
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

    // Validate input
    if (!username) {
      const error = new Error("Username dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Find user by username
    const friendUser = await prisma.user.findFirst({
      where: {
        auth: {
          username: { equals: username, mode: "insensitive" }
        }
      },
      select: { 
        userId: true, 
        name: true, 
        email: true,
        auth: {
          select: { username: true }
        }
      },
    });

    if (!friendUser) {
      const error = new Error(`Tidak ada user dengan username '${username}'`);
      error.name = "NotFoundError";
      return next(error);
    }

    if (friendUser.userId === userId) {
      const error = new Error("Tidak bisa menambahkan diri sendiri sebagai teman");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if you already added this user
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId: friendUser.userId,
      },
    });

    if (existingFriendship) {
      const error = new Error(`Anda sudah menambahkan ${friendUser.name} ke daftar teman`);
      error.name = "ConflictError";
      return next(error);
    }

    // Create one-way friendship (only from current user to target user)
    await prisma.friend.create({
      data: {
        userId,
        friendUserId: friendUser.userId,
        status: "active"
      },
    });

    res.json({
      success: true,
      message: "Friend added successfully",
      friend: {
        userId: friendUser.userId,
        username: friendUser.auth.username,
        name: friendUser.name,
        email: friendUser.email,
      },
    });
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2002') {
      error.name = "ConflictError";
      error.message = "Sudah berteman";
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

// 4. Add Friend by User ID (existing endpoint) (tidak dipakai)
router.post("/add", authenticateToken, async (req, res) => {
  try {
    const { friendUserId } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!friendUserId) {
      return res.status(400).json({ error: "Friend user ID required" });
    }

    if (friendUserId === userId) {
      return res.status(400).json({ error: "Cannot add yourself as friend" });
    }

    // Check if user exists
    const friendUser = await prisma.user.findUnique({
      where: { userId: friendUserId },
      select: { userId: true, name: true, email: true },
    });

    if (!friendUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if you already added this user
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId,
      },
    });

    if (existingFriendship) {
      return res.status(400).json({ error: "Already added to your friends" });
    }

    // Create one-way friendship (only from current user to target user)
    await prisma.friend.create({
      data: {
        userId,
        friendUserId,
        status: "active"
      },
    });

    // No notification needed for one-way friendship

    res.json({
      message: "Friend added successfully",
      friend: {
        userId: friendUser.userId,
        name: friendUser.name,
        email: friendUser.email,
      },
    });
  } catch (error) {
    console.error("Add friend error:", error);
    res.status(500).json({ error: "Failed to add friend" });
  }
});

// 5. Remove Friend
router.delete("/remove/:friendUserId", authenticateToken, async (req, res, next) => {
  try {
    const { friendUserId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Validate required dependencies
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

    // Validate input
    if (!friendUserId) {
      const error = new Error("ID teman dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if friend user exists
    const friendUser = await prisma.user.findUnique({
      where: { userId: friendUserId },
      select: { userId: true },
    });

    if (!friendUser) {
      const error = new Error("User tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    // Check if friendship exists
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId,
      },
    });

    if (!existingFriendship) {
      const error = new Error("User bukan teman Anda");
      error.name = "NotFoundError";
      return next(error);
    }

    // Remove one-way friendship (only from current user)
    await prisma.friend.deleteMany({
      where: {
        userId,
        friendUserId,
      },
    });

    res.json({ message: "Friend removed successfully" });
  } catch (error) {
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Pertemanan tidak ditemukan";
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