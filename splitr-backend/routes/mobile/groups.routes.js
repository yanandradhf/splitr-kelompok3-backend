const express = require("express");
const jwt = require("jsonwebtoken");
const NotificationService = require("../../services/notification.service");
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

    // Get creator info for notifications
    const creator = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    // Validate that memberIds are from user's friends
    const friendIds = await prisma.friend.findMany({
      where: { userId },
      select: { friendUserId: true },
    });
    const validFriendIds = friendIds.map(f => f.friendUserId);
    const invalidMembers = memberIds.filter(id => !validFriendIds.includes(id));
    
    if (invalidMembers.length > 0) {
      return res.status(400).json({ 
        error: "Can only add friends to group",
        message: "Some selected users are not in your friends list"
      });
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

    // Send notifications to added members
    const notificationService = new NotificationService(prisma);
    await notificationService.sendGroupInvitation(
      memberIds,
      group.groupId,
      groupName,
      creator.name
    );

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

    // Validate that new member is a friend
    const friendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId: newMemberId,
      },
    });

    if (!friendship) {
      return res.status(400).json({ 
        error: "Can only add friends to group",
        message: "User must be in your friends list to be added to group"
      });
    }

    // Add member
    await prisma.groupMember.create({
      data: {
        groupId,
        userId: newMemberId,
      },
    });

    // Get user info for notifications
    const [creator, newMember] = await Promise.all([
      prisma.user.findUnique({
        where: { userId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { userId: newMemberId },
        select: { name: true },
      }),
    ]);

    // Send notifications
    const notificationService = new NotificationService(prisma);
    await notificationService.sendGroupInvitation(
      [newMemberId],
      group.groupId,
      group.groupName,
      creator.name
    );

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

    // Get user info for notifications
    const [creator, removedMember] = await Promise.all([
      prisma.user.findUnique({
        where: { userId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { userId: memberIdToDelete },
        select: { name: true },
      }),
    ]);

    // Delete the member
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId: groupId,
          userId: memberIdToDelete,
        },
      },
    });

    // Send notification to removed member
    const notificationService = new NotificationService(prisma);
    await notificationService.sendMemberRemoved(
      memberIdToDelete,
      group.groupId,
      group.groupName,
      creator.name
    );

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({ error: "Failed to remove member" });
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

    // Get user's friends to show friendship status
    const userFriends = await prisma.friend.findMany({
      where: { userId },
      select: { friendUserId: true },
    });
    const friendIds = userFriends.map(f => f.friendUserId);

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
        isCurrentUser: member.user.userId === userId,
        isFriend: friendIds.includes(member.user.userId),
        canAddFriend: member.user.userId !== userId && !friendIds.includes(member.user.userId),
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
                userId: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Get creator info and send notifications to all members except creator
    const creator = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    const memberIds = updatedGroup.members
      .filter(member => member.userId !== userId)
      .map(member => member.userId);

    if (memberIds.length > 0) {
      const notificationService = new NotificationService(prisma);
      await notificationService.sendGroupUpdated(
        memberIds,
        updatedGroup.groupId,
        updatedGroup.groupName,
        creator.name
      );
    }

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

// 6. Add Friend from Group Member
router.post("/:groupId/add-friend/:memberId", authenticateToken, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Verify user is in the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this group" });
    }

    // Verify target user is also in the group
    const targetMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: memberId,
      },
    });

    if (!targetMembership) {
      return res.status(404).json({ error: "Target user is not in this group" });
    }

    if (memberId === userId) {
      return res.status(400).json({ error: "Cannot add yourself as friend" });
    }

    // Check if already friends
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId: memberId,
      },
    });

    if (existingFriendship) {
      return res.status(400).json({ error: "Already friends" });
    }

    // Add as friend (one-way)
    await prisma.friend.create({
      data: {
        userId,
        friendUserId: memberId,
        status: "active"
      },
    });

    // No notification needed for one-way friendship

    res.json({ message: "Friend added successfully" });
  } catch (error) {
    console.error("Add friend from group error:", error);
    res.status(500).json({ error: "Failed to add friend" });
  }
});

// 7. Leave Group (for members)
router.post("/:groupId/leave", authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Get group info
    const group = await prisma.group.findUnique({
      where: { groupId },
      select: {
        groupId: true,
        groupName: true,
        creatorId: true,
      },
    });

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Prevent creator from leaving (they must delete group instead)
    if (group.creatorId === userId) {
      return res.status(400).json({ 
        error: "Group creator cannot leave",
        message: "As the creator, you must delete the group instead of leaving it"
      });
    }

    // Check if user is a member
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!membership) {
      return res.status(404).json({ error: "You are not a member of this group" });
    }

    // Remove user from group
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    // Get user info for notification
    const user = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    // Notify creator
    const notificationService = new NotificationService(prisma);
    await notificationService.sendMemberLeft(
      group.creatorId,
      group.groupId,
      group.groupName,
      user.name
    );

    res.json({ message: "Left group successfully" });
  } catch (error) {
    console.error("Leave group error:", error);
    res.status(500).json({ error: "Failed to leave group" });
  }
});

// 8. Delete Group
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

    // Get group info and members for notifications
    const groupWithMembers = await prisma.group.findUnique({
      where: { groupId },
      include: {
        members: {
          select: {
            userId: true,
          },
        },
      },
    });

    const creator = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    const memberIds = groupWithMembers.members
      .filter(member => member.userId !== userId)
      .map(member => member.userId);

    // Send notifications before deleting
    if (memberIds.length > 0) {
      const notificationService = new NotificationService(prisma);
      await notificationService.sendGroupDeleted(
        memberIds,
        groupToDelete.groupName || groupWithMembers.groupName,
        creator.name
      );
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