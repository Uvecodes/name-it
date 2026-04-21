/**
 * Orders Routes
 * Handles order-related API endpoints (protected routes)
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const ordersService = require('../services/ordersService');
const idempotencyService = require('../services/idempotencyService');
const { verifyToken: verifyTokenMiddleware } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const { safeErrorLog } = require('../middleware/security');

/**
 * POST /api/orders
 * Create a new order (protected)
 */
router.post(
  '/',
  verifyTokenMiddleware,
  writeLimiter,
  [
    body('customerInfo').isObject().withMessage('Customer info is required'),
    body('customerInfo.name').trim().notEmpty().withMessage('Customer name is required'),
    body('customerInfo.phone').trim().notEmpty().withMessage('Customer phone is required'),
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    body('items').isArray().notEmpty().withMessage('Order items are required'),
    body('totalAmount').isNumeric().withMessage('Total amount is required'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const userId = req.user.uid;
      const orderData = req.body;
      const idempotencyKey = req.headers['idempotency-key'];

      if (!idempotencyService.isValidIdempotencyKey(idempotencyKey)) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Valid Idempotency-Key header is required',
        });
      }

      const cached = await idempotencyService.getStoredResponse(userId, idempotencyKey);
      if (cached) {
        return res.status(200).json({
          ...cached,
          idempotentReplay: true,
        });
      }

      const result = await ordersService.createOrder(orderData, userId);
      const responsePayload = {
        message: 'Order created successfully',
        orderId: result.orderId,
        pointsRedeemed: result.pointsRedeemed || 0,
        pointsDiscount: result.pointsDiscount || 0,
      };
      await idempotencyService.storeResponse(userId, idempotencyKey, responsePayload);

      res.status(201).json({
        ...responsePayload,
      });
    } catch (error) {
      safeErrorLog('orders.create', req, error);
      const msg = error.message || '';

      if (
        msg.includes('Insufficient points') ||
        msg.includes('Order ') ||
        msg.includes('Shipping amount') ||
        msg.includes('Tax amount') ||
        msg.includes('subtotal') ||
        msg.includes('Order total') ||
        msg.includes('product') ||
        msg.includes('Points discount') ||
        msg.includes('quantity') ||
        msg.includes('redeem') ||
        msg.includes('not available') ||
        msg.includes('must reference')
      ) {
        return res.status(400).json({
          error: 'Invalid order',
          message: msg,
        });
      }

      res.status(500).json({
        error: 'Failed to create order',
        message: 'Unable to create order at the moment.',
      });
    }
  }
);

/**
 * GET /api/orders
 * Get current user's orders (protected)
 */
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const userId = req.user.uid;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    const orders = await ordersService.getOrdersByUser(userId, limit);

    res.json({
      orders,
      count: orders.length,
    });
  } catch (error) {
    safeErrorLog('orders.list', req, error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      message: 'Unable to fetch orders at the moment.',
    });
  }
});

/**
 * GET /api/orders/:id
 * Get order by ID (protected - user can only access their own orders)
 */
router.get('/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const order = await ordersService.getOrderById(id);

    // Verify order belongs to user
    if (order.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this order',
      });
    }

    res.json({ order });
  } catch (error) {
    if (error.message === 'Order not found') {
      return res.status(404).json({
        error: 'Order not found',
        message: error.message,
      });
    }

    safeErrorLog('orders.get', req, error);
    res.status(500).json({
      error: 'Failed to fetch order',
      message: 'Unable to fetch order at the moment.',
    });
  }
});

module.exports = router;
