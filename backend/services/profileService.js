/**
 * Profile Service
 * Handles user profile operations with Firestore
 */

const admin = require('firebase-admin');

function getDb() {
  return admin.firestore();
}

// Lazy load to avoid circular imports
let activityService = null;

function getActivityService() {
  if (!activityService) {
    activityService = require('./activityService');
  }
  return activityService;
}

/**
 * Get user profile
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User profile
 */
async function getProfile(userId) {
  try {
    const db = getDb();
    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    };
  } catch (error) {
    console.error('Error getting profile:', error);
    throw new Error('Failed to get profile');
  }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} Updated profile
 */
async function updateProfile(userId, profileData) {
  try {
    const db = getDb();
    const userRef = db.collection('users').doc(userId);

    // Allowed fields to update
    const allowedFields = ['name', 'phoneNumber', 'address', 'city', 'state', 'zipCode', 'zip', 'country', 'avatarUrl'];
    const updateData = {};

    for (const field of allowedFields) {
      if (profileData[field] !== undefined) {
        // Normalize zip to zipCode
        if (field === 'zip') {
          updateData.zipCode = profileData[field];
        } else {
          updateData[field] = profileData[field];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // Check if document exists
    const doc = await userRef.get();
    if (!doc.exists) {
      // Create the document if it doesn't exist
      await userRef.set({
        ...updateData,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.update(updateData);
    }

    // Log activity
    try {
      const activity = getActivityService();
      await activity.logActivity(
        userId,
        activity.ActivityTypes.PROFILE_UPDATED,
        'You updated your profile information',
        { fieldsUpdated: Object.keys(updateData).filter(f => f !== 'updatedAt') }
      );
    } catch (activityError) {
      console.error('Failed to log profile update activity:', activityError);
    }

    return await getProfile(userId);
  } catch (error) {
    console.error('Error updating profile:', error);
    throw new Error(error.message || 'Failed to update profile');
  }
}

/**
 * Update avatar URL
 * @param {string} userId - User ID
 * @param {string} avatarUrl - Avatar URL
 * @returns {Promise<Object>} Updated profile
 */
async function updateAvatar(userId, avatarUrl) {
  return await updateProfile(userId, { avatarUrl });
}

/**
 * Get full user location string
 * @param {Object} profile - User profile
 * @returns {string} Location string
 */
function getLocationString(profile) {
  if (!profile) return '';

  const parts = [];
  if (profile.city) parts.push(profile.city);
  if (profile.state) parts.push(profile.state);
  if (profile.country) parts.push(profile.country);

  return parts.join(', ') || profile.address || '';
}

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  getLocationString,
};
