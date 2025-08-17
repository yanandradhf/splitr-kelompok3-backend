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

// 1. Get User Groups
router.get("/", authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userId = req.user.userId;

    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { members: { some: { userId } } },
        ],
        isActive: true,
      },
      include: {
        creator: {
          select: {
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                userId: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            bills: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      groups: groups.map(group => ({
        groupId: group.groupId,
        groupName: group.groupName,
        description: group.description,
        isCreator: group.creatorId === userId,
        creatorName: group.creator.name,
        memberCount: group.members.length,
        billCount: group._count.bills,
        members: group.members.map(member => ({
          userId: member.user.userId,
          name: member.user.name,
          isCreator: member.isCreator,
          joinedAt: member.joinedAt,
        })),
        createdAt: group.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({ error: "Failed to get groups" });
  }
});

// 2. Create Group
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const { groupName, description, memberIds = [] } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!groupName) {
      return res.status(400).json({ error: "Group name required" });
    }

    const group = await prisma.group.create({
      data: {
        creatorId: userId,
        groupName,
        description,
        members: {
          create: [
            { userId, isCreator: true },
            ...memberIds.map(memberId => ({ userId: memberId })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    res.json({
      groupId: group.groupId,
      groupName: group.groupName,
      description: group.description,
      memberCount: group.members.length,
      members: group.members.map(member => ({
        userId: member.userId,
        name: member.user.name,
        isCreator: member.isCreator,
      })),
    });
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// 3. Add Member to Group
router.post("/:groupId/members", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId: newMemberId } = req.body;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!newMemberId) {
      return res.status(400).json({ error: "User ID required" });
    }

    // Check if user is group creator
    const group = await prisma.group.findFirst({
      where: {
        groupId,
        creatorId: userId,
      },
    });

    if (!group) {
      return res.status(403).json({ error: "Only group creator can add members" });
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: newMemberId,
      },
    });

    if (existingMember) {
      return res.status(400).json({ error: "User is already a member" });
    }

    // Add member
    await prisma.groupMember.create({
      data: {
        groupId,
        userId: newMemberId,
      },
    });

    res.json({ message: "Member added successfully" });
  } catch (error) {
    console.error("Add member error:", error);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// 4. Get Group Details
router.get("/:groupId", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    const group = await prisma.group.findFirst({
      where: {
        groupId,
        OR: [
          { creatorId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        creator: {
          select: {
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                userId: true,
                name: true,
                email: true,
              },
            },
          },
        },
        bills: {
          select: {
            billId: true,
            billName: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({
      groupId: group.groupId,
      groupName: group.groupName,
      description: group.description,
      isCreator: group.creatorId === userId,
      creatorName: group.creator.name,
      members: group.members.map(member => ({
        userId: member.user.userId,
        name: member.user.name,
        email: member.user.email,
        isCreator: member.isCreator,
        joinedAt: member.joinedAt,
      })),
      recentBills: group.bills,
      createdAt: group.createdAt,
    });
  } catch (error) {
    console.error("Get group details error:", error);
    res.status(500).json({ error: "Failed to get group details" });
  }
});

module.exports = router;