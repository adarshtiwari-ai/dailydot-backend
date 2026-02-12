const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();
/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */

/**
 * @swagger
 * /api/v1/users/addresses:
 *   post:
 *     summary: Add address
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - addressLine1
 *               - city
 *               - state
 *               - pincode
 *             properties:
 *               addressLine1:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Address added
 */

// Keep existing code below

// Get current user profile
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
    });
  }
});

// Update profile
router.put(
  "/profile",
  auth,
  [
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("phone")
      .optional()
      .isMobilePhone()
      .withMessage("Invalid phone number"),
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

      const updates = {};
      ["name", "phone"].forEach((field) => {
        if (req.body[field]) updates[field] = req.body[field];
      });

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json({
        success: true,
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
      });
    }
  }
);

// Update FCM Token
router.put(
  "/update-fcm-token",
  auth,
  [body("fcmToken").notEmpty().withMessage("Token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { fcmToken } = req.body;
      await User.findByIdAndUpdate(req.user._id, { fcmToken });

      res.json({ success: true, message: "FCM Token updated successfully" });
    } catch (error) {
      console.error("Update FCM Token error:", error);
      res.status(500).json({ success: false, message: "Failed to update token" });
    }
  }
);

// Add address
router.post(
  "/addresses",
  auth,
  [
    body("addressLine1").notEmpty().withMessage("Address line 1 is required"),
    body("city").notEmpty().withMessage("City is required"),
    body("state").notEmpty().withMessage("State is required"),
    body("pincode").notEmpty().withMessage("Pincode is required"),
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

      const user = await User.findById(req.user._id);

      // If this is the first address, make it default
      if (user.addresses.length === 0) {
        req.body.isDefault = true;
      }

      user.addresses.push(req.body);
      await user.save();

      res.json({
        success: true,
        message: "Address added successfully",
        addresses: user.addresses,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to add address",
      });
    }
  }
);

// Get all users (admin only)
router.get("/", [auth, adminAuth], async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get users",
    });
  }
});

module.exports = router;
