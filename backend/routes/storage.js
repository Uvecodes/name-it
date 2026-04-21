/**
 * Storage Routes
 * Handles file upload/download operations (protected routes)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const storageService = require('../services/storageService');
const { verifyToken: verifyTokenMiddleware } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { safeErrorLog } = require('../middleware/security');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function sanitizeFileName(name) {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

function ensureUserScopedPath(userId, requestedPath, originalname) {
  const safeName = sanitizeFileName(originalname);
  const defaultPath = `users/${userId}/${Date.now()}-${safeName}`;
  if (!requestedPath) return defaultPath;
  const normalized = String(requestedPath).replace(/\\/g, '/').replace(/\.\./g, '');
  if (!normalized.startsWith(`users/${userId}/`)) {
    throw new Error('Invalid storage path scope');
  }
  return normalized;
}

/**
 * POST /api/storage/upload
 * Upload file (protected)
 */
router.post('/upload', verifyTokenMiddleware, writeLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please provide a file to upload',
      });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { path } = req.body; // Optional custom path
    const userId = req.user.uid;

    if (!ALLOWED_MIME.has(mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only images and PDF files are allowed.',
      });
    }

    // Generate file path
    const fileName = ensureUserScopedPath(userId, path, originalname);

    const downloadURL = await storageService.uploadFile(buffer, fileName, mimetype);

    res.json({
      message: 'File uploaded successfully',
      url: downloadURL,
      fileName,
    });
  } catch (error) {
    safeErrorLog('storage.upload', req, error);
    res.status(500).json({
      error: 'Failed to upload file',
      message: 'Failed to upload file',
    });
  }
});

/**
 * GET /api/storage/url/:path
 * Get download URL for file (public or protected based on file permissions)
 */
router.get('/url/:path(*)', verifyTokenMiddleware, async (req, res) => {
  try {
    const filePath = req.params.path;
    const userId = req.user.uid;
    if (!String(filePath).startsWith(`users/${userId}/`)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this file',
      });
    }
    const url = await storageService.getDownloadURL(filePath);

    res.json({
      url,
      path: filePath,
    });
  } catch (error) {
    safeErrorLog('storage.url', req, error);
    res.status(500).json({
      error: 'Failed to get file URL',
      message: 'Failed to get file URL',
    });
  }
});

/**
 * DELETE /api/storage/:path
 * Delete file (protected)
 */
router.delete('/:path(*)', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const filePath = req.params.path;
    const userId = req.user.uid;
    if (!String(filePath).startsWith(`users/${userId}/`)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this file',
      });
    }
    await storageService.deleteFile(filePath);

    res.json({
      message: 'File deleted successfully',
      path: filePath,
    });
  } catch (error) {
    if (error.message === 'File not found') {
      return res.status(404).json({
        error: 'File not found',
        message: 'File not found',
      });
    }

    safeErrorLog('storage.delete', req, error);
    res.status(500).json({
      error: 'Failed to delete file',
      message: 'Failed to delete file',
    });
  }
});

module.exports = router;
