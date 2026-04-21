/**
 * Rewards Service
 * Handles reward points calculation and management with Firestore
 */

const admin = require('firebase-admin');

function getDb() {
  return admin.firestore();
}

/**
 * Points configuration
 */
const POINTS_CONFIG = {
  NAIRA_PER_POINT: 1000,  // ₦1000 spent = 1 point earned
  POINT_VALUE: 1,         // 1 point = ₦1 discount when redeemed
  SIGNUP_BONUS: 100,      // Bonus points for new users
  REVIEW_BONUS: 25,       // Points for posting a review
};

/**
 * Get user's current reward points balance
 * @param {string} userId - User ID
 * @returns {Promise<number>} Current points balance
 */
async function getRewardsBalance(userId) {
  try {
    const db = getDb();
    const rewardsRef = db.collection('rewards').doc(userId);
    const doc = await rewardsRef.get();

    if (!doc.exists) {
      return 0;
    }

    return doc.data().balance || 0;
  } catch (error) {
    console.error('Error getting rewards balance:', error);
    throw new Error('Failed to get rewards balance');
  }
}

/**
 * Get user's rewards history
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of transactions
 * @returns {Promise<Array>} Rewards transactions
 */
async function getRewardsHistory(userId, limit = 20) {
  try {
    const db = getDb();
    const transactionsRef = db.collection('rewards').doc(userId).collection('transactions');

    const snapshot = await transactionsRef
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const transactions = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    return transactions;
  } catch (error) {
    console.error('Error getting rewards history:', error);
    throw new Error('Failed to get rewards history');
  }
}

/**
 * Add points to user's balance
 * @param {string} userId - User ID
 * @param {number} points - Points to add
 * @param {string} reason - Reason for adding points
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} New balance and transaction ID
 */
async function addPoints(userId, points, reason, metadata = {}) {
  try {
    const db = getDb();
    const rewardsRef = db.collection('rewards').doc(userId);
    const doc = await rewardsRef.get();

    let currentBalance = 0;
    if (doc.exists) {
      currentBalance = doc.data().balance || 0;
    }

    const newBalance = currentBalance + points;

    // Update or create rewards document
    await rewardsRef.set({
      userId,
      balance: newBalance,
      totalEarned: admin.firestore.FieldValue.increment(points),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Log transaction
    const transactionRef = rewardsRef.collection('transactions').doc();
    await transactionRef.set({
      id: transactionRef.id,
      type: 'earn',
      points,
      reason,
      metadata,
      balanceAfter: newBalance,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      newBalance,
      transactionId: transactionRef.id,
    };
  } catch (error) {
    console.error('Error adding points:', error);
    throw new Error('Failed to add points');
  }
}

/**
 * Deduct points from user's balance (for redemption)
 * @param {string} userId - User ID
 * @param {number} points - Points to deduct
 * @param {string} reason - Reason for deduction
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} New balance and transaction ID
 */
async function deductPoints(userId, points, reason, metadata = {}) {
  try {
    const db = getDb();
    const rewardsRef = db.collection('rewards').doc(userId);
    const doc = await rewardsRef.get();

    if (!doc.exists) {
      throw new Error('No rewards account found');
    }

    const currentBalance = doc.data().balance || 0;

    if (currentBalance < points) {
      throw new Error('Insufficient points balance');
    }

    const newBalance = currentBalance - points;

    // Update rewards document
    await rewardsRef.update({
      balance: newBalance,
      totalRedeemed: admin.firestore.FieldValue.increment(points),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log transaction
    const transactionRef = rewardsRef.collection('transactions').doc();
    await transactionRef.set({
      id: transactionRef.id,
      type: 'redeem',
      points: -points,
      reason,
      metadata,
      balanceAfter: newBalance,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      newBalance,
      transactionId: transactionRef.id,
    };
  } catch (error) {
    console.error('Error deducting points:', error);
    throw error;
  }
}

/**
 * Award points for an order
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @param {number} orderTotal - Order total amount (before any discounts)
 * @returns {Promise<Object>} Points awarded and new balance
 */
async function awardOrderPoints(userId, orderId, orderTotal) {
  // 1 point for every ₦1000 spent
  const pointsToAward = Math.floor(orderTotal / POINTS_CONFIG.NAIRA_PER_POINT);
  
  if (pointsToAward <= 0) {
    return { pointsAwarded: 0, newBalance: await getRewardsBalance(userId) };
  }

  const result = await addPoints(
    userId,
    pointsToAward,
    `Points for order #${orderId}`,
    { orderId, orderTotal }
  );

  return {
    pointsAwarded: pointsToAward,
    newBalance: result.newBalance,
  };
}

/**
 * Redeem points for an order discount
 * @param {string} userId - User ID
 * @param {string} orderId - Order ID
 * @param {number} pointsToRedeem - Number of points to redeem
 * @returns {Promise<Object>} Discount amount and new balance
 */
async function redeemPointsForOrder(userId, orderId, pointsToRedeem) {
  if (pointsToRedeem <= 0) {
    return { discountAmount: 0, pointsRedeemed: 0, newBalance: await getRewardsBalance(userId) };
  }

  // Check if user has enough points
  const currentBalance = await getRewardsBalance(userId);
  if (currentBalance < pointsToRedeem) {
    throw new Error(`Insufficient points. Available: ${currentBalance}, Requested: ${pointsToRedeem}`);
  }

  // Calculate discount (1 point = ₦1)
  const discountAmount = pointsToRedeem * POINTS_CONFIG.POINT_VALUE;

  // Deduct points
  const result = await deductPoints(
    userId,
    pointsToRedeem,
    `Points redeemed for order #${orderId}`,
    { orderId, discountAmount }
  );

  return {
    discountAmount,
    pointsRedeemed: pointsToRedeem,
    newBalance: result.newBalance,
  };
}

/**
 * Get points configuration (for frontend display)
 * @returns {Object} Points configuration
 */
function getPointsConfig() {
  return {
    nairaPerPoint: POINTS_CONFIG.NAIRA_PER_POINT,
    pointValue: POINTS_CONFIG.POINT_VALUE,
  };
}

/**
 * Award signup bonus
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Points awarded and new balance
 */
async function awardSignupBonus(userId) {
  const result = await addPoints(
    userId,
    POINTS_CONFIG.SIGNUP_BONUS,
    'Welcome bonus for joining NAME IT SCENTS',
    { type: 'signup_bonus' }
  );

  return {
    pointsAwarded: POINTS_CONFIG.SIGNUP_BONUS,
    newBalance: result.newBalance,
  };
}

/**
 * Get rewards summary for user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Rewards summary
 */
async function getRewardsSummary(userId) {
  try {
    const db = getDb();
    const rewardsRef = db.collection('rewards').doc(userId);
    const doc = await rewardsRef.get();

    if (!doc.exists) {
      return {
        balance: 0,
        totalEarned: 0,
        totalRedeemed: 0,
      };
    }

    const data = doc.data();
    return {
      balance: data.balance || 0,
      totalEarned: data.totalEarned || 0,
      totalRedeemed: data.totalRedeemed || 0,
    };
  } catch (error) {
    console.error('Error getting rewards summary:', error);
    throw new Error('Failed to get rewards summary');
  }
}

module.exports = {
  POINTS_CONFIG,
  getRewardsBalance,
  getRewardsHistory,
  addPoints,
  deductPoints,
  awardOrderPoints,
  awardSignupBonus,
  getRewardsSummary,
  redeemPointsForOrder,
  getPointsConfig,
};
