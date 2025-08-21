// Users & Auth Seeder - 20 Users
const bcrypt = require("bcryptjs");

async function seedUsersWithAuth(prisma) {
  const users = [];
  const userConfigs = [
    { name: "Aulia Rahman", username: "aulia", rekening: "1234567890", branch: "001" },
    { name: "Ilham Kawil", username: "ilham", rekening: "1978654321", branch: "002" },
    { name: "Timoti Siahaan", username: "timoti", rekening: "1935826578", branch: "003" },
    { name: "Ivan Luthfian", username: "ivan", rekening: "1765324215", branch: "004" },
    { name: "Andra Dhafa", username: "andra", rekening: "1954219066", branch: "005" },
    { name: "Hans Sye", username: "hans", rekening: "1423675943", branch: "001" },
    { name: "Nabila Ulhaq", username: "nabila", rekening: "1478567892", branch: "002" },
    { name: "Mom Citra", username: "momcitra", rekening: "1654328901", branch: "003" },
    { name: "Akmal Fadhil", username: "akmal", rekening: "1789456123", branch: "004" },
    { name: "Diyaa Noventino", username: "diyaa", rekening: "1987654321", branch: "005" },
    { name: "Rizki Pratama", username: "rizki", rekening: "1456789012", branch: "001" },
    { name: "Sari Dewi", username: "sari", rekening: "1321654987", branch: "002" },
    { name: "Budi Santoso", username: "budi", rekening: "1654987321", branch: "003" },
    { name: "Maya Sari", username: "maya", rekening: "1789123456", branch: "004" },
    { name: "Andi Wijaya", username: "andi", rekening: "1456123789", branch: "005" },
    { name: "Lina Permata", username: "lina", rekening: "1987456123", branch: "001" },
    { name: "Fajar Nugroho", username: "fajar", rekening: "1123456789", branch: "002" },
    { name: "Dina Kartika", username: "dina", rekening: "1654321987", branch: "003" },
    { name: "Reza Pratama", username: "reza", rekening: "1789654123", branch: "004" },
    { name: "Tika Sari", username: "tika", rekening: "1456987321", branch: "005" },
  ];

  for (let i = 0; i < userConfigs.length; i++) {
    const config = userConfigs[i];
    const user = await prisma.user.create({
      data: {
        name: config.name,
        email: `${config.username}@splitr.com`,
        phone: `+628123456${String(7890 + i).padStart(4, '0')}`,
        bniAccountNumber: config.rekening,
        bniBranchCode: config.branch,
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
        fcmToken: `fcm_token_${config.username}_${Date.now()}`,
        auth: {
          create: {
            username: config.username,
            passwordHash: await bcrypt.hash("password123", 10),
          },
        },
      },
      include: { auth: true },
    });
    users.push(user);
  }

  return users;
}

async function seedAdmin(prisma) {
  return await prisma.adminUser.create({
    data: {
      username: "admin",
      passwordHash: await bcrypt.hash("admin123", 10),
      email: "admin@splitr.com",
      role: "super_admin",
    },
  });
}

async function seedFriends(prisma, users) {
  const friendships = [];
  const pairs = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], // Aulia friends
    [1, 2], [1, 6], [1, 7], [1, 8], // Ilham friends
    [2, 3], [2, 9], [2, 10], // Timoti friends
    [3, 4], [3, 11], [3, 12], // Ivan friends
    [4, 5], [4, 13], [4, 14], // Andra friends
    [5, 6], [5, 15], [5, 16], // Hans friends
    [6, 7], [6, 17], [6, 18], // Nabila friends
    [7, 8], [7, 19], // Mom Citra friends
    [8, 9], [8, 10], // Akmal friends
    [9, 11], [9, 12], // Diyaa friends
    [10, 13], [10, 14], // Rizki friends
    [11, 15], [11, 16], // Sari friends
    [12, 17], [12, 18], // Budi friends
    [13, 19], // Maya friends
    [14, 15], // Andi friends
    [16, 17], // Fajar friends
    [18, 19], // Dina friends
  ];

  for (const [idx1, idx2] of pairs) {
    await prisma.friend.createMany({
      data: [
        {
          userId: users[idx1].userId,
          friendUserId: users[idx2].userId,
          status: "active",
        },
        {
          userId: users[idx2].userId,
          friendUserId: users[idx1].userId,
          status: "active",
        },
      ],
    });
    friendships.push(`${users[idx1].name} <-> ${users[idx2].name}`);
  }

  return friendships;
}

module.exports = { seedUsersWithAuth, seedAdmin, seedFriends };