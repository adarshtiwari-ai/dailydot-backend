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

router.post("/create-order", (req, res) => {
  res.status(503).json({ message: "Online payments are temporarily disabled." });
});

router.post("/verify", (req, res) => {
  res.status(503).json({ message: "Online payments are temporarily disabled." });
});

module.exports = router;
