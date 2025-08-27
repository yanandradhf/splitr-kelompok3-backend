const express = require("express");
const jwt = require("jsonwebtoken");
const NotificationService = require("../../services/notification.service");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

// Import secure authentication middleware
const { authenticateSecure } = require('../../middleware/auth.middleware');

// Use secure authentication for all friend routes
const authenticateToken = authenticateSecure;

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
            profilePhotoUrl: true,
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
          profilePhotoUrl: friendship.friend.profilePhotoUrl || null,
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
        profilePhotoUrl: true,
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
        accountNumber: user.bniAccountNumber,
        profilePhotoUrl: user.profilePhotoUrl || null,
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
      return res.status(400).json({ 
        error: "User not found",
        message: `No user found with username '${username}'`
      });
    }

    if (friendUser.userId === userId) {
      return res.status(400).json({ error: "Cannot add yourself as friend" });
    }

    // Check if you already added this user
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId: friendUser.userId,
      },
    });

    if (existingFriendship) {
      return res.status(400).json({ 
        error: "Already added",
        message: `You already added ${friendUser.name} to your friends`
      });
    }

    // Create one-way friendship (only from current user to target user)
    await prisma.friend.create({
      data: {
        userId,
        friendUserId: friendUser.userId,
        status: "active"
      },
    });

    // No notification needed for one-way friendship

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
router.delete("/remove/:friendUserId", authenticateToken, async (req, res) => {
  try {
    const { friendUserId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Remove one-way friendship (only from current user)
    await prisma.friend.deleteMany({
      where: {
        userId,
        friendUserId,
      },
    });

    res.json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error("Remove friend error:", error);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

module.exports = router;