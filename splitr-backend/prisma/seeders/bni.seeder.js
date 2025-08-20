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
      { namaRekening: "Aulia Rahman", nomorRekening: "1234567890", branchCode: "001", saldo: 5000000 },
      { namaRekening: "Ilham Kawil", nomorRekening: "1978654321", branchCode: "002", saldo: 4500000 },
      { namaRekening: "Timoti Siahaan", nomorRekening: "1935826578", branchCode: "003", saldo: 3800000 },
      { namaRekening: "Ivan Luthfian", nomorRekening: "1765324215", branchCode: "004", saldo: 4200000 },
      { namaRekening: "Andra Dhafa", nomorRekening: "1954219066", branchCode: "005", saldo: 3600000 },
      { namaRekening: "Hans Sye", nomorRekening: "1423675943", branchCode: "001", saldo: 2900000 },
      { namaRekening: "Nabila Ulhaq", nomorRekening: "1478567892", branchCode: "002", saldo: 3300000 },
      { namaRekening: "Mom Citra", nomorRekening: "1654328901", branchCode: "003", saldo: 5200000 },
      { namaRekening: "Akmal Fadhil", nomorRekening: "1789456123", branchCode: "004", saldo: 2700000 },
      { namaRekening: "Diyaa Noventino", nomorRekening: "1987654321", branchCode: "005", saldo: 4100000 },
      { namaRekening: "Rizki Pratama", nomorRekening: "1456789012", branchCode: "001", saldo: 3400000 },
      { namaRekening: "Sari Dewi", nomorRekening: "1321654987", branchCode: "002", saldo: 2800000 },
      { namaRekening: "Budi Santoso", nomorRekening: "1654987321", branchCode: "003", saldo: 3700000 },
      { namaRekening: "Maya Sari", nomorRekening: "1789123456", branchCode: "004", saldo: 4300000 },
      { namaRekening: "Andi Wijaya", nomorRekening: "1456123789", branchCode: "005", saldo: 2600000 },
      { namaRekening: "Lina Permata", nomorRekening: "1987456123", branchCode: "001", saldo: 3900000 },
      { namaRekening: "Fajar Nugroho", nomorRekening: "1123456789", branchCode: "002", saldo: 3100000 },
      { namaRekening: "Dina Kartika", nomorRekening: "1654321987", branchCode: "003", saldo: 2500000 },
      { namaRekening: "Reza Pratama", nomorRekening: "1789654123", branchCode: "004", saldo: 4000000 },
      { namaRekening: "Tika Sari", nomorRekening: "1456987321", branchCode: "005", saldo: 3200000 },
    ],
  });
}

module.exports = { seedBNIBranches, seedBNIDummyAccounts };