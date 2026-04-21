/**
 * Analytics Routes
 * Handles analytics event logging
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const analyticsService = require('../services/analyticsService');
const { optionalAuth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { safeErrorLog } = require('../middleware/security');

/**
 * POST /api/analytics/events
 * Log analytics event (public endpoint, but can include user ID if authenticated)
 */
router.post(
  '/events',
  optionalAuth,
  writeLimiter,
  [
    body('eventName').trim().notEmpty().withMessage('Event name is required'),
    body('eventParams').optional().isObject().withMessage('Event params must be an object'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: errors.array()[0].msg,
        });
      }

      const { eventName, eventParams = {} } = req.body;
      const userId = req.user?.uid || null;

      await analyticsService.logEvent(eventName, eventParams, userId);

      res.json({
        message: 'Event logged successfully',
      });
    } catch (error) {
      safeErrorLog('analytics.events', req, error);
      // Don't return error - analytics failures shouldn't break the app
      res.json({
        message: 'Event logged successfully',
      });
    }
  }
);

/**
 * POST /api/analytics/pageview
 * Log page view (convenience endpoint)
 */
router.post('/pageview', optionalAuth, writeLimiter, [
  body('page').trim().notEmpty().withMessage('Page path is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: errors.array()[0].msg,
      });
    }

    const { page } = req.body;
    const userId = req.user?.uid || null;

    await analyticsService.logPageView(page, userId);

    res.json({
      message: 'Page view logged successfully',
    });
  } catch (error) {
    safeErrorLog('analytics.pageview', req, error);
    res.json({
      message: 'Page view logged successfully',
    });
  }
});

module.exports = router;
