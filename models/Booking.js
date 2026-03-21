const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number, // stored in paise/cents
          set: v => Math.round(v),
          required: true,
        },
        category: {
          type: String,
          // required: true // Optional if not always available
        },
      },
    ],
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
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    scheduledTime: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Completed", "Cancelled", "pending", "confirmed", "assigned", "on_the_way", "in_progress", "completed", "cancelled"],
      default: "Pending",
    },
    totalAmount: {
      type: Number, // stored in paise/cents - This is the GRAND TOTAL
      set: v => Math.round(v),
      required: true,
    },
    // Centalized Math Engine Fields
    subtotal: {
      type: Number,
      set: v => Math.round(v),
      default: 0
    },
    taxAmount: {
      type: Number,
      set: v => Math.round(v),
      default: 0
    },
    serviceFee: {
      type: Number,
      set: v => Math.round(v),
      default: 0 // Legacy field deprecated
    },
    convenienceFee: {
      type: Number,
      set: v => Math.round(v),
      default: 0 // Legacy field deprecated
    },
    // Dynamic Invoicing Fields
    baseCost: {
      type: Number, // stored in paise/cents
      set: v => Math.round(v),
      default: function () { return this.totalAmount; }
    },
    adjustments: [
      {
        reason: { type: String, required: true },
        amount: { type: Number, set: v => Math.round(v), required: true },
        addedAt: { type: Date, default: Date.now }
      }
    ],
    taxDetails: {
      cgst: { type: Number, set: v => Math.round(v), default: 0 },
      sgst: { type: Number, set: v => Math.round(v), default: 0 },
      platformFee: { type: Number, set: v => Math.round(v), default: 0 }
    },
    finalTotal: {
      type: Number, // stored in paise/cents
      set: v => Math.round(v),
      default: function () { 
        const base = this.subtotal || this.baseCost || this.totalAmount || 0;
        const adjustmentsTotal = (this.adjustments || []).reduce((sum, adj) => sum + adj.amount, 0);
        const materialsTotal = (this.materials || []).reduce((sum, mat) => sum + (mat.cost || 0), 0);
        const tax = this.taxAmount || 0;
        const sFee = this.serviceFee || 0;
        const cFee = this.convenienceFee || 0;
        
        // If taxDetails are used (legacy/external), include them too
        const cgst = this.taxDetails?.cgst || 0;
        const sgst = this.taxDetails?.sgst || 0;
        const platformFee = this.taxDetails?.platformFee || 0;
        
        return base + adjustmentsTotal + materialsTotal + tax + sFee + cFee + cgst + sgst + platformFee;
      }
    },
    billingStatus: {
      type: String,
      enum: ['quote', 'finalized', 'invoiced'],
      default: 'quote'
    },
    materials: [
      {
        name: { type: String, required: true },
        cost: { type: Number, set: v => Math.round(v), required: true },
        addedAt: { type: Date, default: Date.now }
      }
    ],
    appliedFees: [
      {
        name: { type: String, required: true },
        amount: { type: Number, required: true }
      }
    ],
    appliedDiscounts: [
      {
        name: { type: String, required: true },
        amount: { type: Number, required: true }
      }
    ],
    // Financial Settlement Fields
    materialCost: {
      type: Number,
      default: 0
    },
    adminCommission: {
      type: Number,
      default: 0
    },
    netPlatformProfit: {
      type: Number,
      default: 0
    },
    isSettled: {
      type: Boolean,
      default: false
    },
    // New Professional Reference
    assignedPro: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Professional",
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
      enum: ["card", "upi", "netbanking", "wallet", "cod", "online", null],
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
      state: String,
      pincode: String,
      receiverName: String,
      receiverPhone: String,
    },
    // Ratings
    serviceRating: {
      type: Number,
      default: 0
    },
    proRating: {
      type: Number,
      default: 0
    },
    comment: String,
    isRated: {
      type: Boolean,
      default: false
    },
    servicePhotos: [{
      type: String
    }]
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
