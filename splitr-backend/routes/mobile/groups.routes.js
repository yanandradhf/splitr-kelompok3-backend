const express = require("express");
const jwt = require("jsonwebtoken");
const NotificationService = require("../../services/notification.service");
const router = express.Router();

// Import error handlers
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

// 1. Get User Groups
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

// 2. Create Group
router.post("/create", authenticateToken, async (req, res, next) => {
  try {
    const { groupName, description, memberIds = [] } = req.body;
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
    if (!groupName) {
      const error = new Error("Nama grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    if (!memberIds || memberIds.length === 0) {
      const error = new Error("Perlu 1 anggota lain selain pembuat untuk membuat grup");
      error.name = "ValidationError";
      return next(error);
    }

    // Get creator info for notifications
    const creator = await prisma.user.findUnique({
      where: { userId },
      select: { name: true },
    });

    if (!creator) {
      const error = new Error("Pembuat grup tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    // Validate that memberIds are from user's friends
    const friendIds = await prisma.friend.findMany({
      where: { userId },
      select: { friendUserId: true },
    });
    const validFriendIds = friendIds.map(f => f.friendUserId);
    const invalidMembers = memberIds.filter(id => !validFriendIds.includes(id));
    
    if (invalidMembers.length > 0) {
      const error = new Error("Hanya bisa menambahkan teman ke grup");
      error.name = "ValidationError";
      return next(error);
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

// 3. Add Member to Group
router.post("/:groupId/members", authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { userId: newMemberId } = req.body;
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
    if (!groupId) {
      const error = new Error("ID grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    if (!newMemberId) {
      const error = new Error("ID User dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Prevent creator from adding themselves
    if (newMemberId === userId) {
      const error = new Error("Pembuat grup tidak bisa menambahkan diri sendiri");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if user is group creator
    const group = await prisma.group.findFirst({
      where: {
        groupId,
        creatorId: userId,
      },
    });

    if (!group) {
      const error = new Error("Hanya pembuat grup yang dapat menambahkan anggota");
      error.name = "ForbiddenError";
      return next(error);
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: newMemberId,
      },
    });

    if (existingMember) {
      const error = new Error("User sudah menjadi member di grup ini");
      error.name = "ConflictError";
      return next(error);
    }

    // Validate that new member is a friend
    const friendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId: newMemberId,
      },
    });

    if (!friendship) {
      const error = new Error("Hanya bisa menambahkan teman ke grup");
      error.name = "ValidationError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2002') {
      error.name = "ConflictError";
      error.message = "User is already a member of this group";
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

// 3.1. Delete group member (by creator)
router.delete("/:groupId/members/:userId", authenticateToken, async (req, res, next) => {
  try {
    const { groupId, userId: memberIdToDelete } = req.params;
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
    if (!groupId) {
      const error = new Error("ID grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    if (!memberIdToDelete) {
      const error = new Error("ID member dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if the user is the group creator
    const group = await prisma.group.findFirst({
      where: {
        groupId,
        creatorId: userId,
      },
    });

    if (!group) {
      const error = new Error("Hanya pembuat grup yang dapat menghapus anggota");
      error.name = "ForbiddenError";
      return next(error);
    }

    // Check if the member to be deleted actually exists in the group
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: memberIdToDelete,
      },
    });

    if (!existingMember) {
      const error = new Error("Member tidak ditemukan di grup ini");
      error.name = "NotFoundError";
      return next(error);
    }

    // Prevent the creator from deleting themselves
    if (userId === memberIdToDelete) {
      const error = new Error("Pembuat grup tidak bisa menghapus diri sendiri. Hapus grup sebagai gantinya.");
      error.name = "ValidationError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Member atau grup tidak ditemukan";
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

// 3.2. Leave Group (tidak dipakai)
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
router.get("/:groupId", authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
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
    if (!groupId) {
      const error = new Error("ID grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

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
      const error = new Error("Grup tidak ditemukan atau Anda tidak memiliki akses");
      error.name = "NotFoundError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Grup tidak ditemukan";
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

//5. Edit Group
router.patch("/edit/:groupId", authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params; 
    const { groupName, description } = req.body; 
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
    if (!groupId) {
      const error = new Error("ID grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    if (!groupName && !description) {
      const error = new Error("Tidak ada field yang diupdate. Berikan groupName atau description.");
      error.name = "ValidationError";
      return next(error);
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
      const error = new Error("Grup tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    if (existingGroup.creatorId !== userId) {
      const error = new Error("Hanya pembuat grup yang dapat mengedit grup ini");
      error.name = "ForbiddenError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Grup tidak ditemukan";
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

// 6. Add Friend from Group Member
router.post("/:groupId/add-friend/:memberId", authenticateToken, async (req, res, next) => {
  try {
    const { groupId, memberId } = req.params;
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
    if (!groupId) {
      const error = new Error("ID grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    if (!memberId) {
      const error = new Error("ID member dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

    if (memberId === userId) {
      const error = new Error("Tidak bisa menambahkan diri sendiri sebagai teman");
      error.name = "ValidationError";
      return next(error);
    }

    // Verify user is in the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!membership) {
      const error = new Error("Anda bukan anggota grup ini");
      error.name = "ForbiddenError";
      return next(error);
    }

    // Verify target user is also in the group
    const targetMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: memberId,
      },
    });

    if (!targetMembership) {
      const error = new Error("User target tidak ada di grup ini");
      error.name = "NotFoundError";
      return next(error);
    }

    // Check if already friends
    const existingFriendship = await prisma.friend.findFirst({
      where: {
        userId,
        friendUserId: memberId,
      },
    });

    if (existingFriendship) {
      const error = new Error("Sudah berteman");
      error.name = "ConflictError";
      return next(error);
    }

    // Add as friend (one-way)
    await prisma.friend.create({
      data: {
        userId,
        friendUserId: memberId,
        status: "active"
      },
    });

    res.json({ message: "Friend added successfully" });
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

// 7. Leave Group (for members)
router.post("/:groupId/leave", authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params;
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
    if (!groupId) {
      const error = new Error("ID grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
    }

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
      const error = new Error("Grup tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    // Prevent creator from leaving (they must delete group instead)
    if (group.creatorId === userId) {
      const error = new Error("Pembuat grup tidak bisa keluar. Hapus grup sebagai gantinya.");
      error.name = "ValidationError";
      return next(error);
    }

    // Check if user is a member
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!membership) {
      const error = new Error("Anda bukan anggota grup ini");
      error.name = "NotFoundError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Grup atau membership tidak ditemukan";
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

// 8. Delete Group
router.delete("/delete/:groupId", authenticateToken, async (req, res, next) => {
  try {
    const { groupId } = req.params; 
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
    if (!groupId) {
      const error = new Error("ID grup dibutuhkan");
      error.name = "ValidationError";
      return next(error);
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
      const error = new Error("Grup tidak ditemukan");
      error.name = "NotFoundError";
      return next(error);
    }

    if (groupToDelete.creatorId !== userId) {
      const error = new Error("Hanya pembuat grup yang dapat menghapus grup ini");
      error.name = "ForbiddenError";
      return next(error);
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
    // Classify database errors
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
      error.message = "Grup tidak ditemukan";
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