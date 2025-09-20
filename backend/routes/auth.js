const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, authRateLimit } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { securityLogger } = require('../middleware/logger');

const router = express.Router();

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      documentsAnalyzed: user.documentsAnalyzed,
      preferences: user.preferences
    }
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  authRateLimit,
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { name, email, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    securityLogger('DUPLICATE_REGISTRATION_ATTEMPT', req, { email });
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password
  });

  // Log successful registration
  console.log(`New user registered: ${email}`);
  
  sendTokenResponse(user, 201, res);
}));

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  authRateLimit,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Check for user and include password
  const user = await User.findByEmail(email).select('+password');
  
  if (!user) {
    securityLogger('LOGIN_ATTEMPT_INVALID_EMAIL', req, { email });
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if account is active
  if (!user.isActive) {
    securityLogger('LOGIN_ATTEMPT_INACTIVE_ACCOUNT', req, { email });
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated. Please contact support.'
    });
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    securityLogger('LOGIN_ATTEMPT_INVALID_PASSWORD', req, { email });
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Update last login
  await user.updateLastLogin();

  console.log(`User logged in: ${email}`);
  sendTokenResponse(user, 200, res);
}));

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, asyncHandler(async (req, res) => {
  // In a more sophisticated setup, you might want to blacklist the token
  // For now, we'll just send a success response
  // The frontend should remove the token from storage
  
  console.log(`User logged out: ${req.user.email}`);
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      documentsAnalyzed: user.documentsAnalyzed,
      preferences: user.preferences,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }
  });
}));

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', [
  protect,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { name, email, preferences } = req.body;
  const user = await User.findById(req.user.id);

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already in use'
      });
    }
    user.email = email;
  }

  if (name) user.name = name;
  if (preferences) {
    user.preferences = { ...user.preferences, ...preferences };
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      documentsAnalyzed: user.documentsAnalyzed,
      preferences: user.preferences
    }
  });
}));

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', [
  protect,
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    securityLogger('PASSWORD_CHANGE_INVALID_CURRENT', req, { userId: user._id });
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  console.log(`Password changed for user: ${user.email}`);
  
  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
}));

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', [
  authRateLimit,
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email } = req.body;
  const user = await User.findByEmail(email);

  if (!user) {
    // Don't reveal if email exists or not
    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  }

  // In a real application, you would:
  // 1. Generate a reset token
  // 2. Save it to the database with expiration
  // 3. Send an email with the reset link
  
  // For now, just log the request
  console.log(`Password reset requested for: ${email}`);
  
  res.status(200).json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.'
  });
}));

// @desc    Delete account
// @route   DELETE /api/auth/account
// @access  Private
router.delete('/account', [
  protect,
  body('password')
    .notEmpty()
    .withMessage('Password is required to delete account')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { password } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    securityLogger('ACCOUNT_DELETE_INVALID_PASSWORD', req, { userId: user._id });
    return res.status(401).json({
      success: false,
      message: 'Password is incorrect'
    });
  }

  // In a real application, you might want to:
  // 1. Soft delete (set isActive to false)
  // 2. Delete associated documents
  // 3. Clean up files
  
  // For now, just deactivate the account
  user.isActive = false;
  await user.save();

  console.log(`Account deactivated: ${user.email}`);
  
  res.status(200).json({
    success: true,
    message: 'Account has been deactivated successfully'
  });
}));

module.exports = router;
