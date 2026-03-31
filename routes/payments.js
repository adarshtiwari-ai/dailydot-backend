/*
const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const Booking = require("../models/Booking");
const { auth } = require("../middleware/auth");
const razorpay = require("../config/razorpay");

const router = express.Router();

// ... Swagger definitions omitted ...

module.exports = router;
*/
const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { createOrder, verifyPayment, handleWebhook } = require("../controllers/paymentController");

/**
 * @route   POST /api/v1/payments/create-order
 * @desc    Create a Razorpay order
 * @access  Private
 */
router.post("/create-order", auth, createOrder);

/**
 * @route   POST /api/v1/payments/verify
 * @desc    Verify Razorpay payment signature
 * @access  Private
 */
router.post("/verify", auth, verifyPayment);

/**
 * @route   POST /api/v1/payments/webhook
 * @desc    Razorpay Server-to-Server Asynchronous Sync
 * @access  Public
 */
router.post("/webhook", handleWebhook);

module.exports = router;

