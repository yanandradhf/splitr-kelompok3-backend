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

    if (memberIds.length === 0) {
      return res.status(400).json({ error: "At least one member must be added besides the creator." });
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

// 3.1. Delete group member before finalizing
router.delete("/:groupId/members/:userId", authenticateToken, async (req, res) => {
  try {
    const { groupId, userId: memberIdToDelete } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    if (!memberIdToDelete) {
      return res.status(400).json({ error: "Member ID is required" });
    }

    // Check if the user is the group creator
    const group = await prisma.group.findFirst({
      where: {
        groupId,
        creatorId: userId,
      },
    });

    if (!group) {
      return res.status(403).json({ error: "Only the group creator can remove members" });
    }

    // Check if the member to be deleted actually exists in the group
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: memberIdToDelete,
      },
    });

    if (!existingMember) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    // Prevent the creator from deleting themselves
    if (userId === memberIdToDelete) {
      return res.status(400).json({ error: "Group creator cannot delete themselves. They must delete the group instead." });
    }

    // Delete the member
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId: groupId,
          userId: memberIdToDelete,
        },
      },
    });

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// 3.2. Leave Group
router.delete("/leave/:groupId", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId; // The ID of the authenticated user

    // 1. Check if the user trying to leave is the group creator
    const group = await prisma.group.findFirst({
      where: {
        groupId,
        creatorId: userId,
      },
    });

    if (group) {
      // If the user is the creator, they cannot "leave" but must delete the group
      return res.status(400).json({ error: "Group creator cannot leave the group. You must delete the group instead." });
    }

    // 2. Check if the user is actually a member of this group
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: userId, // Check for the authenticated user's membership
      },
    });

    if (!existingMember) {
      return res.status(404).json({ error: "You are not a member of this group." });
    }

    // 3. Delete the member's record, effectively making them leave the group
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId: groupId,
          userId: userId,
        },
      },
    });
    res.json({ message: "Successfully left the group." });
  } catch (error) {
    console.error("Leave group error:", error);
    res.status(500).json({ error: "Failed to leave group" });
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

//5. Edit Group
router.patch("/edit/:groupId", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params; 
    const { groupName, description } = req.body; 
    const prisma = req.prisma;
    const userId = req.user.userId; 

    if (!groupName && !description) {
      return res.status(400).json({ error: "No fields provided for update. Please provide groupName or description." });
    }


    const existingGroup = await prisma.group.findUnique({
      where: {
        groupId: groupId, 
      },
      select: {
        creatorId: true, 
      },
    });

    if (!existingGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (existingGroup.creatorId !== userId) {
      return res.status(403).json({ error: "Only the group creator can edit this group" });
    }

    const updateData = {};
    if (groupName !== undefined) { 
      updateData.groupName = groupName;
    }
    if (description !== undefined) { 
      updateData.description = description;
    }

    const updatedGroup = await prisma.group.update({
      where: {
        groupId: groupId,
      },
      data: updateData, 
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
      message: "Group updated successfully",
      groupId: updatedGroup.groupId,
      groupName: updatedGroup.groupName,
      description: updatedGroup.description,
      memberCount: updatedGroup.members.length,
      members: updatedGroup.members.map(member => ({
        userId: member.userId,
        name: member.user.name,
        isCreator: member.isCreator,
      })),
    });
  } catch (error) {
    console.error("Edit group error:", error);
    res.status(500).json({ error: "Failed to edit group" });
  }
});

// 6. Delete Group
router.delete("/delete/:groupId", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params; 
    const prisma = req.prisma;
    const userId = req.user.userId; 

    if (!groupId) {
      return res.status(400).json({ error: "Group ID required" });
    }

    const groupToDelete = await prisma.group.findUnique({
      where: {
        groupId: groupId, 
      },
      select: {
        creatorId: true, 
      },
    });

    if (!groupToDelete) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (groupToDelete.creatorId !== userId) {

      return res.status(403).json({ error: "Only the group creator can delete this group" });
    }

    await prisma.groupMember.deleteMany({
      where: {
        groupId: groupId,
      },
    });

    await prisma.group.delete({
      where: {
        groupId: groupId,
      },
    });

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

module.exports = router;