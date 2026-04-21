/**
 * Firebase Auth REST API Utility
 * Used for credential verification since Firebase Admin SDK doesn't support password verification directly
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Firebase Web API Key (from Firebase project settings)
// This is safe to use in backend - it's used for authentication, not authorization
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyBNlcypjh6hCAbn7WCVVYPhtHNjBOVm2Cg';
const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || 'name-it-e674c.firebaseapp.com';

const FIREBASE_AUTH_REST_API = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;

/**
 * Verify user credentials using Firebase Auth REST API
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - User authentication data with ID token
 */
async function verifyUserCredentials(email, password) {
  try {
    const response = await fetch(FIREBASE_AUTH_REST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle Firebase Auth errors
      const errorCode = data.error?.message || 'UNKNOWN_ERROR';
      let errorMessage = 'Invalid email or password';

      if (errorCode.includes('EMAIL_NOT_FOUND')) {
        errorMessage = 'No account found with this email address';
      } else if (errorCode.includes('INVALID_PASSWORD')) {
        errorMessage = 'Invalid password';
      } else if (errorCode.includes('USER_DISABLED')) {
        errorMessage = 'This account has been disabled';
      } else if (errorCode.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
        errorMessage = 'Too many failed attempts. Please try again later';
      } else if (errorCode.includes('INVALID_EMAIL')) {
        errorMessage = 'Invalid email address format';
      }

      const error = new Error(errorMessage);
      error.code = errorCode;
      throw error;
    }

    // Verify the ID token with Admin SDK to ensure it's valid
    const idToken = data.idToken;
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      idToken: idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    // Re-throw if it's already our formatted error
    if (error.code) {
      throw error;
    }

    // Handle network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      throw new Error('Network error. Please check your internet connection');
    }

    throw error;
  }
}

/**
 * Send password reset email using Firebase Admin SDK
 * @param {string} email - User email
 * @returns {Promise<string>} - Password reset link
 */
async function generatePasswordResetLink(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    return resetLink;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address');
    }
    throw new Error('Failed to generate password reset link');
  }
}

module.exports = {
  verifyUserCredentials,
  generatePasswordResetLink,
};
