const express = require("express");
const router = express.Router();

router.get("/geographic", async (req, res) => {
  try {
    const prisma = req.prisma;
    const where = {};

    const branchSummary = await prisma.payment.groupBy({
      by: [ "toBranch"], // Grouping by both fields
      _count: {
        paymentId: true, // Count payments in each group
      },
      _sum: {
        amount: true, // Sum the amount for payments in each group
      },
       orderBy: [
        {
          toBranch: "asc",
        },
      ],
    });

    res.json(branchSummary);
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

module.exports = router;