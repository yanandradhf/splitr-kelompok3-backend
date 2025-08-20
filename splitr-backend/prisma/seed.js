// Main Seed File - 20 Users with Complete Data
const { PrismaClient } = require("@prisma/client");

// Import seeders
const { seedBNIBranches, seedBNIDummyAccounts } = require("./seeders/bni.seeder");
const { seedUsersWithAuth, seedAdmin, seedFriends } = require("./seeders/users.seeder");
const { seedCategories } = require("./seeders/categories.seeder");

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting fresh seed process with 20 users...\n");

  // 1. BNI Setup
  console.log("🏦 Setting up BNI data...");
  await seedBNIBranches(prisma);
  await seedBNIDummyAccounts(prisma);

  // 2. Categories
  console.log("📂 Creating categories...");
  const categories = await seedCategories(prisma);

  // 3. Users with Auth
  console.log("👥 Creating 20 users with authentication...");
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
  console.log("💳 Generating massive transactions...");
  const transactions = await seedMassiveTransactions(users, bills);

  // 9. Notifications
  console.log("🔔 Creating notifications for all users...");
  await seedNotifications(users, bills);

  // 10. Summary
  await printSummary();
}

async function seedGroups(users) {
  const groups = [];

  // Each of first 10 users creates 1 group and joins 1 other group
  const groupConfigs = [
    { creator: 0, name: "Aulia's Squad", desc: "Aulia's group", members: [0, 1, 2] },
    { creator: 1, name: "Ilham's Crew", desc: "Ilham's group", members: [1, 3, 4] },
    { creator: 2, name: "Timoti's Gang", desc: "Timoti's group", members: [2, 5, 6] },
    { creator: 3, name: "Ivan's Team", desc: "Ivan's group", members: [3, 7, 8] },
    { creator: 4, name: "Andra's Club", desc: "Andra's group", members: [4, 9, 0] },
    { creator: 5, name: "Hans's Group", desc: "Hans's group", members: [5, 1, 7] },
    { creator: 6, name: "Nabila's Circle", desc: "Nabila's group", members: [6, 2, 8] },
    { creator: 7, name: "Mom Citra's Family", desc: "Mom Citra's group", members: [7, 3, 9] },
    { creator: 8, name: "Akmal's Friends", desc: "Akmal's group", members: [8, 4, 5] },
    { creator: 9, name: "Diyaa's Buddies", desc: "Diyaa's group", members: [9, 6, 0] },
  ];

  for (const config of groupConfigs) {
    const group = await prisma.group.create({
      data: {
        creatorId: users[config.creator].userId,
        groupName: config.name,
        description: config.desc,
        members: {
          create: config.members.map(idx => ({
            userId: users[idx].userId,
            isCreator: idx === config.creator
          }))
        },
      },
    });
    groups.push(group);
  }

  return groups;
}

async function seedBills(users, groups, categories) {
  const bills = [];
  const billTemplates = [
    { host: 0, group: 0, cat: 0, name: "Pizza Party Office", amount: 450000, items: [["Pizza Large", 150000, 2], ["Pasta", 75000, 2], ["Garlic Bread", 25000, 4]] },
    { host: 1, group: 1, cat: 0, name: "Brunch Weekend", amount: 320000, items: [["Pancakes", 45000, 4], ["Coffee", 25000, 8], ["Juice", 15000, 4]] },
    { host: 2, group: 2, cat: 0, name: "Sushi Dinner", amount: 680000, items: [["Salmon Roll", 85000, 4], ["Tuna Sashimi", 95000, 2], ["Miso Soup", 25000, 6]] },
    { host: 3, group: 3, cat: 1, name: "Cinema XXI", amount: 240000, items: [["Movie Tickets", 50000, 4], ["Popcorn", 35000, 2], ["Drinks", 25000, 4]] },
    { host: 4, group: 4, cat: 2, name: "Uber to Airport", amount: 180000, items: [["Uber XL", 180000, 1]] },
    { host: 5, group: 5, cat: 1, name: "Gaming Cafe", amount: 200000, items: [["PC Gaming 4h", 40000, 5]] },
    { host: 6, group: 6, cat: 3, name: "Study Materials", amount: 150000, items: [["Books", 75000, 2]] },
    { host: 7, group: 7, cat: 0, name: "Protein Shake", amount: 120000, items: [["Whey Protein", 60000, 2]] },
    { host: 8, group: 0, cat: 0, name: "McDonald's", amount: 85000, items: [["Big Mac", 45000, 1], ["Fries", 20000, 2]] },
    { host: 9, group: 1, cat: 1, name: "Karaoke Night", amount: 300000, items: [["Room 3h", 150000, 1], ["Snacks", 75000, 2]] },
    { host: 10, group: 2, cat: 0, name: "Starbucks", amount: 180000, items: [["Frappuccino", 45000, 4]] },
    { host: 11, group: 3, cat: 2, name: "Grab to Mall", amount: 45000, items: [["GrabCar", 45000, 1]] },
    { host: 12, group: 4, cat: 0, name: "Bakso Malang", amount: 120000, items: [["Bakso Special", 30000, 4]] },
    { host: 13, group: 5, cat: 1, name: "Bowling", amount: 200000, items: [["Bowling 2h", 100000, 1], ["Shoes", 25000, 4]] },
    { host: 14, group: 6, cat: 3, name: "Stationery", amount: 95000, items: [["Notebooks", 25000, 2], ["Pens", 15000, 3]] },
    { host: 15, group: 7, cat: 0, name: "Healthy Lunch", amount: 160000, items: [["Salad Bowl", 40000, 4]] },
    { host: 16, group: 0, cat: 2, name: "Taxi Split", amount: 75000, items: [["Blue Bird", 75000, 1]] },
    { host: 17, group: 1, cat: 0, name: "Ice Cream", amount: 80000, items: [["Gelato", 20000, 4]] },
    { host: 18, group: 2, cat: 1, name: "Concert Tickets", amount: 800000, items: [["VIP Tickets", 200000, 4]] },
    { host: 19, group: 3, cat: 0, name: "BBQ Party", amount: 500000, items: [["Meat", 200000, 1], ["Vegetables", 100000, 1], ["Charcoal", 50000, 1]] },
  ];

  for (let i = 0; i < billTemplates.length; i++) {
    const template = billTemplates[i];
    const daysAgo = Math.floor(Math.random() * 30);
    const createdDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    const bill = await prisma.bill.create({
      data: {
        hostId: users[template.host].userId,
        groupId: groups[template.group]?.groupId,
        categoryId: categories[template.cat].categoryId,
        billName: template.name,
        billCode: `BILL${String(i + 1).padStart(3, '0')}`,
        totalAmount: template.amount,
        maxPaymentDate: new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: Math.random() > 0.3 ? "completed" : "active",
        splitMethod: "equal",
        createdAt: createdDate,
        billItems: {
          create: template.items.map(([name, price, qty]) => ({
            itemName: name,
            price: price,
            quantity: qty,
            isVerified: true
          }))
        },
      },
    });
    bills.push(bill);
  }

  return bills;
}

async function seedMassiveTransactions(users, bills) {
  const transactions = [];
  const branches = ["001", "002", "003", "004", "005"];

  for (const bill of bills) {
    const participantCount = Math.floor(Math.random() * 4) + 2; // 2-5 participants
    const amountPerPerson = Math.floor(bill.totalAmount / participantCount);
    
    // Create participants
    const participants = [];
    const selectedUsers = [];
    
    // Always include the host
    selectedUsers.push(bill.hostId);
    
    // Add random participants
    while (selectedUsers.length < participantCount) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      if (!selectedUsers.includes(randomUser.userId)) {
        selectedUsers.push(randomUser.userId);
      }
    }

    for (const userId of selectedUsers) {
      const paymentStatus = Math.random() > 0.1 ? "paid" : "pending";
      const paidAt = paymentStatus === "paid" ? new Date(bill.createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null;
      
      const participant = await prisma.billParticipant.create({
        data: {
          billId: bill.billId,
          userId: userId,
          amountShare: amountPerPerson,
          paymentStatus: paymentStatus,
          paidAt: paidAt
        }
      });
      participants.push(participant);

      // Create payment if paid
      if (paymentStatus === "paid") {
        const fromBranch = branches[Math.floor(Math.random() * branches.length)];
        const toBranch = branches[Math.floor(Math.random() * branches.length)];
        
        const payment = await prisma.payment.create({
          data: {
            billId: bill.billId,
            userId: userId,
            amount: amountPerPerson,
            paymentMethod: "BNI_TRANSFER",
            paymentType: "instant",
            status: "completed",
            transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
            bniReferenceNumber: `BNI${Math.random().toString(36).substr(2, 8)}`,
            fromBranch: fromBranch,
            toBranch: toBranch,
            paidAt: paidAt,
            createdAt: bill.createdAt
          },
        });
        transactions.push(payment);
      }
    }
  }

  // Generate additional historical transactions
  for (let i = 0; i < 15000; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomBill = bills[Math.floor(Math.random() * bills.length)];
    const amount = Math.floor(Math.random() * 200000) + 10000;
    const daysAgo = Math.floor(Math.random() * 90);
    const transactionDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    const payment = await prisma.payment.create({
      data: {
        billId: randomBill.billId,
        userId: randomUser.userId,
        amount: amount,
        paymentMethod: "BNI_TRANSFER",
        paymentType: Math.random() > 0.8 ? "scheduled" : "instant",
        status: Math.random() > 0.05 ? "completed" : "failed",
        transactionId: `TXN${Date.now()}${i}${Math.random().toString(36).substr(2, 3)}`,
        bniReferenceNumber: `BNI${Math.random().toString(36).substr(2, 8)}`,
        fromBranch: branches[Math.floor(Math.random() * branches.length)],
        toBranch: branches[Math.floor(Math.random() * branches.length)],
        paidAt: transactionDate,
        createdAt: transactionDate
      },
    });
    transactions.push(payment);
  }

  return transactions;
}

async function seedNotifications(users, bills) {
  const notificationTypes = [
    "payment_reminder", "payment_success", "payment_failed", 
    "bill_created", "bill_completed", "user_joined", "follow_up"
  ];
  
  const messages = {
    payment_reminder: ["Don't forget to pay your share!", "Payment reminder for", "Your payment is due soon"],
    payment_success: ["Payment successful!", "Your payment has been processed", "Payment completed"],
    payment_failed: ["Payment failed", "Unable to process payment", "Payment error occurred"],
    bill_created: ["New bill created", "You've been added to a bill", "Bill invitation"],
    bill_completed: ["Bill completed!", "All payments received", "Bill settled successfully"],
    user_joined: ["New participant joined", "Someone joined your bill", "Participant added"],
    follow_up: ["Follow up needed", "Action required", "Please check your bill"]
  };

  // Create notifications for first 10 users (aulia through diyaa)
  for (let userIndex = 0; userIndex < 10; userIndex++) {
    const user = users[userIndex];
    const notifCount = Math.floor(Math.random() * 6) + 5; // 5-10 notifications
    
    for (let i = 0; i < notifCount; i++) {
      const randomBill = bills[Math.floor(Math.random() * bills.length)];
      const randomType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
      const randomMessage = messages[randomType][Math.floor(Math.random() * messages[randomType].length)];
      const daysAgo = Math.floor(Math.random() * 14);
      const notifDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      
      await prisma.notification.create({
        data: {
          userId: user.userId,
          billId: randomBill.billId,
          type: randomType,
          title: randomMessage,
          message: `${randomMessage} for '${randomBill.billName}'`,
          isRead: Math.random() > 0.3,
          createdAt: notifDate,
          sentAt: notifDate
        }
      });
    }
  }
}

async function printSummary() {
  const stats = {
    users: await prisma.user.count(),
    bills: await prisma.bill.count(),
    transactions: await prisma.payment.count(),
    notifications: await prisma.notification.count(),
    groups: await prisma.group.count(),
    friends: await prisma.friend.count(),
    totalAmount: await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "completed" },
    }),
    successRate: await prisma.payment.aggregate({
      _count: { status: true },
      where: { status: "completed" },
    }),
    totalPayments: await prisma.payment.count(),
  };

  const successPercentage = ((stats.successRate._count.status / stats.totalPayments) * 100).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 SPLITR MASSIVE SEEDED - READY FOR TESTING!");
  console.log("=".repeat(60));
  console.log(`\n📊 Complete Stats:`);
  console.log(`   👥 Users: ${stats.users}`);
  console.log(`   👫 Groups: ${stats.groups}`);
  console.log(`   🤝 Friendships: ${stats.friends}`);
  console.log(`   💰 Bills: ${stats.bills}`);
  console.log(`   💳 Transactions: ${stats.transactions}`);
  console.log(`   🔔 Notifications: ${stats.notifications}`);
  console.log(`   💵 Total Amount: Rp ${stats.totalAmount._sum.amount?.toLocaleString() || 0}`);
  console.log(`   ✅ Success Rate: ${successPercentage}%`);
  console.log(`\n🔐 First 10 Users (each in 2 groups, with notifications):`);
  console.log(`   📱 Mobile: aulia, ilham, timoti, ivan, andra, hans, nabila, momcitra, akmal, diyaa`);
  console.log(`   👨💼 Admin: admin (admin123)`);
  console.log(`\n🚀 Ready for:`);
  console.log(`   • Mobile App Testing`);
  console.log(`   • Admin Dashboard`);
  console.log(`   • Analytics & Reports`);
  console.log("\n" + "=".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });