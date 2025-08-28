const express = require("express");
const router = express.Router();

// Helper functions for status display - sesuai dengan mobile payment status
function getStatusDisplay(status) {
  switch (status) {
    case "completed":
      return "Completed";
    case "completed_scheduled":
      return "Completed (Scheduled)";
    case "completed_late":
      return "Completed (Late)";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

function getStatusColor(status) {
  switch (status) {
    case "completed":
    case "completed_scheduled":
    case "completed_late":
      return "green";
    case "failed":
      return "red";
    default:
      return "gray";
  }
}

// GET /api/admin/transactions - Enhanced Transaction Table with Filters
router.get("/", async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      page = 1,
      limit = 10,
      status,
      payment_method,
      date_from,
      date_to,
      search,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};

    // Payment method filter - sesuaikan dengan mobile logic
    if (payment_method && payment_method !== "all") {
      if (payment_method.toLowerCase() === "instant") {
        where.paymentType = "instant";
      } else if (payment_method.toLowerCase() === "scheduled") {
        where.paymentType = "scheduled";
        // Scheduled payments are always completed_scheduled, never pending
      }
    }

    // Status filter - hanya track actual payments
    if (status && status !== "all") {
      where.status = status.toLowerCase();
    }

    // Date range filter
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Search functionality
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { bniAccountNumber: { contains: search } } },
        { transactionId: { contains: search, mode: "insensitive" } },
        { bill: { host: { name: { contains: search, mode: "insensitive" } } } },
        { bill: { host: { bniAccountNumber: { contains: search } } } },
      ];
    }

    // Sort options
    const orderBy = {};
    switch (sort_by) {
      case "transaction_date":
        orderBy.createdAt = sort_order;
        break;
      case "amount":
        orderBy.amount = sort_order;
        break;
      case "status":
        orderBy.status = sort_order;
        break;
      case "sender":
        orderBy.user = { name: sort_order };
        break;
      case "recipient":
        orderBy.bill = { host: { name: sort_order } };
        break;
      default:
        orderBy.createdAt = sort_order;
    }

    // Get transactions with relations
    const [transactions, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              bniAccountNumber: true,
              bniBranchCode: true,
            },
          },
          bill: {
            select: {
              billName: true,
              category: {
                select: {
                  categoryName: true,
                  categoryIcon: true,
                },
              },
              host: {
                select: {
                  name: true,
                  bniAccountNumber: true,
                  bniBranchCode: true,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    // Format response sesuai mockup table
    const formattedTransactions = transactions.map((tx) => ({
      transaction_id:
        tx.transactionId || `${tx.paymentId}`,
      transaction_date: tx.createdAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }), // July 18, 2025
      sender: {
        name: tx.user.name,
        account: tx.user.bniAccountNumber,
        branch_code: tx.user.bniBranchCode,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          tx.user.name
        )}&background=ff6b35&color=fff`,
      },
      recipient: {
        name: tx.bill.host.name,
        account: tx.bill.host.bniAccountNumber,
        branch_code: tx.bill.host.bniBranchCode,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
          tx.bill.host.name
        )}&background=4ecdc4&color=fff`,
      },
      amount: parseFloat(tx.amount),
      amount_formatted: `Rp ${parseInt(tx.amount).toLocaleString("id-ID")}`,
      payment_method: tx.paymentType === "instant" ? "Instant" : "Scheduled",
      status: getStatusDisplay(tx.status),
      status_color: getStatusColor(tx.status),
      status_detail: tx.status, // Raw status for detailed tracking
      bill_name: tx.bill.billName,
      bill_category: {
        name: tx.bill.category?.categoryName || "Other",
        icon: tx.bill.category?.categoryIcon || "📦",
      },
      created_at: tx.createdAt.toISOString(),
      paid_at: tx.paidAt?.toISOString() || null,
      bni_reference: tx.bniReferenceNumber,
    }));

    // Calculate summary statistics - include all completed variants
    const summary = {
      total_transactions: total,
      completed_transactions: transactions.filter(
        (tx) => ["completed", "completed_scheduled", "completed_late"].includes(tx.status)
      ).length,
      failed_transactions: transactions.filter((tx) => tx.status === "failed")
        .length,

      scheduled_transactions: transactions.filter((tx) => tx.status === "completed_scheduled")
        .length,
      late_transactions: transactions.filter((tx) => tx.status === "completed_late")
        .length,
      total_amount: transactions.reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0
      ),
      completed_amount: transactions
        .filter((tx) => ["completed", "completed_scheduled", "completed_late"].includes(tx.status))
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
    };

    res.json({
      data: formattedTransactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
        has_next_page: parseInt(page) < Math.ceil(total / parseInt(limit)),
        has_prev_page: parseInt(page) > 1,
      },
      filters: {
        status: status || "all",
        payment_method: payment_method || "all",
        date_from: date_from || null,
        date_to: date_to || null,
        search: search || null,
        sort_by,
        sort_order,
      },
      summary,
    });
  } catch (error) {
    console.error("Transactions list error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// GET /api/admin/transactions - get spesific transactins by id
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.prisma;
    const transactionId = req.params.id;

    const transaction = await prisma.payment.findUnique({
      where: {
        paymentId: transactionId,
      },
      include: {
        user: {
          select: {
            name: true,
            bniAccountNumber: true,
            bniBranchCode: true,
          },
        },
        bill: {
          select: {
            billName: true,
            category: {
              select: {
                categoryName: true,
                categoryIcon: true,
              },
            },
            host: {
              select: {
                name: true,
                bniAccountNumber: true,
                bniBranchCode: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(transaction);
  } catch (error) {
    console.error("Fetch transaction by ID error:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

// GET /api/admin/transactions/export - Clean Filter-based Export
router.get("/export", async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      format = "csv",
      // Filter parameters (sync dengan table filters)
      status,
      payment_method,
      date_from,
      date_to,
      search,
      sort_by = "created_at",
      sort_order = "desc",
      // Export scope
      scope = "current_page", // 'current_page' atau 'all_filtered'
      page = 1,
      limit = 10,
    } = req.query;

    console.log("Export request:", {
      scope,
      status,
      payment_method,
      date_from,
      date_to,
      search,
    });

    // Build where clause SAMA PERSIS dengan table query
    const where = {};

    // Status filter - sesuaikan dengan mobile payment status
    if (status && status !== "all") {
      const statusLower = status.toLowerCase();
      if (statusLower === "completed") {
        where.status = {
          in: ["completed", "completed_scheduled", "completed_late"]
        };
      } else {
        where.status = statusLower;
      }
    }

    // Payment method filter
    if (payment_method && payment_method !== "all") {
      if (payment_method.toLowerCase() === "instant") {
        where.paymentType = "instant";
      } else if (payment_method.toLowerCase() === "scheduled") {
        where.paymentType = "scheduled";
      }
    }

    // Date range filter
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { bniAccountNumber: { contains: search } } },
        { transactionId: { contains: search, mode: "insensitive" } },
        { bill: { host: { name: { contains: search, mode: "insensitive" } } } },
        { bill: { host: { bniAccountNumber: { contains: search } } } },
      ];
    }

    // Sort options
    const orderBy = {};
    switch (sort_by) {
      case "transaction_date":
        orderBy.createdAt = sort_order;
        break;
      case "amount":
        orderBy.amount = sort_order;
        break;
      case "status":
        orderBy.status = sort_order;
        break;
      case "sender":
        orderBy.user = { name: sort_order };
        break;
      case "recipient":
        orderBy.bill = { host: { name: sort_order } };
        break;
      default:
        orderBy.createdAt = sort_order;
    }

    // Determine pagination based on scope
    let skip, take;
    if (scope === "current_page") {
      // Export current page only (yang tampil di table)
      skip = (parseInt(page) - 1) * parseInt(limit);
      take = parseInt(limit);
    } else {
      // Export all filtered data
      skip = 0;
      take = undefined; // No limit
    }

    // Get transactions
    const [transactions, totalFiltered] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              bniAccountNumber: true,
              bniBranchCode: true,
            },
          },
          bill: {
            select: {
              billName: true,
              category: {
                select: {
                  categoryName: true,
                  categoryIcon: true,
                },
              },
              host: {
                select: {
                  name: true,
                  bniAccountNumber: true,
                  bniBranchCode: true,
                },
              },
            },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    console.log(
      `Found ${transactions.length} transactions to export (${totalFiltered} total filtered)`
    );

    if (format === "csv") {
      // Generate CSV content
      const csvHeader =
        [
          "Transaction ID",
          "Date",
          "Sender Name",
          "Sender Account",
          "Recipient Name",
          "Recipient Account",
          "Amount (IDR)",
          "Payment Method",
          "Status",
          "Bill Name",
          "Category",
        ].join(",") + "\n";

      const csvRows = transactions
        .map((tx) => {
          const row = [
            tx.transactionId || `TXN-${tx.paymentId.slice(-8).toUpperCase()}`,
            tx.createdAt.toLocaleDateString("en-GB"), // 18/07/2025
            `"${tx.user.name}"`,
            tx.user.bniAccountNumber,
            `"${tx.bill.host.name}"`,
            tx.bill.host.bniAccountNumber,
            `"${parseInt(tx.amount).toLocaleString("id-ID")}"`, // Format rupiah
            tx.paymentType === "instant" ? "Instant" : "Scheduled",
            getStatusDisplay(tx.status),
            `"${tx.bill.billName}"`,
            `"${tx.bill.category?.categoryName || "Other"}"`,
          ];
          return row.join(",");
        })
        .join("\n");

      const csvContent = csvHeader + csvRows;

      // Generate filename berdasarkan filter dan scope
      let filename = "splitr-transactions";

      // Add date range to filename
      if (date_from && date_to) {
        filename += `-${date_from}-to-${date_to}`;
      } else if (date_from) {
        filename += `-from-${date_from}`;
      } else if (date_to) {
        filename += `-until-${date_to}`;
      }

      // Add filter info
      if (status && status !== "all") {
        filename += `-${status}`;
      }
      if (payment_method && payment_method !== "all") {
        filename += `-${payment_method}`;
      }
      if (search) {
        filename += `-search-${search.replace(/[^a-zA-Z0-9]/g, "")}`;
      }

      // Add scope info
      if (scope === "current_page") {
        filename += `-page${page}`;
      } else {
        filename += "-all";
      }

      filename += `-${new Date().toISOString().split("T")[0]}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send("\uFEFF" + csvContent); // Add BOM for Excel compatibility
    } else {
      // Return JSON for PDF generation atau frontend processing
      const formattedTransactions = transactions.map((tx) => ({
        transaction_id:
          tx.transactionId || `TXN-${tx.paymentId.slice(-8).toUpperCase()}`,
        transaction_date: tx.createdAt.toLocaleDateString("en-GB"),
        transaction_time: tx.createdAt.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sender: {
          name: tx.user.name,
          account: tx.user.bniAccountNumber,
          branch_code: tx.user.bniBranchCode,
        },
        recipient: {
          name: tx.bill.host.name,
          account: tx.bill.host.bniAccountNumber,
          branch_code: tx.bill.host.bniBranchCode,
        },
        amount: parseFloat(tx.amount),
        amount_formatted: `Rp ${parseInt(tx.amount).toLocaleString("id-ID")}`,
        payment_method: tx.paymentType === "instant" ? "Instant" : "Scheduled",
        status: getStatusDisplay(tx.status),
        status_color: getStatusColor(tx.status),
        status_detail: tx.status,
        bill_name: tx.bill.billName,
        bill_category: {
          name: tx.bill.category?.categoryName || "Other",
          icon: tx.bill.category?.categoryIcon || "📦",
        },
        bni_reference: tx.bniReferenceNumber,
      }));

      res.json({
        success: true,
        data: formattedTransactions,
        export_info: {
          scope: scope,
          total_exported: transactions.length,
          total_filtered: totalFiltered,
          page: scope === "current_page" ? parseInt(page) : null,
          limit: scope === "current_page" ? parseInt(limit) : null,
          export_date: new Date().toISOString(),
          filters: {
            status: status || "all",
            payment_method: payment_method || "all",
            date_from: date_from || null,
            date_to: date_to || null,
            search: search || null,
            sort_by,
            sort_order,
          },
        },
      });
    }
  } catch (error) {
    console.error("Export transactions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export transactions",
      message: error.message,
    });
  }
});

// GET /api/admin/transactions/export-count - Get Export Count Preview
router.get("/export-count", async (req, res) => {
  try {
    const prisma = req.prisma;
    const {
      status,
      payment_method,
      date_from,
      date_to,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    // Build where clause sama seperti export
    const where = {};

    if (status && status !== "all") {
      const statusLower = status.toLowerCase();
      if (statusLower === "completed") {
        where.status = {
          in: ["completed", "completed_scheduled", "completed_late"]
        };
      } else {
        where.status = statusLower;
      }
    }

    if (payment_method && payment_method !== "all") {
      if (payment_method.toLowerCase() === "instant") {
        where.paymentType = "instant";
      } else if (payment_method.toLowerCase() === "scheduled") {
        where.paymentType = "scheduled";
      }
    }

    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { bniAccountNumber: { contains: search } } },
        { transactionId: { contains: search, mode: "insensitive" } },
      ];
    }

    const totalFiltered = await prisma.payment.count({ where });
    const currentPageCount = Math.min(parseInt(limit), totalFiltered);

    res.json({
      current_page_count: currentPageCount,
      all_filtered_count: totalFiltered,
      page: parseInt(page),
      limit: parseInt(limit),
      has_filters:
        !!(status && status !== "all") ||
        !!(payment_method && payment_method !== "all") ||
        !!date_from ||
        !!date_to ||
        !!search,
    });
  } catch (error) {
    console.error("Export count error:", error);
    res.status(500).json({ error: "Failed to get export count" });
  }
});

// GET /api/admin/transactions/stats - Transaction Statistics
router.get("/stats", async (req, res) => {
  try {
    const prisma = req.prisma;
    const { date_from, date_to } = req.query;

    // Build date filter
    const where = {};
    if (date_from || date_to) {
      where.createdAt = {};
      if (date_from) {
        const fromDate = new Date(date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [totalStats, statusStats, methodStats, amountStats] =
      await Promise.all([
        // Total transactions
        prisma.payment.count({ where }),

        // Status breakdown
        prisma.payment.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
          _sum: { amount: true },
        }),

        // Payment method breakdown
        prisma.payment.groupBy({
          by: ["paymentType"],
          where,
          _count: { _all: true },
          _sum: { amount: true },
        }),

        // Amount statistics - include all completed variants
        prisma.payment.aggregate({
          where: { 
            ...where, 
            status: { in: ["completed", "completed_scheduled", "completed_late"] }
          },
          _sum: { amount: true },
          _avg: { amount: true },
          _min: { amount: true },
          _max: { amount: true },
        }),
      ]);

    res.json({
      total_transactions: totalStats,
      status_breakdown: statusStats.map((stat) => ({
        status: stat.status,
        count: stat._count._all,
        total_amount: parseFloat(stat._sum.amount || 0),
        percentage:
          totalStats > 0
            ? parseFloat(((stat._count._all / totalStats) * 100).toFixed(1))
            : 0,
      })),
      method_breakdown: methodStats.map((stat) => ({
        method: stat.paymentType === "instant" ? "Instant" : "Scheduled",
        count: stat._count._all,
        total_amount: parseFloat(stat._sum.amount || 0),
        percentage:
          totalStats > 0
            ? parseFloat(((stat._count._all / totalStats) * 100).toFixed(1))
            : 0,
      })),
      amount_statistics: {
        total_amount: parseFloat(amountStats._sum.amount || 0),
        average_amount: parseFloat(amountStats._avg.amount || 0),
        min_amount: parseFloat(amountStats._min.amount || 0),
        max_amount: parseFloat(amountStats._max.amount || 0),
      },
    });
  } catch (error) {
    console.error("Transaction stats error:", error);
    res.status(500).json({ error: "Failed to fetch transaction statistics" });
  }
});

module.exports = router;