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

// Update profile (Old PUT route - keep for compatibility if needed, but we'll use PATCH for the new screen)
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

// Targeted Profile Update (New PATCH route)
router.patch(
  "/profile",
  auth,
  [
    body("name").optional().notEmpty().withMessage("Name cannot be empty"),
    body("email").optional().isEmail().withMessage("Invalid email format"),
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

      // Explicitly extract only name and email. Ignore phone and identity fields.
      const { name, email } = req.body;
      const updates = {};
      if (name) updates.name = name;
      if (email) updates.email = email;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select("-password");

      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        user,
      });
    } catch (error) {
      console.error("Profile update error:", error);
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

// Update Expo Push Token
router.patch(
  "/push-token",
  auth,
  [body("token").notEmpty().withMessage("Token is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { token } = req.body;
      await User.findByIdAndUpdate(req.user._id, { pushToken: token });

      res.json({ success: true, message: "Push token updated successfully" });
    } catch (error) {
      console.error("Update Push Token error:", error);
      res.status(500).json({ success: false, message: "Failed to update push token" });
    }
  }
);

// Add new address
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // If this is the first address, make it default
      if (user.addresses.length === 0) {
        req.body.isDefault = true;
      }

      // If new address is set to default, unset others
      if (req.body.isDefault) {
        user.addresses.forEach(addr => addr.isDefault = false);
      }

      user.addresses.push(req.body);
      await user.save();

      res.status(200).json({
        success: true,
        message: "Address added successfully",
        address: user.addresses[user.addresses.length - 1],
        addresses: user.addresses // Return updated list if needed
      });
    } catch (error) {
      console.error("Error adding address:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add address",
        error: error.message,
      });
    }
  }
);

// Delete Address
router.delete("/addresses/:addressId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.addresses = user.addresses.filter(
      (addr) => addr._id.toString() !== req.params.addressId
    );

    await user.save();
    res.json({ success: true, message: "Address deleted successfully", addresses: user.addresses });
  } catch (error) {
    console.error("Delete Address Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete address" });
  }
});

// Update Address (General Update)
router.put("/addresses/:addressId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const addressIndex = user.addresses.findIndex(
      (addr) => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    // Update fields
    const { addressLine1, addressLine2, city, state, pincode, type, receiverName, receiverPhone, isDefault } = req.body;

    // If setting default, unset others first
    if (isDefault) {
      user.addresses.forEach(a => a.isDefault = false);
    }

    user.addresses[addressIndex] = {
      ...user.addresses[addressIndex].toObject(), // Keep existing ID
      addressLine1, addressLine2, city, state, pincode, type, receiverName, receiverPhone, isDefault
    };

    await user.save();
    res.json({ success: true, message: "Address updated", addresses: user.addresses });

  } catch (error) {
    console.error("Update Address Error:", error);
    res.status(500).json({ success: false, message: "Failed to update address" });
  }
});

// Set Address as Default
router.put("/addresses/:addressId/default", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const addressExists = user.addresses.some(a => a._id.toString() === req.params.addressId);
    if (!addressExists) return res.status(404).json({ success: false, message: "Address not found" });

    // Update all addresses
    user.addresses.forEach(addr => {
      addr.isDefault = addr._id.toString() === req.params.addressId;
    });

    await user.save();
    res.json({ success: true, message: "Default address updated", addresses: user.addresses });

  } catch (error) {
    console.error("Set Default Address Error:", error);
    res.status(500).json({ success: false, message: "Failed to set default address" });
  }
});


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
