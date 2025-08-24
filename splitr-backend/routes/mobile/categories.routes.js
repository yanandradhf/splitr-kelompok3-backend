const express = require("express");
const router = express.Router();
const { DatabaseError } = require("../../middleware/error.middleware");

// 1. Get All Categories
router.get("/", async (req, res, next) => {
  try {
    const prisma = req.prisma;
    // Validate required dependencies
    if (!prisma) {
      const error = new Error("Koneksi database tidak tersedia");
      error.name = "DatabaseError";
      return next(error);
    }

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
    if (error.code === 'P2025') {
      error.name = "NotFoundError";
    } else if (error.code?.startsWith('P')) {
      error.name = "DatabaseError";
    } else if (error.message?.includes('timeout')) {
      error.name = "TimeoutError";
    } else if (error.message?.includes('connection')) {
      error.name = "DatabaseError";
    }
    next(error);
  }
});

module.exports = router;