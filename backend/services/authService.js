/**
 * Authentication Service
 * Handles all Firebase Admin SDK authentication operations
 */

const admin = require('firebase-admin');

function getDb() {
  if (!admin.apps.length) {
    throw new Error('Firebase is not initialized');
  }
  return admin.firestore();
}

/**
 * Create a new user account
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} userData - Additional user data (name, phoneNumber, etc.)
 * @returns {Promise<Object>} - Created user record
 */
async function createUser(email, password, userData = {}) {
  try {
    // Create user with Firebase Admin SDK
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
      disabled: false,
    });

    return {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      metadata: userRecord.metadata,
      ...userData,
    };
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      throw new Error('An account with this email already exists');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters');
    }
    throw new Error('Failed to create user account');
  }
}

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<Object>} - User record
 */
async function getUserByEmail(email) {
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      metadata: userRecord.metadata,
    };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address');
    }
    throw new Error('Failed to get user');
  }
}

/**
 * Get user by UID
 * @param {string} uid - User UID
 * @returns {Promise<Object>} - User record
 */
async function getUserById(uid) {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      metadata: userRecord.metadata,
    };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('User not found');
    }
    throw new Error('Failed to get user');
  }
}

/**
 * Save user data to Firestore users collection
 * @param {string} uid - User UID
 * @param {Object} userData - User data to save
 * @returns {Promise<void>}
 */
async function saveUserToFirestore(uid, userData) {
  try {
    const db = getDb();
    const userDoc = {
      email: userData.email,
      name: userData.name || '',
      phoneNumber: userData.phoneNumber || '',
      role: 'user',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(uid).set(userDoc, { merge: true });
  } catch (error) {
    console.error('Error saving user to Firestore:', error);
    throw new Error('Failed to save user data');
  }
}

/**
 * Get user data from Firestore
 * @param {string} uid - User UID
 * @returns {Promise<Object>} - User data from Firestore
 */
async function getUserFromFirestore(uid) {
  try {
    const db = getDb();
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      throw new Error('User data not found');
    }

    return {
      uid,
      ...userDoc.data(),
    };
  } catch (error) {
    if (error.message === 'User data not found') {
      throw error;
    }
    console.error('Error getting user from Firestore:', error);
    throw new Error('Failed to get user data');
  }
}

/**
 * Update user password
 * @param {string} uid - User UID
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
async function updateUserPassword(uid, newPassword) {
  try {
    await admin.auth().updateUser(uid, {
      password: newPassword,
    });
  } catch (error) {
    if (error.code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters');
    } else if (error.code === 'auth/user-not-found') {
      throw new Error('User not found');
    }
    throw new Error('Failed to update password');
  }
}

/**
 * Delete user account
 * @param {string} uid - User UID
 * @returns {Promise<void>}
 */
async function deleteUser(uid) {
  try {
    const db = getDb();
    await admin.auth().deleteUser(uid);
    // Optionally delete user data from Firestore
    await db.collection('users').doc(uid).delete();
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('User not found');
    }
    throw new Error('Failed to delete user');
  }
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  saveUserToFirestore,
  getUserFromFirestore,
  updateUserPassword,
  deleteUser,
};
