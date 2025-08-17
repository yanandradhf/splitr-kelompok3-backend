// Categories Seeder
async function seedCategories(prisma) {
  await prisma.billCategory.createMany({
    data: [
      { categoryName: "Food and Beverage", categoryIcon: "🍽️" },
      { categoryName: "Entertainment", categoryIcon: "🎬" },
      { categoryName: "Transport", categoryIcon: "🚗" },
      { categoryName: "Other", categoryIcon: "📦" },
    ],
  });

  return await prisma.billCategory.findMany();
}

module.exports = { seedCategories };