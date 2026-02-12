const express = require("express");
const { body, validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();
/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - scheduledDate
 *               - serviceAddress
 *             properties:
 *               serviceId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-12-25T10:00:00Z
 *               serviceAddress:
 *                 type: object
 *                 properties:
 *                   addressLine1:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   pincode:
 *                     type: string
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/bookings/my-bookings:
 *   get:
 *     summary: Get user's bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's bookings
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking details
 *       404:
 *         description: Booking not found
 */

/**
 * @swagger
 * /api/v1/bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *       400:
 *         description: Booking cannot be cancelled
 */
/**
 * @swagger
 * /api/v1/bookings/{id}/status:
 *   patch:
 *     summary: Update booking status (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, completed, cancelled]
 *                 example: confirmed
 *     responses:
 *       200:
 *         description: Booking status updated successfully
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Booking not found
 *       403:
 *         description: Admin access required
 */
/**
 * @swagger
 * /api/v1/bookings:
 *   get:
 *     summary: Get all bookings (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all bookings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
// Keep your existing router code below

// Create booking (authenticated users)
router.post(
  "/",
  auth,
  [
    body("serviceId").notEmpty().withMessage("Service is required"),
    body("scheduledDate").isISO8601().withMessage("Valid date is required"),
    body("serviceAddress.addressLine1")
      .notEmpty()
      .withMessage("Address is required"),
    body("serviceAddress.city").notEmpty().withMessage("City is required"),
    body("serviceAddress.pincode")
      .notEmpty()
      .withMessage("Pincode is required"),
    body("name").optional().isString(),
    body("phone").optional().isString(),
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

      // ✅ ADD THIS LINE - Extract from request body
      const { serviceId, scheduledDate, serviceAddress, notes, name, phone } = req.body;

      // Get service details
      const service = await Service.findById(serviceId); // Now works
      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found",
        });
      }

      // Generate booking number
      const date = new Date();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const bookingNumber = `BK${date.getFullYear()}${random}`;

      // Create booking - Now all variables are defined
      const booking = await Booking.create({
        userId: req.user._id,
        serviceId,
        bookingNumber,
        scheduledDate,
        serviceAddress,
        totalAmount: service.price,
        name: name || req.user.name, // Fallback to user profile if not provided
        phone: phone || req.user.phone, // Fallback to user profile
        notes
      });
      // Populate the booking with service details
      const populatedBooking = await Booking.findById(booking._id)
        .populate("serviceId", "name price duration")
        .populate("userId", "name email phone");

      // ADD NOTIFICATION HERE (after booking creation, before response)
      try {
        const notificationService = require("../services/notification.service");
        notificationService
          .sendNotification("booking_confirmation", {
            booking: populatedBooking,
            user: req.user,
          })
          .then(() => console.log("Booking confirmation sent"))
          .catch((err) => console.error("Notification error:", err));
      } catch (error) {
        console.error("Notification service error:", error);
      }

      res.status(201).json({
        success: true,
        message: "Booking created successfully",
        booking: populatedBooking,
      });
    } catch (error) {
      console.error("Booking creation error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create booking",
      });
    }
  }
);
// Get user's bookings
router.get("/my-bookings", auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate("serviceId", "name price duration")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

// Get single booking
router.get("/:id", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("serviceId", "name price duration")
      .populate("userId", "name email phone");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user owns this booking or is admin
    if (
      booking.userId._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
    });
  }
});

// Update booking status (admin only)
router.patch(
  "/:id/status",
  [auth, adminAuth],
  [
    body("status")
      .isIn(["pending", "confirmed", "completed", "cancelled"])
      .withMessage("Invalid status"),
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

      const booking = await Booking.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      res.json({
        success: true,
        message: "Booking status updated successfully",
        booking,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update booking",
      });
    }
  }
);

// Assign Worker (Simulation)
router.patch(
  "/:id/assign-worker",
  auth,
  async (req, res) => {
    try {
      // In a real app, this would be admin only or matching algorithm
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found" });
      }

      booking.status = "assigned";
      booking.workerId = req.user._id; // Assigning current user as worker for testing
      booking.generateOtp();
      await booking.save();

      // Notify User
      try {
        const notificationService = require("../services/notification.service");
        await booking.populate("userId");
        notificationService.sendPushNotification(
          booking.userId._id,
          "Worker Assigned 👷",
          `${req.user.name} has been assigned to your booking!`,
          { bookingId: booking._id.toString(), type: "worker_assigned" }
        );
      } catch (err) {
        console.error("Notification error:", err);
      }

      res.json({ success: true, message: "Worker assigned", booking });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to assign worker" });
    }
  }
);

// Update Location
router.patch(
  "/:id/update-location",
  auth,
  async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const booking = await Booking.findByIdAndUpdate(
        req.params.id,
        {
          workerLocation: { lat, lng, lastUpdated: new Date() },
          status: "on_the_way"
        },
        { new: true }
      );

      // Emit socket event
      const { getIo } = require("../services/socket.service");
      try {
        getIo().to(req.params.id).emit("location_update", { lat, lng });
      } catch (err) {
        console.log("Socket emit failed", err.message);
      }

      res.json({ success: true, location: { lat, lng } });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to update location" });
    }
  }
);

// Cancel booking
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if booking can be cancelled
    if (booking.status !== "pending" && booking.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Booking cannot be cancelled",
      });
    }

    booking.status = "cancelled";
    await booking.save();

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
    });
  }
});

// Confirm COD booking
router.post("/:id/confirm-cod", auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if booking can be confirmed
    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Booking is not in pending state",
      });
    }

    booking.status = "confirmed";
    booking.paymentMethod = "cod";
    booking.paymentStatus = "pending";
    await booking.save();

    // Send notification
    try {
      const notificationService = require("../services/notification.service");
      await booking.populate("userId", "name email phone");
      notificationService
        .sendNotification("booking_confirmation", {
          booking,
          user: booking.userId,
        })
        .catch((err) => console.error("Notification error:", err));
    } catch (error) {
      console.error("Notification service error:", error);
    }

    res.json({
      success: true,
      message: "Booking confirmed with Cash on Delivery",
      booking,
    });
  } catch (error) {
    console.error("COD confirmation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm booking",
    });
  }
});

// Get all bookings (admin only)
router.get("/", [auth, adminAuth], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 0;
    const bookings = await Booking.find()
      .populate("serviceId", "name price")
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

module.exports = router;
