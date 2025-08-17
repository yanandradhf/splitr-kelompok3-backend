// BNI Data Seeder
const { PrismaClient } = require("@prisma/client");

async function seedBNIBranches(prisma) {
  return await prisma.bniBranch.createMany({
    data: [
      {
        branchCode: "001",
        branchName: "Jakarta Thamrin",
        city: "Jakarta Pusat",
        province: "DKI Jakarta",
        latitude: -6.1944,
        longitude: 106.8229,
      },
      {
        branchCode: "002",
        branchName: "Jakarta Kemang",
        city: "Jakarta Selatan",
        province: "DKI Jakarta",
        latitude: -6.2441,
        longitude: 106.8133,
      },
      {
        branchCode: "003",
        branchName: "Jakarta Kelapa Gading",
        city: "Jakarta Utara",
        province: "DKI Jakarta",
        latitude: -6.1588,
        longitude: 106.9056,
      },
      {
        branchCode: "004",
        branchName: "Bandung Dago",
        city: "Bandung",
        province: "Jawa Barat",
        latitude: -6.8957,
        longitude: 107.6107,
      },
      {
        branchCode: "005",
        branchName: "Surabaya Darmo",
        city: "Surabaya",
        province: "Jawa Timur",
        latitude: -7.2575,
        longitude: 112.7521,
      },
    ],
  });
}

async function seedBNIDummyAccounts(prisma) {
  return await prisma.bniDummyAccount.createMany({
    data: [
      {
        namaRekening: "Ahmad Sutanto",
        nomorRekening: "1234567890",
        branchCode: "001",
        saldo: 5000000,
      },
      {
        namaRekening: "Budi Santoso",
        nomorRekening: "0987654321",
        branchCode: "002",
        saldo: 3500000,
      },
      {
        namaRekening: "Citra Dewi",
        nomorRekening: "1122334455",
        branchCode: "001",
        saldo: 2750000,
      },
      {
        namaRekening: "Dian Permata",
        nomorRekening: "5544332211",
        branchCode: "003",
        saldo: 4200000,
      },
      {
        namaRekening: "Eko Prasetyo",
        nomorRekening: "9988776655",
        branchCode: "002",
        saldo: 1800000,
      },
    ],
  });
}

module.exports = { seedBNIBranches, seedBNIDummyAccounts };