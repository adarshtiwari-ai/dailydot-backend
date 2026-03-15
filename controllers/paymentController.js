const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Booking = require("../models/Booking");
const { validationResult } = require("express-validator");

/**
 * @desc    Create a Razorpay order
 * @route   POST /api/v1/payments/create-order
 * @access  Private
 */
exports.createOrder = async (req, res) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: "Booking ID is required",
            });
        }

        // 1. Fetch the booking from the database
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // 2. Validate booking ownership
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied: Unauthorized booking",
            });
        }

        // 3. Prevent duplicate order creation if already paid
        if (booking.paymentStatus === "paid") {
            return res.status(400).json({
                success: false,
                message: "Booking is already paid",
            });
        }

        // 4. Secure Amount Calculation (Already in Paise in the database)
        // Ensure we are using the grand total calculated by the Math Engine
        const amountPaise = Math.round(booking.totalAmount);

        if (amountPaise <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking amount",
            });
        }

        // 5. Create Razorpay Order
        const options = {
            amount: amountPaise,
            currency: "INR",
            receipt: `rcpt_${booking.bookingNumber}_${Date.now()}`,
            payment_capture: 1, // Auto-capture payment
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // 6. Update booking with Razorpay Order ID
        booking.paymentOrderId = razorpayOrder.id;
        booking.paymentMethod = "online"; // Mark as attempting online payment
        await booking.save();

        res.status(200).json({
            success: true,
            order: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID
            }
        });

    } catch (error) {
        console.error("RAZORPAY ORDER ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create Razorpay order",
            error: error.message,
        });
    }
};

/**
 * @desc    Verify Razorpay payment signature
 * @route   POST /api/v1/payments/verify
 * @access  Private
 */
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        // 1. Signature Verification Math
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        const isSignatureValid = expectedSignature === razorpay_signature;

        if (!isSignatureValid) {
            console.error("RAZORPAY SIGNATURE MISMATCH");
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature. Security alert.",
            });
        }

        // 2. Update Booking Status
        // Find booking by Razorpay Order ID
        const booking = await Booking.findOne({ paymentOrderId: razorpay_order_id });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking record for this payment not found",
            });
        }

        booking.paymentStatus = "paid";
        booking.paymentId = razorpay_payment_id;
        booking.paidAt = Date.now();
        await booking.save();

        res.status(200).json({
            success: true,
            message: "Payment verified and record updated",
            bookingId: booking._id
        });

    } catch (error) {
        console.error("VERIFICATION ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Internal verification error",
            error: error.message,
        });
    }
};
