const express = require("express");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Import secure authentication middleware
const { authenticateSecure } = require('../../middleware/auth.middleware');
const authenticateToken = authenticateSecure;

// Cloudinary service
const cloudinary = require('../../services/cloudinary.service');

// Configure multer - memory storage for Cloudinary
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG and PNG files are allowed'));
    }
  }
});

// 1. Upload Profile Photo
router.post("/profile-photo", authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const prisma = req.prisma;
    const userId = req.user.userId;

    // Upload to Cloudinary
    const result = await cloudinary.uploadBuffer(req.file.buffer, {
      folder: 'splitr/profiles',
      public_id: `profile_${userId}_${Date.now()}`,
      transformation: [
        { width: 400, height: 400, crop: 'fill' },
        { quality: 'auto' }
      ]
    });

    // Update user profile with Cloudinary URL
    await prisma.user.update({
      where: { userId },
      data: { profilePhotoUrl: result.secure_url }
    });

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      photoUrl: result.secure_url,
      cloudinaryId: result.public_id
    });
  } catch (error) {
    console.error('Upload profile photo error:', error);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
});

// Configure multer for receipts - memory storage for Cloudinary
const receiptUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG and PNG files are allowed'));
    }
  }
});

// 2. Upload Receipt Image
router.post("/receipt", authenticateToken, receiptUpload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploadBuffer(req.file.buffer, {
      folder: 'splitr/receipts',
      public_id: `receipt_${Date.now()}`,
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' },
        { quality: 'auto' }
      ]
    });
    
    res.json({
      success: true,
      message: 'Receipt uploaded successfully',
      receiptUrl: result.secure_url,
      receiptPath: result.secure_url,
      cloudinaryId: result.public_id
    });
  } catch (error) {
    console.error('Upload receipt error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// 3. Generic Image Upload
router.post("/image", authenticateToken, receiptUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploadBuffer(req.file.buffer, {
      folder: 'splitr/images',
      public_id: `image_${Date.now()}`,
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' },
        { quality: 'auto' }
      ]
    });
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: result.secure_url,
      imagePath: result.secure_url,
      cloudinaryId: result.public_id
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;