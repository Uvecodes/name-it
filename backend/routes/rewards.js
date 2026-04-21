/**
 * Rewards Routes
 * Handles rewards API endpoints (protected routes)
 */

const express = require('express');
const router = express.Router();
const rewardsService = require('../services/rewardsService');
const { verifyToken: verifyTokenMiddleware } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { safeErrorLog } = require('../middleware/security');

/**
 * GET /api/rewards/config
 * Get rewards points configuration (public)
 */
router.get('/config', (req, res) => {
  const config = rewardsService.getPointsConfig();
  res.json(config);
});

/**
 * GET /api/rewards
 * Get user's rewards balance (protected)
 */
router.get('/', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const summary = await rewardsService.getRewardsSummary(userId);

    res.json(summary);
  } catch (error) {
    safeErrorLog('rewards.summary', req, error);
    res.status(500).json({
      error: 'Failed to fetch rewards',
      message: 'Unable to fetch rewards at the moment.',
    });
  }
});

/**
 * GET /api/rewards/history
 * Get user's rewards transaction history (protected)
 */
router.get('/history', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;

    const transactions = await rewardsService.getRewardsHistory(userId, limit);

    res.json({
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    safeErrorLog('rewards.history', req, error);
    res.status(500).json({
      error: 'Failed to fetch rewards history',
      message: 'Unable to fetch rewards history at the moment.',
    });
  }
});

/**
 * POST /api/rewards/redeem
 * Redeem reward points (protected)
 */
router.post('/redeem', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { points, reason } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Valid points amount is required',
      });
    }

    const result = await rewardsService.deductPoints(
      userId,
      points,
      reason || 'Points redemption',
      { type: 'manual_redemption' }
    );

    res.json({
      success: true,
      pointsRedeemed: points,
      newBalance: result.newBalance,
    });
  } catch (error) {
    safeErrorLog('rewards.redeem', req, error);
    
    if (error.message === 'Insufficient points balance') {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: 'Insufficient points balance',
      });
    }

    res.status(500).json({
      error: 'Failed to redeem points',
      message: 'Unable to redeem points at the moment.',
    });
  }
});

module.exports = router;
