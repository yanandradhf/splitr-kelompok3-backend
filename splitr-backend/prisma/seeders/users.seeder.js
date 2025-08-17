// Users & Auth Seeder
const bcrypt = require("bcryptjs");

async function seedUsersWithAuth(prisma) {
  const users = [];
  const userConfigs = [
    { name: "Ahmad Sutanto", username: "ahmad", rekening: "1234567890" },
    { name: "Budi Santoso", username: "budi", rekening: "0987654321" },
    { name: "Citra Panjaitan", username: "citra", rekening: "1935826578" },
    { name: "Ilham Kawil", username: "ilham", rekening: "1978654321" },
    { name: "Nabila Ulhaq", username: "nabila", rekening: "1954219065" },
  ];

  for (let i = 0; i < userConfigs.length; i++) {
    const config = userConfigs[i];
    const user = await prisma.user.create({
      data: {
        name: config.name,
        email: `${config.username}@test.com`,
        phone: `+62812345678${90 + i}`,
        bniAccountNumber: config.rekening,
        bniBranchCode: "001",
        encryptedPinHash: await bcrypt.hash("123456", 10),
        isVerified: true,
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
    [0, 1], [0, 2], [0, 3], // Ahmad friends with Budi, Citra, Dian
    [1, 2], [1, 4], // Budi friends with Citra, Eko
    [2, 3], [2, 4], // Citra friends with Dian, Eko
    [3, 4], // Dian friends with Eko
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