const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    // Booking Contact Details
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    bookingNumber: {
      type: String,
      unique: true,
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "assigned", "on_the_way", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    // Worker Details
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    workerLocation: {
      lat: Number,
      lng: Number,
      lastUpdated: Date
    },
    otp: {
      type: String,
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentOrderId: {
      type: String,
      default: null,
    },
    paymentId: {
      type: String,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "netbanking", "wallet", "cod", null],
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    serviceAddress: {
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
    },
  },
  {
    timestamps: true,
  }
);

// Generate OTP when assigned
bookingSchema.methods.generateOtp = function () {
  this.otp = Math.floor(1000 + Math.random() * 9000).toString();
};

// Auto-generate booking number - CORRECTED VERSION
bookingSchema.pre("save", async function (next) {
  if (this.isNew && !this.bookingNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    this.bookingNumber = `BK${year}${month}${day}${random}`;
  }
  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
