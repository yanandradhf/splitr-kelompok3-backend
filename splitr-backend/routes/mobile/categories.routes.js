const express = require("express");
const router = express.Router();

// 1. Get All Categories
router.get("/", async (req, res) => {
  try {
    const prisma = req.prisma;

    const categories = await prisma.billCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        categoryName: "asc",
      },
    });

    res.json({
      categories: categories.map(category => ({
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categoryIcon: category.categoryIcon,
        createdAt: category.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to get categories" });
  }
});

module.exports = router;