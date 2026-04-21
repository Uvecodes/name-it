/**
 * Activity Routes
 * Handles activity API endpoints (protected routes)
 */

const express = require('express');
const router = express.Router();
const activityService = require('../services/activityService');
const { verifyToken: verifyTokenMiddleware } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { safeErrorLog } = require('../middleware/security');

/**
 * GET /api/activity
 * Get user's recent activity (protected)
 */
router.get('/', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

    const activities = await activityService.getActivity(userId, limit);

    res.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    safeErrorLog('activity.list', req, error);
    res.status(500).json({
      error: 'Failed to fetch activity',
      message: 'Unable to fetch activity at the moment.',
    });
  }
});

/**
 * POST /api/activity
 * Log a new activity (protected - internal use)
 */
router.post('/', verifyTokenMiddleware, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { type, description, metadata } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Type and description are required',
      });
    }

    const activityId = await activityService.logActivity(
      userId,
      type,
      description,
      metadata || {}
    );

    res.status(201).json({
      success: true,
      activityId,
    });
  } catch (error) {
    safeErrorLog('activity.create', req, error);
    res.status(500).json({
      error: 'Failed to log activity',
      message: 'Unable to log activity at the moment.',
    });
  }
});

module.exports = router;
