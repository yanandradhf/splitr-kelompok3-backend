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

  // === BILL NOTIFICATIONS ===

  // Send bill invitation notification
  async sendBillInvitation(participantIds, billId, billName, hostName, billCode) {
    const notifications = participantIds.map(participantId => ({
      userId: participantId,
      billId,
      type: "bill_invitation",
      title: "Bill Invitation",
      message: `${hostName} invited you to split '${billName}'`,
      metadata: {
        billName,
        hostName,
        billCode,
        action: "join_bill"
      }
    }));

    await this.prisma.notification.createMany({
      data: notifications
    });
  }

  // Send bill assignment notification
  async sendBillAssignment(participantId, billId, billName, hostName, amount, billCode) {
    await this.prisma.notification.create({
      data: {
        userId: participantId,
        billId,
        type: "bill_assignment",
        title: "Bill Assignment",
        message: `${hostName} assigned you items in '${billName}' - Total: Rp ${amount.toLocaleString()}`,
        metadata: {
          billName,
          hostName,
          amount,
          billCode,
          identifier: billCode,
          action: "view_bill"
        }
      }
    });
  }

  // Send payment reminder notification
  async sendPaymentReminder(participantId, billId, billName, amount, hoursLeft) {
    await this.prisma.notification.create({
      data: {
        userId: participantId,
        billId,
        type: "payment_reminder",
        title: "Payment Reminder",
        message: `Payment for '${billName}' (Rp ${amount.toLocaleString()}) is due in ${hoursLeft} hours`,
        metadata: {
          billName,
          amount,
          hoursLeft,
          action: "pay_now"
        }
      }
    });
  }

  // Send bill expired notification
  async sendBillExpired(participantId, billId, billName, amount) {
    await this.prisma.notification.create({
      data: {
        userId: participantId,
        billId,
        type: "bill_expired",
        title: "Bill Expired",
        message: `Your payment for '${billName}' (Rp ${amount.toLocaleString()}) has expired`,
        metadata: {
          billName,
          amount,
          action: "view_bill"
        }
      }
    });
  }

  // Send payment received notification to host
  async sendPaymentReceived(hostId, billId, billName, participantName, amount) {
    await this.prisma.notification.create({
      data: {
        userId: hostId,
        billId,
        type: "payment_received",
        title: "Payment Received",
        message: `${participantName} paid Rp ${amount.toLocaleString()} for '${billName}'`,
        metadata: {
          billName,
          participantName,
          amount,
          action: "view_bill"
        }
      }
    });
  }

  // Send participant joined notification to host
  async sendParticipantJoined(hostId, billId, billName, participantName) {
    await this.prisma.notification.create({
      data: {
        userId: hostId,
        billId,
        type: "participant_joined",
        title: "New Participant",
        message: `${participantName} joined your bill '${billName}'`,
        metadata: {
          billName,
          participantName,
          action: "view_bill"
        }
      }
    });
  }

  // Send bill created notification to host
  async sendBillCreated(hostId, billId, billName, participantCount, billCode) {
    await this.prisma.notification.create({
      data: {
        userId: hostId,
        billId,
        type: "bill_created",
        title: "Bill Created",
        message: `You created '${billName}'${participantCount > 0 ? ` with ${participantCount} participant${participantCount > 1 ? 's' : ''}` : ''}`,
        metadata: {
          billName,
          participantCount,
          billCode,
          identifier: billCode,
          action: "view_bill"
        }
      }
    });
  }
}

module.exports = NotificationService;