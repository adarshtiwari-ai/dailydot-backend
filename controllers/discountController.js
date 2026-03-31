const Discount = require("../models/Discount");

/**
 * @desc    Get all active discounts for Mobile App
 * @route   GET /api/v1/discounts/active
 * @access  Public
 */
exports.getActiveDiscounts = async (req, res) => {
  try {
    const now = new Date();
    const discounts = await Discount.find({ 
      isActive: true,
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    }).populate("applicableServices", "name price");

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

/**
 * @desc    Get All Discounts (including inactive) for Admin
 * @route   GET /api/v1/discounts
 * @access  Private (Admin)
 */
exports.getAllDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find()
      .populate("applicableServices", "name price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: discounts.length,
      data: discounts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Create a new Discount
 * @route   POST /api/v1/discounts
 * @access  Private (Admin)
 */
exports.createDiscount = async (req, res) => {
  try {
    const discount = await Discount.create(req.body);
    res.status(201).json({
      success: true,
      data: discount,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Discount code already exists." });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update a Discount
 * @route   PATCH /api/v1/discounts/:id
 * @access  Private (Admin)
 */
exports.updateDiscount = async (req, res) => {
  try {
    const discount = await Discount.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!discount) {
      return res.status(404).json({ success: false, message: "Discount not found" });
    }

    res.status(200).json({ success: true, data: discount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Delete a Discount
 * @route   DELETE /api/v1/discounts/:id
 * @access  Private (Admin)
 */
exports.deleteDiscount = async (req, res) => {
  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);
    if (!discount) {
      return res.status(404).json({ success: false, message: "Discount not found" });
    }
    res.status(200).json({ success: true, message: "Discount deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
