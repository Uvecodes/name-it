/**
 * Analytics Service
 * Handles analytics event logging
 * Note: Firebase Admin SDK doesn't have direct Analytics API
 * This service can log events to a custom analytics solution or Firestore
 */

const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Log analytics event
 * Since Firebase Admin SDK doesn't support Analytics directly,
 * we'll log events to Firestore for tracking
 * @param {string} eventName - Event name
 * @param {Object} eventParams - Event parameters
 * @param {string} userId - Optional user ID
 * @returns {Promise<void>}
 */
async function logEvent(eventName, eventParams = {}, userId = null) {
  try {
    const eventData = {
      eventName,
      eventParams,
      userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: eventParams.userAgent || null,
      page: eventParams.page || null,
    };

    await db.collection('analytics_events').add(eventData);
  } catch (error) {
    console.error('Error logging analytics event:', error);
    // Don't throw - analytics failures shouldn't break the app
  }
}

/**
 * Log page view
 * @param {string} page - Page path
 * @param {string} userId - Optional user ID
 * @returns {Promise<void>}
 */
async function logPageView(page, userId = null) {
  return logEvent('page_view', { page }, userId);
}

/**
 * Log custom event
 * @param {string} eventName - Event name
 * @param {Object} params - Event parameters
 * @param {string} userId - Optional user ID
 * @returns {Promise<void>}
 */
async function logCustomEvent(eventName, params = {}, userId = null) {
  return logEvent(eventName, params, userId);
}

module.exports = {
  logEvent,
  logPageView,
  logCustomEvent,
};
