const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const User = require('../models/User'); // For any inline logic if needed

// --- New Hybrid Auth Routes ---

// @route   POST /api/v1/auth/send-otp
router.post('/send-otp', authController.sendOtp);

// @route   POST /api/v1/auth/verify-otp
router.post('/verify-otp', authController.verifyOtp);

// @route   POST /api/v1/auth/social-login
router.post('/social-login', authController.socialLogin);

// @route   POST /api/v1/auth/login
router.post('/login', authController.login);

// @route   POST /api/v1/auth/refresh-token
router.post('/refresh-token', authController.refreshToken);


// --- Legacy / Maintenance Routes ---

router.get('/profile', auth, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// Keep existing Profile/Update routes if they exist and are needed
// For example, address updates might be handled here or in a user controller.

module.exports = router;
