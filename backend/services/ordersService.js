/**
 * Orders Service
 * Handles all Firestore operations for orders using Firebase Admin SDK
 */

const admin = require('firebase-admin');

function getDb() {
  return admin.firestore();
}

// Lazy load dependencies to avoid circular imports
let activityService = null;
let rewardsService = null;

function getActivityService() {
  if (!activityService) {
    activityService = require('./activityService');
  }
  return activityService;
}

function getRewardsService() {
  if (!rewardsService) {
    rewardsService = require('./rewardsService');
  }
  return rewardsService;
}

/**
 * Generate a unique order ID in format ORD-XXXXXXX
 * @returns {string} Generated order ID
 */
function generateOrderId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ORD-${code}`;
}

/**
 * Check if an order ID already exists
 * @param {string} orderId - Order ID to check
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
async function orderIdExists(orderId) {
  const db = getDb();
  const doc = await db.collection('orders').doc(orderId).get();
  return doc.exists;
}

/**
 * Generate a unique order ID that doesn't exist in the database
 * @param {number} maxAttempts - Maximum attempts to generate unique ID
 * @returns {Promise<string>} Unique order ID
 */
async function generateUniqueOrderId(maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orderId = generateOrderId();
    const exists = await orderIdExists(orderId);
    if (!exists) {
      return orderId;
    }
    console.log(`Order ID ${orderId} already exists, generating new one (attempt ${attempt + 1})`);
  }
  throw new Error('Failed to generate unique order ID after maximum attempts');
}

function amountsClose(a, b, eps = 0.02) {
  return Math.abs(parseFloat(a) - parseFloat(b)) < eps;
}

/**
 * Recompute subtotal/shipping/tax/total from DB product prices (prevents client price tampering).
 */
async function validateTrustedOrderTotals(orderData, userId) {
  const productsService = require('./productsService');
  const rewards = getRewardsService();
  const { POINTS_CONFIG } = rewards;

  const items = orderData.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Order items are required');
  }

  let subtotal = 0;
  for (const item of items) {
    if (!item.productId) {
      throw new Error('Each cart item must reference a product');
    }
    const qty = parseInt(item.quantity, 10) || 0;
    if (qty < 1) {
      throw new Error('Invalid item quantity');
    }
    const product = await productsService.getProductById(item.productId);
    if (product.status && product.status !== 'active') {
      throw new Error(`Product is not available: ${item.productId}`);
    }
    const unit = parseFloat(product.price);
    if (Number.isNaN(unit) || unit < 0) {
      throw new Error('Invalid product price');
    }
    subtotal += unit * qty;
  }
  subtotal = Math.round(subtotal * 100) / 100;

  const shipping = subtotal > 50 ? 0 : 10;
  const tax = Math.round(subtotal * 0.1 * 100) / 100;

  const pointsRequested = parseInt(orderData.pointsToRedeem, 10) || 0;
  const balance = await rewards.getRewardsBalance(userId);
  const maxBySubtotal = Math.floor(subtotal);

  if (pointsRequested > balance) {
    throw new Error(`Insufficient points. Available: ${balance}, Requested: ${pointsRequested}`);
  }
  if (pointsRequested > maxBySubtotal) {
    throw new Error('Points discount cannot exceed cart subtotal');
  }

  const discount = pointsRequested * POINTS_CONFIG.POINT_VALUE;
  const totalAmount = Math.max(0, Math.round((subtotal + shipping + tax - discount) * 100) / 100);

  if (!amountsClose(subtotal, orderData.subtotal)) {
    throw new Error('Order subtotal does not match current prices. Refresh and try again.');
  }
  if (shipping !== Number(orderData.shipping)) {
    throw new Error('Shipping amount is invalid');
  }
  if (!amountsClose(tax, orderData.tax)) {
    throw new Error('Tax amount is invalid');
  }
  if (!amountsClose(totalAmount, orderData.totalAmount)) {
    throw new Error('Order total is invalid');
  }

  return {
    subtotal,
    shipping,
    tax,
    totalAmount,
    pointsToRedeem: pointsRequested,
    pointsDiscountExpected: discount,
  };
}

/**
 * Create a new order
 * @param {Object} orderData - Order data
 * @param {string} userId - User ID who placed the order
 * @returns {Promise<Object>} Order result with orderId and redemption info
 */
async function createOrder(orderData, userId) {
  try {
    const db = getDb();

    const orderId = await generateUniqueOrderId();

    const trusted = await validateTrustedOrderTotals(orderData, userId);

    let pointsRedemptionResult = null;
    const pointsToRedeem = trusted.pointsToRedeem;

    if (pointsToRedeem > 0) {
      try {
        const rewards = getRewardsService();
        pointsRedemptionResult = await rewards.redeemPointsForOrder(userId, orderId, pointsToRedeem);
        console.log(`Redeemed ${pointsToRedeem} points for order ${orderId}, discount: ₦${pointsRedemptionResult.discountAmount}`);
      } catch (redeemError) {
        console.error('Failed to redeem points:', redeemError);
        throw new Error(redeemError.message || 'Failed to redeem points');
      }
    }

    const orderWithTimestamps = {
      ...orderData,
      orderId,
      userId,
      subtotal: trusted.subtotal,
      shipping: trusted.shipping,
      tax: trusted.tax,
      totalAmount: trusted.totalAmount,
      status: orderData.status || 'pending',
      pointsRedeemed: pointsToRedeem,
      pointsDiscount: pointsRedemptionResult?.discountAmount || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('orders').doc(orderId).set(orderWithTimestamps);

    try {
      const activity = getActivityService();
      const itemCount = orderData.items?.length || 0;
      await activity.logActivity(
        userId,
        activity.ActivityTypes.ORDER_PLACED,
        `You placed order #${orderId} with ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
        { orderId, totalAmount: trusted.totalAmount, pointsRedeemed: pointsToRedeem }
      );
    } catch (activityError) {
      console.error('Failed to log order activity:', activityError);
    }

    try {
      const rewards = getRewardsService();
      if (trusted.subtotal > 0) {
        await rewards.awardOrderPoints(userId, orderId, trusted.subtotal);
      }
    } catch (rewardsError) {
      console.error('Failed to award order points:', rewardsError);
    }

    return {
      orderId,
      pointsRedeemed: pointsToRedeem,
      pointsDiscount: pointsRedemptionResult?.discountAmount || 0,
    };
  } catch (error) {
    console.error('Error creating order:', error);
    const msg = error && error.message ? String(error.message) : '';
    if (
      msg.includes('Insufficient points') ||
      msg.includes('Order ') ||
      msg.includes('Shipping') ||
      msg.includes('Tax') ||
      msg.includes('subtotal') ||
      msg.includes('total') ||
      msg.includes('product') ||
      msg.includes('Points discount') ||
      msg.includes('quantity') ||
      msg.includes('redeem') ||
      msg.includes('not available')
    ) {
      throw error;
    }
    throw new Error('Failed to create order');
  }
}

/**
 * Get orders by user ID
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of orders to return
 * @returns {Promise<Array>} Array of orders
 */
async function getOrdersByUser(userId, limit = null) {
  try {
    const db = getDb();
    
    // Simple query without orderBy to avoid composite index requirement
    const snapshot = await db.collection('orders')
      .where('userId', '==', userId)
      .get();
    
    let orders = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      });
    });

    // Sort in memory by createdAt descending (most recent first)
    orders.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // Apply limit
    if (limit && orders.length > limit) {
      orders = orders.slice(0, limit);
    }

    return orders;
  } catch (error) {
    console.error('Error getting orders by user:', error);
    throw new Error('Failed to fetch orders');
  }
}

/**
 * Get order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order object
 */
async function getOrderById(orderId) {
  try {
    const db = getDb();
    const doc = await db.collection('orders').doc(orderId).get();

    if (!doc.exists) {
      throw new Error('Order not found');
    }

    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Convert Firestore timestamps to ISO strings
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    };
  } catch (error) {
    if (error.message === 'Order not found') {
      throw error;
    }
    console.error('Error getting order by ID:', error);
    throw new Error('Failed to fetch order');
  }
}

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {string} userId - User ID (for activity logging)
 * @returns {Promise<void>}
 */
async function updateOrderStatus(orderId, status, userId = null) {
  try {
    const db = getDb();
    await db.collection('orders').doc(orderId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity if userId is provided
    if (userId) {
      try {
        const activity = getActivityService();
        let activityType;
        let description;

        switch (status) {
          case 'shipped':
            activityType = activity.ActivityTypes.ORDER_SHIPPED;
            description = `Your order #${orderId} has been shipped`;
            break;
          case 'delivered':
            activityType = activity.ActivityTypes.ORDER_DELIVERED;
            description = `Your order #${orderId} has been delivered`;
            break;
          case 'cancelled':
            activityType = activity.ActivityTypes.ORDER_CANCELLED;
            description = `Your order #${orderId} has been cancelled`;
            break;
          default:
            return; // Don't log for other status changes
        }

        await activity.logActivity(userId, activityType, description, { orderId, status });
      } catch (activityError) {
        console.error('Failed to log order status activity:', activityError);
      }
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error('Failed to update order status');
  }
}

/**
 * Get order count for user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Order count
 */
async function getOrderCount(userId) {
  try {
    const db = getDb();
    const snapshot = await db.collection('orders')
      .where('userId', '==', userId)
      .count()
      .get();
    
    return snapshot.data().count;
  } catch (error) {
    // Fallback if count() is not supported
    try {
      const orders = await getOrdersByUser(userId);
      return orders.length;
    } catch (fallbackError) {
      console.error('Error getting order count:', fallbackError);
      throw new Error('Failed to get order count');
    }
  }
}

module.exports = {
  createOrder,
  getOrdersByUser,
  getOrderById,
  updateOrderStatus,
  getOrderCount,
};
