const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting comprehensive database seeding...");

  // 1. Create BNI Branches (untuk geotagging)
  console.log("📍 Creating BNI branches...");
  const branches = await Promise.all([
    prisma.bniBranch.create({
      data: {
        branchCode: "001",
        branchName: "Jakarta Thamrin",
        city: "Jakarta Pusat",
        province: "DKI Jakarta",
        latitude: -6.1944,
        longitude: 106.8229,
      },
    }),
    prisma.bniBranch.create({
      data: {
        branchCode: "002",
        branchName: "Jakarta Kemang",
        city: "Jakarta Selatan",
        province: "DKI Jakarta",
        latitude: -6.2441,
        longitude: 106.8133,
      },
    }),
    prisma.bniBranch.create({
      data: {
        branchCode: "003",
        branchName: "Jakarta Kelapa Gading",
        city: "Jakarta Utara",
        province: "DKI Jakarta",
        latitude: -6.1588,
        longitude: 106.9108,
      },
    }),
    prisma.bniBranch.create({
      data: {
        branchCode: "004",
        branchName: "Bandung Dago",
        city: "Bandung",
        province: "Jawa Barat",
        latitude: -6.9039,
        longitude: 107.6186,
      },
    }),
    prisma.bniBranch.create({
      data: {
        branchCode: "005",
        branchName: "Surabaya Darmo",
        city: "Surabaya",
        province: "Jawa Timur",
        latitude: -7.2459,
        longitude: 112.7378,
      },
    }),
  ]);

  console.log(`✅ Created ${branches.length} BNI branches`);

  // 2. Create Bill Categories
  console.log("📂 Creating bill categories...");
  const categories = await Promise.all([
    prisma.billCategory.create({
      data: {
        categoryName: "Food",
        categoryIcon: "🍽️",
      },
    }),
    prisma.billCategory.create({
      data: {
        categoryName: "Beverage",
        categoryIcon: "🥤",
      },
    }),
    prisma.billCategory.create({
      data: {
        categoryName: "Entertainment",
        categoryIcon: "🎬",
      },
    }),
    prisma.billCategory.create({
      data: {
        categoryName: "Transport",
        categoryIcon: "🚗",
      },
    }),
    prisma.billCategory.create({
      data: {
        categoryName: "Other",
        categoryIcon: "📦",
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // 3. Create Admin User
  console.log("👤 Creating admin user...");
  const adminUser = await prisma.adminUser.create({
    data: {
      username: "admin1",
      passwordHash: await bcrypt.hash("admin123", 10),
      email: "admin@splitr.bni.co.id",
      role: "super_admin",

      username: "admin2",
      passwordHash: await bcrypt.hash("admin234", 10),
      email: "admin@splitr.bni.co.id",
      role: "super_admin",
    },
  });

  console.log("✅ Created admin user (username: admin, password: admin123)");

  // 4. Create Users (seperti di mockup dashboard)
  console.log("👥 Creating users...");
  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Citra Panjaitan",
        email: "citra@email.com",
        phone: "+6281234567890",
        bniAccountNumber: "1935826578",
        bniBranchCode: "001",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Ilham Kawil",
        email: "ilham@email.com",
        phone: "+6281234567891",
        bniAccountNumber: "1978654321",
        bniBranchCode: "002",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Nabila Ulhaq",
        email: "nabila@email.com",
        phone: "+6281234567892",
        bniAccountNumber: "1954219065",
        bniBranchCode: "001",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Hans Sye",
        email: "hans@email.com",
        phone: "+6281234567893",
        bniAccountNumber: "1765324215",
        bniBranchCode: "003",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Yanan Isdi",
        email: "yanan@email.com",
        phone: "+6281234567894",
        bniAccountNumber: "1954219066",
        bniBranchCode: "004",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Diyaa Noventino",
        email: "diyaa@email.com",
        phone: "+6281234567895",
        bniAccountNumber: "1423675943",
        bniBranchCode: "005",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Ivan Luthfian",
        email: "ivan@email.com",
        phone: "+6281234567896",
        bniAccountNumber: "1478567892",
        bniBranchCode: "002",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // 5. Create Groups
  console.log("👥 Creating groups...");
  const groups = await Promise.all([
    prisma.group.create({
      data: {
        creatorId: users[1].userId, // Ilham
        groupName: "Office Friends",
        description: "Teman-teman kantor",
      },
    }),
    prisma.group.create({
      data: {
        creatorId: users[0].userId, // Citra
        groupName: "Weekend Squad",
        description: "Geng weekend",
      },
    }),
    prisma.group.create({
      data: {
        creatorId: users[4].userId, // Yanan
        groupName: "College Buddies",
        description: "Teman kuliah",
      },
    }),
  ]);

  // Add members to groups
  await Promise.all([
    // Office Friends group
    prisma.groupMember.createMany({
      data: [
        {
          groupId: groups[0].groupId,
          userId: users[1].userId,
          isCreator: true,
        },
        { groupId: groups[0].groupId, userId: users[0].userId },
        { groupId: groups[0].groupId, userId: users[2].userId },
        { groupId: groups[0].groupId, userId: users[3].userId },
      ],
    }),
    // Weekend Squad group
    prisma.groupMember.createMany({
      data: [
        {
          groupId: groups[1].groupId,
          userId: users[0].userId,
          isCreator: true,
        },
        { groupId: groups[1].groupId, userId: users[4].userId },
        { groupId: groups[1].groupId, userId: users[5].userId },
        { groupId: groups[1].groupId, userId: users[6].userId },
      ],
    }),
    // College Buddies group
    prisma.groupMember.createMany({
      data: [
        {
          groupId: groups[2].groupId,
          userId: users[4].userId,
          isCreator: true,
        },
        { groupId: groups[2].groupId, userId: users[2].userId },
        { groupId: groups[2].groupId, userId: users[3].userId },
      ],
    }),
  ]);

  console.log(`✅ Created ${groups.length} groups with members`);

  // 6. Create Bills dengan berbagai categories
  console.log("📋 Creating bills...");
  const bills = await Promise.all([
    prisma.bill.create({
      data: {
        hostId: users[1].userId, // Ilham
        groupId: groups[0].groupId,
        categoryId: categories[0].categoryId, // Food
        billName: "Restaurant Dinner Split",
        billCode: "FOOD001",
        totalAmount: 500000,
        maxPaymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: true,
        status: "active",
      },
    }),
    prisma.bill.create({
      data: {
        hostId: users[0].userId, // Citra
        groupId: groups[1].groupId,
        categoryId: categories[2].categoryId, // Entertainment
        billName: "Karaoke Night",
        billCode: "ENT001",
        totalAmount: 350000,
        maxPaymentDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: true,
        status: "active",
      },
    }),
    prisma.bill.create({
      data: {
        hostId: users[4].userId, // Yanan
        groupId: groups[2].groupId,
        categoryId: categories[3].categoryId, // Transport
        billName: "Gas Money Road Trip",
        billCode: "TRP001",
        totalAmount: 200000,
        maxPaymentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: false,
        status: "active",
      },
    }),
  ]);

  console.log(`✅ Created ${bills.length} bills`);

  // 7. Create Bill Items
  console.log("🍽️ Creating bill items...");
  await Promise.all([
    // Restaurant bill items
    prisma.billItem.createMany({
      data: [
        {
          billId: bills[0].billId,
          itemName: "Nasi Goreng Special",
          price: 75000,
          quantity: 2,
          category: "main_course",
          isVerified: true,
        },
        {
          billId: bills[0].billId,
          itemName: "Es Teh Manis",
          price: 15000,
          quantity: 4,
          category: "beverage",
          isVerified: true,
        },
        {
          billId: bills[0].billId,
          itemName: "Gado-gado",
          price: 50000,
          quantity: 2,
          category: "main_course",
          isVerified: true,
        },
      ],
    }),
    // Karaoke bill items
    prisma.billItem.createMany({
      data: [
        {
          billId: bills[1].billId,
          itemName: "Room 2 Hours",
          price: 200000,
          quantity: 1,
          category: "service",
          isVerified: true,
        },
        {
          billId: bills[1].billId,
          itemName: "Snacks Package",
          price: 100000,
          quantity: 1,
          category: "food",
          isVerified: true,
        },
        {
          billId: bills[1].billId,
          itemName: "Soft Drinks",
          price: 50000,
          quantity: 1,
          category: "beverage",
          isVerified: true,
        },
      ],
    }),
    // Transport bill items
    prisma.billItem.createMany({
      data: [
        {
          billId: bills[2].billId,
          itemName: "Gas (Pertamax)",
          price: 150000,
          quantity: 1,
          category: "fuel",
          isVerified: true,
        },
        {
          billId: bills[2].billId,
          itemName: "Toll Fee",
          price: 50000,
          quantity: 1,
          category: "toll",
          isVerified: true,
        },
      ],
    }),
  ]);

  console.log("✅ Created bill items");

  // 8. Generate Massive Transaction Data untuk Analytics (seperti dashboard: 1,247 transactions, Rp 45.2M)
  console.log("💰 Generating massive transaction data for analytics...");

  const transactionData = [];
  const startDate = new Date("2025-07-01");
  const endDate = new Date("2025-08-11");

  // Generate realistic daily transaction patterns
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const currentDate = new Date(d);
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    const isToday = currentDate.toDateString() === new Date().toDateString();

    // More transactions on weekends and today
    let dailyTransactionCount;
    if (isToday) {
      dailyTransactionCount = Math.floor(Math.random() * 50) + 1200; // 1200-1250 for today (like dashboard shows 1,247)
    } else if (isWeekend) {
      dailyTransactionCount = Math.floor(Math.random() * 20) + 40; // 40-60 on weekends
    } else {
      dailyTransactionCount = Math.floor(Math.random() * 15) + 25; // 25-40 on weekdays
    }

    for (let i = 0; i < dailyTransactionCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomBill = bills[Math.floor(Math.random() * bills.length)];
      const randomAmount = Math.floor(Math.random() * 150000) + 50000; // 50k-200k

      // 94.2% success rate like dashboard shows
      const isSuccess = Math.random() > 0.058;
      const isScheduled = Math.random() > 0.7; // 30% scheduled payments

      const transactionDateTime = new Date(currentDate);
      transactionDateTime.setHours(
        Math.floor(Math.random() * 14) + 8, // 8 AM - 10 PM
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60)
      );

      const fromBranch = randomUser.bniBranchCode;
      const toBranch =
        users[Math.floor(Math.random() * users.length)].bniBranchCode;

      if (isScheduled) {
        // Scheduled payment
        transactionData.push({
          type: "scheduled",
          billId: randomBill.billId,
          userId: randomUser.userId,
          amount: randomAmount,
          scheduledDate: new Date(
            transactionDateTime.getTime() +
              Math.random() * 7 * 24 * 60 * 60 * 1000
          ),
          status: isSuccess ? "completed" : "failed",
          fromBranch,
          toBranch,
          createdAt: transactionDateTime,
          processedAt: isSuccess ? transactionDateTime : null,
        });
      } else {
        // Instant payment
        transactionData.push({
          type: "instant",
          billId: randomBill.billId,
          userId: randomUser.userId,
          amount: randomAmount,
          paymentMethod: "BNI_TRANSFER",
          paymentType: "instant",
          status: isSuccess ? "completed" : "failed",
          transactionId: `TXN-${currentDate.getFullYear()}-${String(
            currentDate.getMonth() + 1
          ).padStart(2, "0")}${String(currentDate.getDate()).padStart(
            2,
            "0"
          )}-${String(i).padStart(4, "0")}`,
          bniReferenceNumber: isSuccess ? `BNI-REF-${Date.now()}-${i}` : null,
          fromBranch,
          toBranch,
          paidAt: isSuccess ? transactionDateTime : null,
          createdAt: transactionDateTime,
        });
      }
    }
  }

  // Batch insert payments
  const instantPayments = transactionData
    .filter((t) => t.type === "instant")
    .map((t) => ({
      billId: t.billId,
      userId: t.userId,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
      paymentType: t.paymentType,
      status: t.status,
      transactionId: t.transactionId,
      bniReferenceNumber: t.bniReferenceNumber,
      fromBranch: t.fromBranch,
      toBranch: t.toBranch,
      paidAt: t.paidAt,
      createdAt: t.createdAt,
    }));

  const scheduledPayments = transactionData
    .filter((t) => t.type === "scheduled")
    .map((t) => ({
      billId: t.billId,
      userId: t.userId,
      amount: t.amount,
      scheduledDate: t.scheduledDate,
      status: t.status,
      fromBranch: t.fromBranch,
      toBranch: t.toBranch,
      createdAt: t.createdAt,
      processedAt: t.processedAt,
    }));

  await prisma.payment.createMany({ data: instantPayments });
  await prisma.scheduledPayment.createMany({ data: scheduledPayments });

  console.log(`✅ Created ${instantPayments.length} instant payments`);
  console.log(`✅ Created ${scheduledPayments.length} scheduled payments`);

  // 9. Summary Statistics
  const totalTransactions = instantPayments.length + scheduledPayments.length;
  const totalAmount = transactionData.reduce(
    (sum, t) => sum + parseFloat(t.amount),
    0
  );
  const successfulTransactions = transactionData.filter(
    (t) => t.status === "completed"
  ).length;
  const successRate = (
    (successfulTransactions / totalTransactions) *
    100
  ).toFixed(1);

  console.log("\n🎉 Database seeding completed!");
  console.log("📊 Statistics:");
  console.log(`   👥 Users: ${users.length}`);
  console.log(`   👨‍👩‍👧‍👦 Groups: ${groups.length}`);
  console.log(`   📋 Bills: ${bills.length}`);
  console.log(`   📂 Categories: ${categories.length}`);
  console.log(`   🏢 Branches: ${branches.length}`);
  console.log(
    `   💰 Total Transactions: ${totalTransactions.toLocaleString()}`
  );
  console.log(`   💵 Total Amount: Rp ${totalAmount.toLocaleString()}`);
  console.log(`   ✅ Success Rate: ${successRate}%`);
  console.log(`   👤 Admin: username=admin, password=admin123`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
