const mongoose = require("mongoose");
const slugify = require("slugify");

const discountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    maxDiscountAmount: {
      type: Number,
      default: 0, // Capping for percentage discounts (in Paise)
    },
    bannerImage: {
      type: String, // Cloudinary URL
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isUniversal: {
      type: Boolean,
      default: true,
    },
    applicableServices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Normalize code to uppercase before saving
discountSchema.pre("save", function(next) {
  if (this.code) {
    this.code = this.code.toUpperCase().replace(/\s+/g, "");
  }
  next();
});

module.exports = mongoose.model("Discount", discountSchema);
