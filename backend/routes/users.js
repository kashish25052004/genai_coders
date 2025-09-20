const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Document = require('../models/Document');
const { protect, admin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Get user dashboard data
// @route   GET /api/users/dashboard
// @access  Private
router.get('/dashboard', protect, asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get user statistics
  const [userStats, recentDocuments] = await Promise.all([
    Document.getUserStats(userId),
    Document.findByUser(userId, { limit: 5 })
  ]);

  // Calculate risk distribution
  const riskCounts = { Low: 0, Medium: 0, High: 0 };
  recentDocuments.forEach(doc => {
    if (doc.analysis?.summary?.overallRisk) {
      const risk = doc.analysis.summary.overallRisk;
      if (riskCounts.hasOwnProperty(risk)) {
        riskCounts[risk]++;
      }
    }
  });

  // Calculate document type distribution
  const typeCounts = {};
  recentDocuments.forEach(doc => {
    const type = doc.documentType || 'other';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const dashboardData = {
    user: {
      name: req.user.name,
      email: req.user.email,
      subscription: req.user.subscription,
      documentsAnalyzed: req.user.documentsAnalyzed,
      memberSince: req.user.createdAt
    },
    statistics: {
      totalDocuments: userStats.totalDocuments,
      analyzedDocuments: userStats.analyzedDocuments,
      pendingDocuments: userStats.totalDocuments - userStats.analyzedDocuments,
      riskDistribution: riskCounts,
      documentTypes: typeCounts
    },
    recentDocuments: recentDocuments.map(doc => ({
      id: doc._id,
      title: doc.title,
      documentType: doc.documentType,
      status: doc.status,
      overallRisk: doc.analysis?.summary?.overallRisk || 'Unknown',
      createdAt: doc.createdAt,
      lastAccessed: doc.lastAccessed
    })),
    subscriptionUsage: {
      used: req.user.documentsAnalyzed,
      limit: req.user.subscription.documentsLimit,
      remaining: Math.max(0, req.user.subscription.documentsLimit - req.user.documentsAnalyzed),
      percentage: Math.round((req.user.documentsAnalyzed / req.user.subscription.documentsLimit) * 100)
    }
  };

  res.status(200).json({
    success: true,
    dashboard: dashboardData
  });
}));

// @desc    Get user activity history
// @route   GET /api/users/activity
// @access  Private
router.get('/activity', protect, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const documents = await Document.find({ userId: req.user._id })
    .select('title documentType status createdAt lastAccessed analysis.summary.overallRisk')
    .sort({ lastAccessed: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Document.countDocuments({ userId: req.user._id });

  const activity = documents.map(doc => ({
    id: doc._id,
    title: doc.title,
    documentType: doc.documentType,
    status: doc.status,
    overallRisk: doc.analysis?.summary?.overallRisk || 'Unknown',
    createdAt: doc.createdAt,
    lastAccessed: doc.lastAccessed,
    action: doc.lastAccessed > doc.createdAt ? 'viewed' : 'uploaded'
  }));

  res.status(200).json({
    success: true,
    count: documents.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    activity
  });
}));

// @desc    Update user preferences
// @route   PUT /api/users/preferences
// @access  Private
router.put('/preferences', [
  protect,
  body('notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications must be a boolean'),
  body('language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de'])
    .withMessage('Language must be one of: en, es, fr, de'),
  body('theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Theme must be light or dark')
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

  const { notifications, language, theme } = req.body;
  const user = await User.findById(req.user._id);

  // Update preferences
  if (notifications !== undefined) user.preferences.notifications = notifications;
  if (language) user.preferences.language = language;
  if (theme) user.preferences.theme = theme;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Preferences updated successfully',
    preferences: user.preferences
  });
}));

// @desc    Get user subscription info
// @route   GET /api/users/subscription
// @access  Private
router.get('/subscription', protect, asyncHandler(async (req, res) => {
  const user = req.user;

  const subscriptionInfo = {
    type: user.subscription.type,
    documentsLimit: user.subscription.documentsLimit,
    documentsUsed: user.documentsAnalyzed,
    documentsRemaining: Math.max(0, user.subscription.documentsLimit - user.documentsAnalyzed),
    expiresAt: user.subscription.expiresAt,
    isActive: user.subscription.expiresAt ? new Date() < user.subscription.expiresAt : true,
    features: {
      documentAnalysis: true,
      documentComparison: user.subscription.type !== 'free',
      unlimitedQuestions: user.subscription.type === 'enterprise',
      prioritySupport: user.subscription.type === 'enterprise',
      apiAccess: user.subscription.type === 'enterprise'
    }
  };

  res.status(200).json({
    success: true,
    subscription: subscriptionInfo
  });
}));

// @desc    Delete user data (GDPR compliance)
// @route   DELETE /api/users/data
// @access  Private
router.delete('/data', [
  protect,
  body('confirmEmail')
    .isEmail()
    .withMessage('Please provide a valid email for confirmation'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
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

  const { confirmEmail, reason } = req.body;

  // Verify email matches
  if (confirmEmail.toLowerCase() !== req.user.email.toLowerCase()) {
    return res.status(400).json({
      success: false,
      message: 'Email confirmation does not match your account email'
    });
  }

  try {
    // Delete all user documents
    await Document.deleteMany({ userId: req.user._id });

    // Log the deletion request
    console.log(`Data deletion requested by user: ${req.user.email}, reason: ${reason || 'Not provided'}`);

    // In a real application, you might want to:
    // 1. Soft delete the user (set isActive to false)
    // 2. Schedule actual deletion after a grace period
    // 3. Clean up associated files
    // 4. Send confirmation email

    // For now, deactivate the account
    const user = await User.findById(req.user._id);
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Your data deletion request has been processed. Your account has been deactivated and all documents have been removed.'
    });

  } catch (error) {
    console.error('Data deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process data deletion request'
    });
  }
}));

// Admin routes

// @desc    Get all users (Admin only)
// @route   GET /api/users/admin/users
// @access  Private/Admin
router.get('/admin/users', [protect, admin], asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, status } = req.query;

  const query = {};
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (status) {
    query.isActive = status === 'active';
  }

  const users = await User.find(query)
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await User.countDocuments(query);

  res.status(200).json({
    success: true,
    count: users.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    users
  });
}));

// @desc    Get system statistics (Admin only)
// @route   GET /api/users/admin/stats
// @access  Private/Admin
router.get('/admin/stats', [protect, admin], asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    totalDocuments,
    analyzedDocuments,
    recentUsers
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    Document.countDocuments(),
    Document.countDocuments({ status: 'analyzed' }),
    User.find({ isActive: true }).sort({ createdAt: -1 }).limit(5).select('name email createdAt')
  ]);

  const stats = {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers
    },
    documents: {
      total: totalDocuments,
      analyzed: analyzedDocuments,
      pending: totalDocuments - analyzedDocuments
    },
    recentUsers: recentUsers.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      joinedAt: user.createdAt
    }))
  };

  res.status(200).json({
    success: true,
    stats
  });
}));

module.exports = router;
