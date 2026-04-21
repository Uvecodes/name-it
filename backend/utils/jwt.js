/**
 * JWT Token Utilities
 * Handles token generation, verification, and validation
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET is missing or too short. Set a strong JWT_SECRET (>=32 chars).');
}

/**
 * Generate a JWT token for a user
 * @param {Object} payload - User data to encode in token
 * @param {string} payload.uid - User ID
 * @param {string} payload.email - User email
 * @returns {string} JWT token
 */
function generateToken(payload) {
  if (!payload || !payload.uid) {
    throw new Error('Invalid payload: uid is required');
  }

  return jwt.sign(
    {
      uid: payload.uid,
      email: payload.email,
      name: payload.name,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  if (!token) {
    throw new Error('Token is required');
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw error;
    }
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns {string|null} Extracted token or null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove "Bearer " prefix
}

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
};


