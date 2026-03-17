const express = require("express");
const router = express.Router();
const { getActiveDiscounts } = require("../controllers/discountController");

// Public route for mobile app to fetch active promotions
router.get("/active", getActiveDiscounts);

module.exports = router;
