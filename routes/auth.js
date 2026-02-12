const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: John123
 *               phone:
 *                 type: string
 *                 example: 9876543210
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or user already exists
 */
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("phone").isMobilePhone().withMessage("Valid phone number is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { name, email, password, phone } = req.body;

      const existingUser = await User.findOne({
        $or: [{ email }, { phone }],
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email or phone",
        });
      }

      const hashedPassword = await bcryptjs.hash(password, 12);

      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        phone,
      });

      // Send welcome notification (optional - comment out if not ready)
      try {
        const notificationService = require("../services/notification.service");
        notificationService
          .sendNotification("welcome", { user })
          .then(() => console.log("Welcome notification sent"))
          .catch((err) => console.error("Notification error:", err));
      } catch (error) {
        console.error("Notification service not available:", error);
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({
        success: false,
        message: "Registration failed",
      });
    }
  }
);
/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: John123
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      const user = await User.findOne({ email }).select("+password");
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const isValidPassword = await bcryptjs.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
// Change password
router.put(
  "/change-password",
  auth,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select("+password");

      // Verify current password
      const isMatch = await bcryptjs.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Incorrect current password",
        });
      }

      // Hash new password
      const hashedPassword = await bcryptjs.hash(newPassword, 12);
      user.password = hashedPassword;
      await user.save();

      res.json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
      });
    }
  }
);

router.get("/profile", auth, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// --- Device Based Auth ---

/**
 * @swagger
 * /api/v1/auth/device-login:
 *   post:
 *     summary: Login via Device ID
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId]
 *             properties:
 *               deviceId: { type: string }
 */
router.post('/device-login',
  [body('deviceId').notEmpty().withMessage('Device ID is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { deviceId } = req.body;
      const user = await User.findOne({ deviceId });

      if (!user) {
        return res.status(200).json({ success: true, isGuest: true, message: 'Device not registered' });
      }

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

      res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          deviceId: user.deviceId
        }
      });
    } catch (err) {
      console.error('Device login error:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

/**
 * @swagger
 * /api/v1/auth/register-device:
 *   post:
 *     summary: Register a new user with Device ID
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, deviceId, address]
 */
router.post('/register-device',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').isMobilePhone().withMessage('Valid phone required'),
    body('deviceId').notEmpty().withMessage('Device ID required'),
    body('address').notEmpty().withMessage('Address is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
      const { name, phone, deviceId, address } = req.body;

      // 1. Check if Device ID is already registered
      let user = await User.findOne({ deviceId });
      if (user) {
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        return res.status(200).json({
          success: true,
          token,
          user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            deviceId: user.deviceId
          }
        });
      }

      // 2. Check if Phone Number exists (Legacy/Existing User)
      user = await User.findOne({ phone });

      if (user) {
        // Link new Device ID to existing user (Account Recovery)
        user.deviceId = deviceId;

        // Optional: Update name if missing
        if (!user.name) user.name = name;

        // Add address if provided
        if (address) {
          // Check if address already exists to avoid duplicates
          const addressExists = user.addresses.some(a => a.addressLine1 === address);
          if (!addressExists) {
            user.addresses.push({
              addressLine1: address,
              type: 'home',
              isDefault: true
            });
          }
        }

        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        return res.status(200).json({
          success: true,
          message: "Device linked to existing account",
          token,
          user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            deviceId: user.deviceId
          }
        });
      }

      // 3. Create New User
      user = await User.create({
        name,
        phone,
        deviceId,
        addresses: [{
          addressLine1: address,
          type: 'home',
          isDefault: true
        }],
        email: undefined, // Explicitly undefined to respect sparse index
        password: undefined // No password
      });

      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role
        }
      });

    } catch (err) {
      console.error('Device register error:', err);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  });

module.exports = router;
