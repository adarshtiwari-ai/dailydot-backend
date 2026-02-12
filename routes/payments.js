const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const { auth } = require("../middleware/auth");
const razorpay = require("../config/razorpay");

const router = express.Router();

/**
 * @swagger
 * /api/v1/payments/create-order:
 *   post:
 *     summary: Create Razorpay payment order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *             properties:
 *               bookingId:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Order created successfully
 *       404:
 *         description: Booking not found
 */

/**
 * @swagger
 * /api/v1/payments/verify:
 *   post:
 *     summary: Verify Razorpay payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *               - bookingId
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *               bookingId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 */

/**
 * @swagger
 * /api/v1/payments/webhook:
 *   post:
 *     summary: Razorpay webhook endpoint
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 */

/**
 * @swagger
 * /api/v1/payments/payment/{paymentId}:
 *   get:
 *     summary: Get payment details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details fetched
 */

/**
 * @swagger
 * /api/v1/payments/refund:
 *   post:
 *     summary: Refund payment (Admin only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *             properties:
 *               paymentId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 description: Optional partial refund amount
 *     responses:
 *       200:
 *         description: Refund processed
 */
// Create Razorpay Order

router.post(
  "/create-order",
  auth,
  [body("bookingId").notEmpty().withMessage("Booking ID is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const booking = await Booking.findById(req.body.bookingId).populate(
        "serviceId"
      );

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

      // Create Razorpay order
      const options = {
        amount: booking.totalAmount * 100, // Amount in paise
        currency: "INR",
        receipt: booking.bookingNumber,
        notes: {
          bookingId: booking._id.toString(),
          userId: req.user._id.toString(),
        },
      };

      const order = await razorpay.orders.create(options);

      // Save order ID to booking
      booking.paymentOrderId = order.id;
      await booking.save();

      res.json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          key: process.env.RAZORPAY_KEY_ID, // Send public key to frontend
        },
        booking: {
          id: booking._id,
          amount: booking.totalAmount,
        },
      });
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create payment order",
      });
    }
  }
);

// Verify Payment
router.post(
  "/verify",
  auth,
  [
    body("razorpay_order_id").notEmpty(),
    body("razorpay_payment_id").notEmpty(),
    body("razorpay_signature").notEmpty(),
    body("bookingId").notEmpty(),
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

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        bookingId,
      } = req.body;

      // Verify signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

      const isAuthentic = expectedSignature === razorpay_signature;

      if (!isAuthentic) {
        return res.status(400).json({
          success: false,
          message: "Payment verification failed",
        });
      }

      // Update booking
      const booking = await Booking.findById(bookingId);
      booking.paymentStatus = "paid";
      booking.status = "confirmed";
      booking.paymentId = razorpay_payment_id;
      booking.paidAt = new Date();
      await booking.save();

      // ADD NOTIFICATION HERE (after payment verification, before response)
      try {
        const notificationService = require("../services/notification.service");
        // Populate user details for notification
        await booking.populate("userId", "name email phone");

        notificationService
          .sendNotification("payment_success", {
            booking,
            user: booking.userId,
          })
          .then(() => console.log("Payment notification sent"))
          .catch((err) => console.error("Payment notification error:", err));
      } catch (error) {
        console.error("Notification service error:", error);
      }

      res.json({
        success: true,
        message: "Payment verified successfully",
        booking: {
          id: booking._id,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
        },
      });
    } catch (error) {
      console.error("Payment verification error:", error);
      res.status(500).json({
        success: false,
        message: "Payment verification failed",
      });
    }
  }
);

// Webhook handler for Razorpay
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const webhookSignature = req.headers["x-razorpay-signature"];

      // Verify webhook signature
      const shasum = crypto.createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET
      );
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest("hex");

      if (digest !== webhookSignature) {
        return res.status(400).json({ message: "Invalid signature" });
      }

      const event = req.body;

      // Handle different events
      switch (event.event) {
        case "payment.captured":
          // Payment successful
          const payment = event.payload.payment.entity;
          const bookingId = payment.notes.bookingId;

          const booking = await Booking.findById(bookingId);
          if (booking) {
            booking.paymentStatus = "paid";
            booking.status = "confirmed";
            await booking.save();
          }
          break;

        case "payment.failed":
          // Payment failed
          const failedPayment = event.payload.payment.entity;
          const failedBookingId = failedPayment.notes.bookingId;

          const failedBooking = await Booking.findById(failedBookingId);
          if (failedBooking) {
            failedBooking.paymentStatus = "failed";
            await failedBooking.save();
          }
          break;
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  }
);

// Get payment details
router.get("/payment/:paymentId", auth, async (req, res) => {
  try {
    const payment = await razorpay.payments.fetch(req.params.paymentId);

    res.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        status: payment.status,
        method: payment.method,
        createdAt: payment.created_at,
      },
    });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
    });
  }
});

// Refund payment (admin only)
router.post(
  "/refund",
  auth,
  [body("paymentId").notEmpty(), body("amount").optional().isNumeric()],
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const { paymentId, amount } = req.body;

      const refund = await razorpay.payments.refund(paymentId, {
        amount: amount ? amount * 100 : undefined, // Partial refund if amount provided
      });

      res.json({
        success: true,
        message: "Refund processed successfully",
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
        },
      });
    } catch (error) {
      console.error("Refund error:", error);
      res.status(500).json({
        success: false,
        message: "Refund failed",
      });
    }
  }
);

module.exports = router;
