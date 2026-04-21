/**
 * Authentication Routes
 * Handles user registration, login, logout, password reset, and user info
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const profileService = require('../services/profileService');
const { verifyUserCredentials, generatePasswordResetLink } = require('../utils/firebaseAuth');
const { generateToken } = require('../utils/jwt');
const { verifyToken } = require('../middleware/auth');
const { authLimiter, strictAuthLimiter } = require('../middleware/rateLimit');
const { safeErrorLog } = require('../middleware/security');

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
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

      const { email, password, name, phoneNumber } = req.body;

      // Create user with Firebase Admin SDK
      const userRecord = await authService.createUser(email, password, {
        name,
        phoneNumber: phoneNumber || '',
      });

      // Save user data to Firestore
      await authService.saveUserToFirestore(userRecord.uid, {
        email,
        name,
        phoneNumber: phoneNumber || '',
      });

      // Generate JWT token
      const token = generateToken({
        uid: userRecord.uid,
        email: userRecord.email,
        name,
      });

      // Fetch complete user data from Firestore
      const userData = await authService.getUserFromFirestore(userRecord.uid);

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          name: userData.name,
          phoneNumber: userData.phoneNumber,
          role: userData.role || 'user',
        },
      });
    } catch (error) {
      safeErrorLog('auth.register', req, error);
      
      // Handle specific errors
      if (error.message.includes('already exists')) {
        return res.status(400).json({
          error: 'Registration failed',
          message: 'Unable to complete registration.',
        });
      }

      res.status(500).json({
        error: 'Registration failed',
        message: 'Failed to create user account',
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  strictAuthLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
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

      const { email, password } = req.body;

      // Verify credentials using Firebase Auth REST API
      const authData = await verifyUserCredentials(email, password);

      // Fetch user data from Firestore
      const userData = await authService.getUserFromFirestore(authData.uid);

      // Generate JWT token
      const token = generateToken({
        uid: authData.uid,
        email: authData.email,
        name: userData.name || '',
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          uid: authData.uid,
          email: authData.email,
          name: userData.name,
          phoneNumber: userData.phoneNumber,
          role: userData.role || 'user',
        },
      });
    } catch (error) {
      safeErrorLog('auth.login', req, error);

      // Handle authentication errors
      if (error.code || error.message.includes('Invalid') || error.message.includes('not found')) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      res.status(500).json({
        error: 'Login failed',
        message: 'Failed to authenticate user',
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal, this endpoint is for consistency)
 */
router.post('/logout', (req, res) => {
  res.json({
    message: 'Logout successful',
  });
});

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post(
  '/forgot-password',
  strictAuthLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: errors.array()[0].msg,
        });
      }

      const { email } = req.body;

      // Generate password reset link
      const resetLink = await generatePasswordResetLink(email);

      // In production, you would send the email here
      // For now, we'll just return success
      // TODO: Implement email sending service

      res.json({
        message: 'Password reset email sent',
      });
    } catch (error) {
      safeErrorLog('auth.forgot_password', req, error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Password reset failed',
          message: 'If the email exists, a reset link has been sent.',
        });
      }

      res.status(500).json({
        error: 'Password reset failed',
        message: 'Failed to send password reset email',
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user information (protected route)
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    // req.user is set by verifyToken middleware
    const { uid } = req.user;

    // Fetch user data from Firestore
    const userData = await authService.getUserFromFirestore(uid);

    // Get extended profile data
    const profile = await profileService.getProfile(uid);

    res.json({
      user: {
        uid,
        email: userData.email,
        name: userData.name || profile?.name,
        phoneNumber: userData.phoneNumber || profile?.phoneNumber,
        role: userData.role || 'user',
        createdAt: userData.createdAt,
        avatarUrl: profile?.avatarUrl || null,
        address: profile?.address || null,
        city: profile?.city || null,
        state: profile?.state || null,
        country: profile?.country || null,
        location: profileService.getLocationString(profile),
      },
    });
  } catch (error) {
    safeErrorLog('auth.me', req, error);

    res.status(500).json({
      error: 'Failed to get user information',
      message: 'Failed to fetch user data',
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile (protected route)
 */
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const profileData = req.body;

    const updatedProfile = await profileService.updateProfile(uid, profileData);

    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfile,
    });
  } catch (error) {
    safeErrorLog('auth.profile_update', req, error);

    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Failed to update profile',
    });
  }
});

/**
 * POST /api/auth/avatar
 * Upload avatar (protected route)
 * Expects JSON with base64 image or URL
 */
router.post('/avatar', verifyToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Avatar URL is required',
      });
    }

    const updatedProfile = await profileService.updateAvatar(uid, avatarUrl);

    res.json({
      message: 'Avatar updated successfully',
      avatarUrl: updatedProfile?.avatarUrl,
    });
  } catch (error) {
    safeErrorLog('auth.avatar', req, error);

    res.status(500).json({
      error: 'Failed to upload avatar',
      message: 'Failed to upload avatar',
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (protected route)
 */
router.post(
  '/change-password',
  verifyToken,
  strictAuthLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
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

      const { uid, email } = req.user;
      const { currentPassword, newPassword } = req.body;

      // Verify current password by attempting to authenticate
      try {
        await verifyUserCredentials(email, currentPassword);
      } catch (authError) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Current password is incorrect',
        });
      }

      // Update password using Firebase Admin SDK
      await authService.updateUserPassword(uid, newPassword);

      res.json({
        message: 'Password changed successfully',
      });
    } catch (error) {
      safeErrorLog('auth.change_password', req, error);

      res.status(500).json({
        error: 'Failed to change password',
        message: 'Failed to change password',
      });
    }
  }
);

/**
 * DELETE /api/auth/account
 * Delete user account (protected route)
 */
router.delete(
  '/account',
  verifyToken,
  strictAuthLimiter,
  [
    body('password').notEmpty().withMessage('Password is required to delete account'),
    body('confirmDelete').equals('DELETE').withMessage('Please type DELETE to confirm'),
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

      const { uid, email } = req.user;
      const { password } = req.body;

      // Verify password before deletion
      try {
        await verifyUserCredentials(email, password);
      } catch (authError) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Incorrect password',
        });
      }

      // Delete user account
      await authService.deleteUser(uid);

      res.json({
        message: 'Account deleted successfully',
      });
    } catch (error) {
      safeErrorLog('auth.delete_account', req, error);

      res.status(500).json({
        error: 'Failed to delete account',
        message: 'Failed to delete account',
      });
    }
  }
);

module.exports = router;
