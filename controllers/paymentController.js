const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Booking = require("../models/Booking");
const { validationResult } = require("express-validator");
const eventHub = require("../services/event.service");

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
        // Ensure we are using the requested amount or grand total
        const amountPaise = req.body.amount ? Math.round(req.body.amount) : Math.round(booking.quote?.total || booking.totalAmount);

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

        // 2. Fetch order details from Razorpay to get the exact amount paid
        const razorpayOrder = await razorpay.orders.fetch(razorpay_order_id);
        const incomingAmount = razorpayOrder.amount;

        // 3. Update Ledger: Atomic Increment & Installment Push
        const booking = await Booking.findOne({ paymentOrderId: razorpay_order_id });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking record for this payment not found",
            });
        }

        booking.paidAmount = (booking.paidAmount || 0) + incomingAmount;
        
        booking.installments.push({
            amount: incomingAmount,
            method: 'online',
            transactionId: razorpay_payment_id,
            status: 'paid',
            paidAt: Date.now()
        });

        // 4. Status Progression
        const targetTotal = booking.quote?.total || booking.totalAmount;
        
        if (booking.paidAmount >= targetTotal) {
            booking.paymentStatus = "paid";
            booking.status = "confirmed";
        } else if (booking.paidAmount > 0) {
            booking.paymentStatus = "partial";
            // Do not force "confirmed" on partial payments if custom status logic is needed
        }

        booking.paymentId = razorpay_payment_id;
        booking.paidAt = Date.now();
        await booking.save();

        // 3. Trust Engine: Verify past/future user reviews
        const Review = require("../models/Review");
        try {
            await Review.updateMany(
                { userId: booking.userId },
                { $set: { isVerified: true } }
            );
        } catch (reviewErr) {
            console.error("Failed to mark reviews as verified:", reviewErr);
        }

        const updatedBooking = await Booking.findById(booking._id).populate('items.serviceId');

        res.status(200).json({
            success: true,
            message: "Payment verified and record updated",
            booking: updatedBooking
        });

        // Emit BOOKING_CREATED event globally
        eventHub.emit("BOOKING_CREATED", {
            booking: updatedBooking,
            user: updatedBooking.userId,
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

/**
 * @desc    Handle Razorpay Webhooks
 * @route   POST /api/v1/payments/webhook
 * @access  Public
 */
exports.handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const rawBody = req.rawBody;

        if (!signature || !rawBody) {
            return res.status(400).send("Bad Request: Missing signature or raw body");
        }

        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

        if (expectedSignature !== signature) {
            console.error("WEBHOOK SIGNATURE MISMATCH");
            return res.status(400).send("Invalid Webhook Signature");
        }

        const { event, payload } = req.body;

        // Process successful payment events
        if (event === "payment.captured" || event === "order.paid") {
            const entity = payload.payment ? payload.payment.entity : payload.order.entity;
            const orderId = entity.order_id || entity.id; // order_id exists on payment entity, id is on order entity
            const paymentId = payload.payment ? payload.payment.entity.id : null;

            const booking = await Booking.findOne({ paymentOrderId: orderId });

            if (booking && booking.paymentStatus !== "paid") {
                const incomingAmount = entity.amount;

                booking.paidAmount = (booking.paidAmount || 0) + incomingAmount;
                
                booking.installments.push({
                    amount: incomingAmount,
                    method: 'online',
                    transactionId: paymentId,
                    status: 'paid',
                    paidAt: Date.now()
                });

                const targetTotal = booking.quote?.total || booking.totalAmount;
                
                if (booking.paidAmount >= targetTotal) {
                    booking.paymentStatus = "paid";
                    booking.status = "confirmed";
                } else if (booking.paidAmount > 0) {
                    booking.paymentStatus = "partial";
                }

                if (paymentId) booking.paymentId = paymentId;
                booking.paidAt = Date.now();
                await booking.save();

                // Trust Engine: Verify all associated reviews for this user
                const Review = require("../models/Review");
                try {
                    await Review.updateMany(
                        { userId: booking.userId },
                        { $set: { isVerified: true } }
                    );
                } catch (reviewErr) {
                    console.error("Webhook Trust Engine Error:", reviewErr);
                }
            }
        }

        res.status(200).json({ status: "ok" });
    } catch (error) {
        console.error("WEBHOOK ERROR:", error);
        res.status(500).send("Internal Server Error processing webhook");
    }
};
