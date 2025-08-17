const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

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

// 1. Get Friends List
router.get("/", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

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
    console.error("Get friends error:", error);
    res.status(500).json({ error: "Failed to get friends" });
  }
});

// 2. Search Users by Username (specific search)
router.get("/search", authenticateToken, async (req, res) => {
  try {
    const { username } = req.query;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!username) {
      return res.status(400).json({ error: "Username required" });
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
      return res.status(404).json({ 
        error: "User not found",
        message: `No user found with username '${username}'`
      });
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
    console.error("Search user error:", error);
    res.status(500).json({ error: "Failed to search user" });
  }
});

// 3. Add Friend by Username
router.post("/add-by-username", authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!username) {
      return res.status(400).json({ error: "Username required" });
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
      return res.status(404).json({ 
        error: "User not found",
        message: `No user found with username '${username}'`
      });
    }

    if (friendUser.userId === userId) {
      return res.status(400).json({ error: "Cannot add yourself as friend" });
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendUserId: friendUser.userId },
          { userId: friendUser.userId, friendUserId: userId },
        ],
      },
    });

    if (existingFriendship) {
      return res.status(400).json({ 
        error: "Already friends",
        message: `You are already friends with ${friendUser.name}`
      });
    }

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    // Create bidirectional friendship
    await prisma.friend.createMany({
      data: [
        { userId, friendUserId: friendUser.userId, status: "active" },
        { userId: friendUser.userId, friendUserId: userId, status: "active" },
      ],
    });

    // Create notification for the friend
    await prisma.notification.create({
      data: {
        userId: friendUser.userId,
        type: "friend_request_accepted",
        title: "New Friend Added",
        message: `${currentUser.name} added you as a friend`,
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
    console.error("Add friend by username error:", error);
    res.status(500).json({ error: "Failed to add friend" });
  }
});

// 4. Add Friend by User ID (existing endpoint)
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

    // Check if friendship already exists
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendUserId },
          { userId: friendUserId, friendUserId: userId },
        ],
      },
    });

    if (existingFriendship) {
      return res.status(400).json({ error: "Friendship already exists" });
    }

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    // Create bidirectional friendship
    await prisma.friend.createMany({
      data: [
        { userId, friendUserId, status: "active" },
        { userId: friendUserId, friendUserId: userId, status: "active" },
      ],
    });

    // Create notification for the friend
    await prisma.notification.create({
      data: {
        userId: friendUserId,
        type: "friend_request_accepted",
        title: "New Friend Added",
        message: `${currentUser.name} added you as a friend`,
      },
    });

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
router.delete("/remove/:friendUserId", authenticateToken, async (req, res) => {
  try {
    const { friendUserId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Remove bidirectional friendship
    await prisma.friend.deleteMany({
      where: {
        OR: [
          { userId, friendUserId },
          { userId: friendUserId, friendUserId: userId },
        ],
      },
    });

    res.json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error("Remove friend error:", error);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

module.exports = router;