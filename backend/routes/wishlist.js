/**
 * Wishlist Routes
 * Handles wishlist API endpoints (protected routes)
 */

const express = require('express');
const router = express.Router();
const wishlistService = require('../services/wishlistService');
const { verifyToken: verifyTokenMiddleware } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { safeErrorLog } = require('../middleware/security');

/**
 * GET /api/wishlist
 * Get user's wishlist (protected)
 */
router.get('/', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const wishlist = await wishlistService.getWishlist(userId);

    res.json({
      wishlist,
      count: wishlist.length,
    });
  } catch (error) {
    safeErrorLog('wishlist.list', req, error);
    res.status(500).json({
      error: 'Failed to fetch wishlist',
      message: 'Unable to fetch wishlist at the moment.',
    });
  }
});

/**
 * GET /api/wishlist/count
 * Get wishlist item count (protected)
 */
router.get('/count', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const count = await wishlistService.getWishlistCount(userId);

    res.json({ count });
  } catch (error) {
    safeErrorLog('wishlist.count', req, error);
    res.status(500).json({
      error: 'Failed to get wishlist count',
      message: 'Unable to get wishlist count at the moment.',
    });
  }
});

/**
 * GET /api/wishlist/check/:productId
 * Check if product is in wishlist (protected)
 */
router.get('/check/:productId', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { productId } = req.params;
    const isInWishlist = await wishlistService.isInWishlist(userId, productId);

    res.json({ inWishlist: isInWishlist });
  } catch (error) {
    safeErrorLog('wishlist.check', req, error);
    res.status(500).json({
      error: 'Failed to check wishlist',
      message: 'Unable to check wishlist at the moment.',
    });
  }
});

/**
 * POST /api/wishlist/:productId
 * Add product to wishlist (protected)
 */
router.post('/:productId', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { productId } = req.params;

    const result = await wishlistService.addToWishlist(userId, productId);

    res.status(201).json(result);
  } catch (error) {
    safeErrorLog('wishlist.add', req, error);
    res.status(500).json({
      error: 'Failed to add to wishlist',
      message: 'Unable to add to wishlist at the moment.',
    });
  }
});

/**
 * DELETE /api/wishlist/:productId
 * Remove product from wishlist (protected)
 */
router.delete('/:productId', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { productId } = req.params;

    const result = await wishlistService.removeFromWishlist(userId, productId);

    res.json(result);
  } catch (error) {
    safeErrorLog('wishlist.remove', req, error);
    res.status(500).json({
      error: 'Failed to remove from wishlist',
      message: 'Unable to remove from wishlist at the moment.',
    });
  }
});

module.exports = router;
