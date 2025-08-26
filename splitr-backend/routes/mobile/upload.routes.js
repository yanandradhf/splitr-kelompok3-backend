const express = require("express");
const jwt = require("jsonwebtoken");
const { uploadProfile, uploadReceipt } = require('../../services/cloudinary.service');
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

// 1. Upload Profile Photo
router.post("/profile-photo", authenticateToken, uploadProfile.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const prisma = req.prisma;
    const userId = req.user.userId;
    const photoUrl = req.file.path; // Cloudinary URL

    // Update user profile with photo URL
    await prisma.user.update({
      where: { userId },
      data: { profilePhotoUrl: photoUrl }
    });

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      photoUrl: photoUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
});

// 2. Upload Receipt Image
router.post("/receipt", authenticateToken, uploadReceipt.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt uploaded' });
    }

    const receiptUrl = req.file.path; // Cloudinary URL
    
    res.json({
      success: true,
      message: 'Receipt uploaded successfully',
      receiptUrl: receiptUrl,
      receiptPath: receiptUrl, // For storing in bill
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload receipt error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// 3. Generic Image Upload (for flexibility)
router.post("/image", authenticateToken, uploadReceipt.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageUrl = req.file.path; // Cloudinary URL
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      imagePath: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;