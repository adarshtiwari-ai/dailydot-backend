const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Discount", discountSchema);
