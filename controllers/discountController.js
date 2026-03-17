const Discount = require("../models/Discount");

// @desc    Get all active discounts
// @route   GET /api/v1/discounts/active
// @access  Public
exports.getActiveDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find({ isActive: true });
    res.status(200).json({
      success: true,
      count: discounts.length,
      data: discounts,
    });
  } catch (error) {
    console.error("Get Active Discounts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active discounts",
      error: error.message,
    });
  }
};
