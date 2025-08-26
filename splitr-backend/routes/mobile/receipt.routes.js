const express = require("express");
const jwt = require("jsonwebtoken");
const { uploadReceipt } = require('../../services/cloudinary.service');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'splitr_secret_key';

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Cloudinary storage imported from service

// 1. Upload Receipt Image
router.post("/upload", authenticateToken, uploadReceipt.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt image uploaded' });
    }

    const receiptUrl = req.file.path; // Cloudinary URL
    
    res.json({
      success: true,
      message: 'Receipt uploaded successfully',
      receiptUrl: receiptUrl,
      filename: req.file.filename,
      size: req.file.bytes
    });
  } catch (error) {
    console.error('Upload receipt error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// 2. Get Receipt Image
router.get("/:billId", authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Get bill with receipt
    const bill = await prisma.bill.findUnique({
      where: { billId },
      select: {
        billId: true,
        billName: true,
        receiptImageUrl: true,
        hostId: true,
        billParticipants: {
          where: { userId },
          select: { userId: true }
        }
      }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Check if user has access to this bill
    const hasAccess = bill.hostId === userId || bill.billParticipants.length > 0;
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!bill.receiptImageUrl) {
      return res.status(404).json({ error: 'No receipt image found for this bill' });
    }

    // Check if it's a local mobile path (can't be accessed)
    if (bill.receiptImageUrl.startsWith('file://')) {
      return res.status(400).json({ 
        error: 'Receipt image is stored locally on mobile device',
        message: 'This receipt was uploaded from mobile and cannot be accessed from server',
        receiptPath: bill.receiptImageUrl
      });
    }

    // If it's a legacy server path, return as is (should not happen after migration)
    if (bill.receiptImageUrl.startsWith('/uploads/')) {
      return res.json({
        success: true,
        billId: bill.billId,
        billName: bill.billName,
        receiptUrl: bill.receiptImageUrl,
        receiptPath: bill.receiptImageUrl
      });
    }

    // If it's already a full URL
    res.json({
      success: true,
      billId: bill.billId,
      billName: bill.billName,
      receiptUrl: bill.receiptImageUrl,
      receiptPath: bill.receiptImageUrl
    });

  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ error: 'Failed to get receipt' });
  }
});

// 3. Update Bill Receipt
router.put("/:billId", authenticateToken, uploadReceipt.single('receipt'), async (req, res) => {
  try {
    const { billId } = req.params;
    const prisma = req.prisma;
    const userId = req.user.userId;

    // Verify bill ownership
    const bill = await prisma.bill.findFirst({
      where: { billId, hostId: userId }
    });

    if (!bill) {
      return res.status(403).json({ error: 'Only bill host can update receipt' });
    }

    let receiptUrl = null;
    if (req.file) {
      receiptUrl = req.file.path; // Cloudinary URL
    } else if (req.body.receiptUrl) {
      receiptUrl = req.body.receiptUrl;
    }

    if (!receiptUrl) {
      return res.status(400).json({ error: 'No receipt image provided' });
    }

    // Update bill with new receipt
    await prisma.bill.update({
      where: { billId },
      data: { receiptImageUrl: receiptUrl }
    });

    res.json({
      success: true,
      message: 'Receipt updated successfully',
      billId,
      receiptUrl: receiptUrl
    });

  } catch (error) {
    console.error('Update receipt error:', error);
    res.status(500).json({ error: 'Failed to update receipt' });
  }
});

module.exports = router;