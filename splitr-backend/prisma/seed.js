// Main Seed File - Clean & Organized
const { PrismaClient } = require("@prisma/client");

// Import seeders
const { seedBNIBranches, seedBNIDummyAccounts } = require("./seeders/bni.seeder");
const { seedUsersWithAuth, seedAdmin, seedFriends } = require("./seeders/users.seeder");
const { seedCategories } = require("./seeders/categories.seeder");

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting fresh seed process...\n");

  // 1. BNI Setup
  console.log("🏦 Setting up BNI data...");
  await seedBNIBranches(prisma);
  await seedBNIDummyAccounts(prisma);

  // 2. Categories
  console.log("📂 Creating categories...");
  const categories = await seedCategories(prisma);

  // 3. Users with Auth
  console.log("👥 Creating users with authentication...");
  const users = await seedUsersWithAuth(prisma);

  // 4. Admin
  console.log("👨💼 Creating admin user...");
  await seedAdmin(prisma);

  // 5. Friends
  console.log("🤝 Creating friendships...");
  const friendships = await seedFriends(prisma, users);

  // 6. Groups
  console.log("👫 Creating groups...");
  const groups = await seedGroups(users);

  // 7. Bills
  console.log("💰 Creating bills...");
  const bills = await seedBills(users, groups, categories);

  // 8. Transactions
  console.log("💳 Generating transactions...");
  const transactions = await seedTransactions(users, bills);

  // 9. Notifications
  console.log("🔔 Creating notifications...");
  await seedNotifications(users, bills);

  // 10. Summary
  await printSummary();
}

async function seedGroups(users) {
  const groups = [];

  const group1 = await prisma.group.create({
    data: {
      creatorId: users[0].userId,
      groupName: "Office Friends",
      description: "Teman kantor",
      members: {
        create: [
          { userId: users[0].userId, isCreator: true },
          { userId: users[1].userId },
          { userId: users[2].userId },
          { userId: users[3].userId },
        ],
      },
    },
  });
  groups.push(group1);

  const group2 = await prisma.group.create({
    data: {
      creatorId: users[1].userId,
      groupName: "Weekend Squad",
      description: "Hangout weekend",
      members: {
        create: [
          { userId: users[1].userId, isCreator: true },
          { userId: users[2].userId },
          { userId: users[4].userId },
        ],
      },
    },
  });
  groups.push(group2);

  return groups;
}

async function seedBills(users, groups, categories) {
  const bills = [];

  // Bill 1: Pizza Hut (Item Assignment)
  const bill1 = await prisma.bill.create({
    data: {
      hostId: users[0].userId,
      groupId: groups[0].groupId,
      categoryId: categories[0].categoryId,
      billName: "Lunch at Pizza Hut",
      billCode: "LUNCH01",
      receiptImageUrl: "https://splitr.app/receipts/pizza-hut-001.jpg",
      totalAmount: 402500,
      maxPaymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      allowScheduledPayment: true,
      status: "active",
      splitMethod: "item_assignment",
      billItems: {
        create: [
          { itemName: "Pizza Large", price: 150000, quantity: 2 },
          { itemName: "Pasta", price: 50000, quantity: 2 },
          { itemName: "Garlic Bread", price: 25000, quantity: 4 },
        ],
      },
      billParticipants: {
        create: [
          { userId: users[0].userId, amountShare: 100625, paymentStatus: "paid", paidAt: new Date() },
          { userId: users[1].userId, amountShare: 100625, paymentStatus: "scheduled" },
          { userId: users[2].userId, amountShare: 100625, paymentStatus: "pending" },
          { userId: users[3].userId, amountShare: 100625, paymentStatus: "paid", paidAt: new Date() },
        ],
      },
    },
  });

  // Create scheduled payment for Budi
  await prisma.scheduledPayment.create({
    data: {
      billId: bill1.billId,
      userId: users[1].userId,
      amount: 100625,
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: "scheduled",
      pinVerifiedAt: new Date(),
    },
  });

  bills.push(bill1);

  // Bill 2: Coffee (Equal Split - Completed)
  const bill2 = await prisma.bill.create({
    data: {
      hostId: users[1].userId,
      groupId: groups[1].groupId,
      categoryId: categories[1].categoryId,
      billName: "Coffee Meeting",
      billCode: "COFFEE1",
      totalAmount: 150000,
      status: "completed",
      splitMethod: "equal",
      billItems: {
        create: [
          { itemName: "Americano", price: 35000, quantity: 3 },
          { itemName: "Croissant", price: 25000, quantity: 2 },
        ],
      },
      billParticipants: {
        create: [
          { userId: users[1].userId, amountShare: 50000, paymentStatus: "paid", paidAt: new Date() },
          { userId: users[2].userId, amountShare: 50000, paymentStatus: "paid", paidAt: new Date() },
          { userId: users[4].userId, amountShare: 50000, paymentStatus: "paid", paidAt: new Date() },
        ],
      },
    },
  });
  bills.push(bill2);

  // Bill 3: Sushi (Custom Split with Temp Participants)
  const bill3 = await prisma.bill.create({
    data: {
      hostId: users[2].userId,
      categoryId: categories[0].categoryId,
      billName: "Makan Bareng Sushi Tei",
      billCode: "SUSHI01",
      totalAmount: 320000,
      status: "active",
      splitMethod: "custom",
      billItems: {
        create: [
          { itemName: "Salmon Sashimi", price: 85000, quantity: 2 },
          { itemName: "Chicken Teriyaki", price: 65000, quantity: 2 },
          { itemName: "Miso Soup", price: 15000, quantity: 4 },
        ],
      },
      billParticipants: {
        create: [
          { userId: users[2].userId, amountShare: 120000, paymentStatus: "pending" },
          { userId: users[3].userId, amountShare: 80000, paymentStatus: "pending" },
          { tempName: "Rina (Teman Kantor)", amountShare: 70000, paymentStatus: "pending" },
          { tempName: "Budi (Sepupu)", amountShare: 50000, paymentStatus: "pending" },
        ],
      },
    },
  });
  bills.push(bill3);

  return bills;
}

async function seedTransactions(users, bills) {
  const transactions = [];

  for (const bill of bills) {
    const participants = await prisma.billParticipant.findMany({
      where: { billId: bill.billId },
    });

    for (const participant of participants) {
      if (participant.paymentStatus === "paid" && participant.userId) {
        const payment = await prisma.payment.create({
          data: {
            billId: bill.billId,
            userId: participant.userId,
            amount: participant.amountShare,
            paymentMethod: "BNI_TRANSFER",
            paymentType: "instant",
            status: "completed",
            transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
            bniReferenceNumber: `BNI${Math.random().toString(36).substr(2, 8)}`,
            fromBranch: "001",
            toBranch: "002",
            paidAt: participant.paidAt,
          },
        });
        transactions.push(payment);
      } else if (participant.paymentStatus === "scheduled" && participant.userId) {
        const payment = await prisma.payment.create({
          data: {
            billId: bill.billId,
            userId: participant.userId,
            amount: participant.amountShare,
            paymentMethod: "BNI_TRANSFER",
            paymentType: "scheduled",
            status: "pending",
            transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
            bniReferenceNumber: `BNI${Math.random().toString(36).substr(2, 8)}`,
            fromBranch: "002",
            toBranch: "001",
          },
        });
        transactions.push(payment);
      }
    }
  }

  return transactions;
}

async function seedNotifications(users, bills) {
  const notifications = [
    {
      userId: users[0].userId,
      billId: bills[0].billId,
      type: "user_joined",
      title: "New Participant",
      message: "Budi has joined your bill 'Lunch at Pizza Hut'",
      isRead: false,
    },
    {
      userId: users[1].userId,
      billId: bills[0].billId,
      type: "payment_reminder",
      title: "Payment Reminder",
      message: "Don't forget to pay Rp 100,625 for 'Lunch at Pizza Hut'",
      isRead: false,
    },
  ];

  for (const data of notifications) {
    await prisma.notification.create({ data });
  }
}

async function printSummary() {
  const stats = {
    users: await prisma.user.count(),
    bills: await prisma.bill.count(),
    transactions: await prisma.payment.count(),
    totalAmount: await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "completed" },
    }),
  };

  console.log("\n" + "=".repeat(50));
  console.log("🎉 SPLITR SEEDED - READY FOR TESTING!");
  console.log("=".repeat(50));
  console.log(`\n📊 Stats:`);
  console.log(`   👥 Users: ${stats.users}`);
  console.log(`   💰 Bills: ${stats.bills}`);
  console.log(`   💳 Transactions: ${stats.transactions}`);
  console.log(`   💵 Total Amount: Rp ${stats.totalAmount._sum.amount?.toLocaleString() || 0}`);
  console.log(`\n🔐 Test Accounts:`);
  console.log(`   Mobile: ahmad/budi/citra/dian/eko (password123, PIN: 123456)`);
  console.log(`   Admin: admin (admin123)`);
  console.log("\n" + "=".repeat(50));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });