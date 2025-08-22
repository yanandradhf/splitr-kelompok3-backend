// Notification Service for Group Events
class NotificationService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // Send group invitation notification
  async sendGroupInvitation(memberIds, groupId, groupName, creatorName) {
    const notifications = memberIds.map(memberId => ({
      userId: memberId,
      groupId,
      type: "group_invitation",
      title: "Added to Group",
      message: `You were added to group '${groupName}' by ${creatorName}`,
      metadata: {
        groupName,
        creatorName,
        action: "view_group"
      }
    }));

    await this.prisma.notification.createMany({
      data: notifications
    });
  }

  // Send member joined notification to creator
  async sendMemberJoined(creatorId, groupId, groupName, memberName) {
    await this.prisma.notification.create({
      data: {
        userId: creatorId,
        groupId,
        type: "group_member_joined",
        title: "New Member Joined",
        message: `${memberName} joined group '${groupName}'`,
        metadata: {
          groupName,
          memberName
        }
      }
    });
  }

  // Send member left notification to creator
  async sendMemberLeft(creatorId, groupId, groupName, memberName) {
    await this.prisma.notification.create({
      data: {
        userId: creatorId,
        groupId,
        type: "group_member_left",
        title: "Member Left Group",
        message: `${memberName} left group '${groupName}'`,
        metadata: {
          groupName,
          memberName
        }
      }
    });
  }

  // Send member removed notification
  async sendMemberRemoved(memberId, groupId, groupName, creatorName) {
    await this.prisma.notification.create({
      data: {
        userId: memberId,
        groupId,
        type: "group_member_removed",
        title: "Removed from Group",
        message: `You were removed from group '${groupName}' by ${creatorName}`,
        metadata: {
          groupName,
          creatorName
        }
      }
    });
  }

  // Send group updated notification to all members
  async sendGroupUpdated(memberIds, groupId, groupName, creatorName) {
    const notifications = memberIds.map(memberId => ({
      userId: memberId,
      groupId,
      type: "group_updated",
      title: "Group Updated",
      message: `Group '${groupName}' was updated by ${creatorName}`,
      metadata: {
        groupName,
        creatorName
      }
    }));

    await this.prisma.notification.createMany({
      data: notifications
    });
  }

  // Send group deleted notification to all members
  async sendGroupDeleted(memberIds, groupName, creatorName) {
    const notifications = memberIds.map(memberId => ({
      userId: memberId,
      type: "group_deleted",
      title: "Group Deleted",
      message: `Group '${groupName}' was deleted by ${creatorName}`,
      metadata: {
        groupName,
        creatorName
      }
    }));

    await this.prisma.notification.createMany({
      data: notifications
    });
  }

  // Send friend added notification
  async sendFriendAdded(friendUserId, userName) {
    await this.prisma.notification.create({
      data: {
        userId: friendUserId,
        type: "friend_added",
        title: "New Friend Added",
        message: `${userName} added you as a friend`,
        metadata: {
          friendName: userName
        }
      }
    });
  }
}

module.exports = NotificationService;