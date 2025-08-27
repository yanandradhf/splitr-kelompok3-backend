const express = require("express");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Import secure authentication middleware
const { authenticateSecure } = require('../../middleware/auth.middleware');
const authenticateToken = authenticateSecure;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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
    const photoUrl = `/uploads/profiles/${req.file.filename}`;

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

// Create receipts directory
const receiptsDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// Configure multer for receipts
const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const receiptUpload = multer({ 
  storage: receiptStorage,
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

    const receiptUrl = `/uploads/receipts/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Receipt uploaded successfully',
      receiptUrl: receiptUrl,
      receiptPath: receiptUrl,
      filename: req.file.filename
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

    const imageUrl = `/uploads/receipts/${req.file.filename}`;
    
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