/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user info to request object
 */

const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');

/**
 * Middleware to verify JWT token and attach user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function verifyTokenMiddleware(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided. Please login first.',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Attach user info to request object
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token. Please login again.',
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 * Attaches user to request if token is valid, but continues even if not
 */
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      };
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  
  next();
}

module.exports = {
  verifyToken: verifyTokenMiddleware,
  optionalAuth,
};


