const express = require('express');
const multer = require('multer');

// Configure multer to store the file in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB file size limit
  }
});

module.exports = upload