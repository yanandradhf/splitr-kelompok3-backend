const express = require("express");
const router = express.Router();
const { DatabaseError } = require("../../middleware/error.middleware");

// 1. Get All Categories
router.get("/", async (req, res, next) => {
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
    next(error);
  }
});

module.exports = router;