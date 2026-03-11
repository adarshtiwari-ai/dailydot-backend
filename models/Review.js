const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // One review per booking
    },
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    // Detailed ratings (optional)
    detailedRatings: {
      quality: {
        type: Number,
        min: 1,
        max: 5,
      },
      punctuality: {
        type: Number,
        min: 1,
        max: 5,
      },
      professionalism: {
        type: Number,
        min: 1,
        max: 5,
      },
      valueForMoney: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
    // Moderation
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "flagged"],
      default: "pending",
    },
    moderationNote: {
      type: String,
      default: null,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderatedAt: {
      type: Date,
      default: null,
    },
    // Admin response
    adminResponse: {
      message: {
        type: String,
        default: null,
      },
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      respondedAt: {
        type: Date,
        default: null,
      },
    },
    // Helpful votes
    helpfulCount: {
      type: Number,
      default: 0,
    },
    // Images attached to review
    images: [
      {
        type: String,
      },
    ],
    // Is this a verified purchase/booking
    isVerified: {
      type: Boolean,
      default: true,
    },
    // Report/flag tracking
    reportCount: {
      type: Number,
      default: 0,
    },
    reportReasons: [
      {
        reason: String,
        reportedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
reviewSchema.index({ serviceId: 1, status: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

// Virtual for formatted rating
reviewSchema.virtual("ratingDisplay").get(function () {
  return this.rating.toFixed(1);
});

// Method to calculate average of detailed ratings
reviewSchema.methods.getDetailedAverage = function () {
  const ratings = this.detailedRatings;
  if (!ratings) return null;

  const values = Object.values(ratings).filter((v) => v != null);
  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  return (sum / values.length).toFixed(1);
};

// Static method to get review stats for a service
reviewSchema.statics.getServiceStats = async function (serviceId) {
  const stats = await this.aggregate([
    {
      $match: {
        serviceId: mongoose.Types.ObjectId(serviceId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: "$rating" },
        fiveStarCount: {
          $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] },
        },
        fourStarCount: {
          $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] },
        },
        threeStarCount: {
          $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] },
        },
        twoStarCount: {
          $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] },
        },
        oneStarCount: {
          $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] },
        },
      },
    },
  ]);

  return (
    stats[0] || {
      totalReviews: 0,
      averageRating: 0,
      fiveStarCount: 0,
      fourStarCount: 0,
      threeStarCount: 0,
      twoStarCount: 0,
      oneStarCount: 0,
    }
  );
};

// Static method to get overall platform stats
reviewSchema.statics.getPlatformStats = async function () {
  const [overallStats, recentStats, statusStats] = await Promise.all([
    // Overall statistics
    this.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          approvedReviews: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          pendingReviews: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          rejectedReviews: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          flaggedReviews: {
            $sum: { $cond: [{ $eq: ["$status", "flagged"] }, 1, 0] },
          },
          fiveStarCount: {
            $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] },
          },
          oneStarCount: {
            $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] },
          },
        },
      },
    ]),

    // Recent reviews (last 30 days)
    this.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),

    // Status breakdown
    this.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const stats = overallStats[0] || {
    totalReviews: 0,
    averageRating: 0,
    approvedReviews: 0,
    pendingReviews: 0,
    rejectedReviews: 0,
    flaggedReviews: 0,
    fiveStarCount: 0,
    oneStarCount: 0,
  };

  return {
    ...stats,
    recentReviewsCount: recentStats,
    statusBreakdown: statusStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
  };
};

module.exports = mongoose.model("Review", reviewSchema);
