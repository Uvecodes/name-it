/**
 * Activity Service
 * Handles user activity logging and retrieval with Firestore
 */

const admin = require('firebase-admin');

function getDb() {
  return admin.firestore();
}

/**
 * Activity types enum
 */
const ActivityTypes = {
  ORDER_PLACED: 'order_placed',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_SHIPPED: 'order_shipped',
  ORDER_CANCELLED: 'order_cancelled',
  WISHLIST_ADD: 'wishlist_add',
  WISHLIST_REMOVE: 'wishlist_remove',
  REVIEW_POSTED: 'review_posted',
  PROFILE_UPDATED: 'profile_updated',
  ACCOUNT_CREATED: 'account_created',
  PASSWORD_CHANGED: 'password_changed',
};

/**
 * Activity icons mapping
 */
const ActivityIcons = {
  [ActivityTypes.ORDER_PLACED]: 'fa-shopping-bag',
  [ActivityTypes.ORDER_DELIVERED]: 'fa-check-circle',
  [ActivityTypes.ORDER_SHIPPED]: 'fa-truck',
  [ActivityTypes.ORDER_CANCELLED]: 'fa-times-circle',
  [ActivityTypes.WISHLIST_ADD]: 'fa-heart',
  [ActivityTypes.WISHLIST_REMOVE]: 'fa-heart-broken',
  [ActivityTypes.REVIEW_POSTED]: 'fa-star',
  [ActivityTypes.PROFILE_UPDATED]: 'fa-user-edit',
  [ActivityTypes.ACCOUNT_CREATED]: 'fa-user-plus',
  [ActivityTypes.PASSWORD_CHANGED]: 'fa-key',
};

/**
 * Activity titles mapping
 */
const ActivityTitles = {
  [ActivityTypes.ORDER_PLACED]: 'Order Placed',
  [ActivityTypes.ORDER_DELIVERED]: 'Order Delivered',
  [ActivityTypes.ORDER_SHIPPED]: 'Order Shipped',
  [ActivityTypes.ORDER_CANCELLED]: 'Order Cancelled',
  [ActivityTypes.WISHLIST_ADD]: 'Added to Wishlist',
  [ActivityTypes.WISHLIST_REMOVE]: 'Removed from Wishlist',
  [ActivityTypes.REVIEW_POSTED]: 'Review Posted',
  [ActivityTypes.PROFILE_UPDATED]: 'Profile Updated',
  [ActivityTypes.ACCOUNT_CREATED]: 'Account Created',
  [ActivityTypes.PASSWORD_CHANGED]: 'Password Changed',
};

/**
 * Log a user activity
 * @param {string} userId - User ID
 * @param {string} type - Activity type (from ActivityTypes)
 * @param {string} description - Activity description
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<string>} Activity ID
 */
async function logActivity(userId, type, description, metadata = {}) {
  try {
    const db = getDb();
    const activityRef = db.collection('activities').doc();

    const activity = {
      id: activityRef.id,
      userId,
      type,
      title: ActivityTitles[type] || 'Activity',
      icon: ActivityIcons[type] || 'fa-circle',
      description,
      metadata,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await activityRef.set(activity);

    return activityRef.id;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - activity logging should not break main operations
    return null;
  }
}

/**
 * Get user's recent activity
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of activities
 * @returns {Promise<Array>} Recent activities
 */
async function getActivity(userId, limit = 10) {
  try {
    const db = getDb();
    const activitiesRef = db.collection('activities');

    // Query without orderBy to avoid composite index requirement
    const snapshot = await activitiesRef
      .where('userId', '==', userId)
      .get();

    let activities = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    // Sort in memory by createdAt descending
    activities.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // Apply limit
    if (limit && activities.length > limit) {
      activities = activities.slice(0, limit);
    }

    return activities;
  } catch (error) {
    console.error('Error getting activity:', error);
    throw new Error('Failed to fetch activity');
  }
}

/**
 * Delete old activities (cleanup job)
 * @param {number} daysOld - Delete activities older than this many days
 * @returns {Promise<number>} Number of deleted activities
 */
async function cleanupOldActivities(daysOld = 90) {
  try {
    const db = getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const activitiesRef = db.collection('activities');
    const snapshot = await activitiesRef
      .where('createdAt', '<', cutoffDate)
      .limit(500)
      .get();

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    if (count > 0) {
      await batch.commit();
    }

    return count;
  } catch (error) {
    console.error('Error cleaning up activities:', error);
    throw new Error('Failed to cleanup activities');
  }
}

module.exports = {
  ActivityTypes,
  ActivityIcons,
  ActivityTitles,
  logActivity,
  getActivity,
  cleanupOldActivities,
};
