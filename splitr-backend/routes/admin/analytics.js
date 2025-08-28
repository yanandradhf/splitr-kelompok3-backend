const express = require("express");
const router = express.Router();

router.get("/geographic", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { period = "7days" } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case "7days":
        startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        break;
      case "30days":
        startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        break;
      case "thismonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    }
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    // Get transaction data by user's branch
    const branchStats = await prisma.$queryRaw`
      SELECT 
        u.bni_branch_code as branch_code,
        COUNT(p.payment_id)::int as transactions,
        SUM(p.amount)::float as amount
      FROM payments p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.created_at >= ${startDate} 
        AND p.created_at <= ${endDate}
        AND p.status IN ('completed', 'completed_scheduled', 'completed_late')
        AND u.bni_branch_code IS NOT NULL
      GROUP BY u.bni_branch_code
      ORDER BY transactions DESC
    `;

    // Get branch details with coordinates
    const branches = await prisma.bniBranch.findMany({
      where: { isActive: true },
    });

    // Create branch lookup
    const branchMap = {};
    branches.forEach(branch => {
      branchMap[branch.branchCode] = branch;
    });

    // Format for heatmap
    const heatmapData = branchStats.map(stat => {
      const branch = branchMap[stat.branch_code];
      return {
        branchCode: stat.branch_code,
        branchName: branch?.branchName || "Unknown",
        city: branch?.city || "Unknown",
        province: branch?.province || "Unknown",
        latitude: parseFloat(branch?.latitude || 0),
        longitude: parseFloat(branch?.longitude || 0),
        transactions: stat.transactions,
        amount: stat.amount || 0,
        amountFormatted: `Rp ${parseInt(stat.amount || 0).toLocaleString("id-ID")}`,
        intensity: stat.transactions, // For heatmap intensity
      };
    }).filter(branch => branch.latitude && branch.longitude);

    res.json({
      period,
      totalBranches: heatmapData.length,
      totalTransactions: heatmapData.reduce((sum, b) => sum + b.transactions, 0),
      totalAmount: heatmapData.reduce((sum, b) => sum + b.amount, 0),
      heatmapData,
    });
  } catch (error) {
    console.error("Geographic analytics error:", error);
    res.status(500).json({ error: "Failed to fetch geographic data" });
  }
});

module.exports = router;