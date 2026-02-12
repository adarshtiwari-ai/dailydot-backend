const express = require("express");
const { body, validationResult, query } = require("express-validator");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/v1/reviews:
 *   post:
 *     summary: Create a review for a completed booking
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingId
 *               - rating
 *               - comment
 *             properties:
 *               bookingId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               detailedRatings:
 *                 type: object
 *                 properties:
 *                   quality:
 *                     type: number
 *                   punctuality:
 *                     type: number
 *                   professionalism:
 *                     type: number
 *                   valueForMoney:
 *                     type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Validation error or booking not eligible
 *       404:
 *         description: Booking not found
 */
router.post(
  "/",
  auth,
  [
    // Validation: Make bookingId optional here, check inside
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("comment")
      .isLength({ min: 10, max: 1000 })
      .withMessage("Comment must be between 10 and 1000 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      let { bookingId, serviceId, rating, comment, detailedRatings, images } = req.body;
      console.log("Create Review Request Body:", req.body); // Debug Log
      console.log("User:", req.user._id); // Debug Log

      // 1. If we don't have a bookingId, try to find one using serviceId
      if (!bookingId) {
        if (!serviceId) {
          return res.status(400).json({ success: false, message: "Either bookingId or serviceId is required" });
        }
        // Find latest completed booking for this user & service
        const latestBooking = await Booking.findOne({
          userId: req.user._id,
          serviceId: serviceId,
          status: "completed"
        }).sort({ createdAt: -1 });

        if (!latestBooking) {
          return res.status(400).json({
            success: false,
            message: "You haven't completed a booking for this service yet."
          });
        }
        bookingId = latestBooking._id;
      }

      // Check if booking exists and belongs to user
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      if (booking.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Check if booking is completed
      if (booking.status !== "completed") {
        return res.status(400).json({
          success: false,
          message: "Can only review completed bookings",
        });
      }

      // Check if review already exists
      const existingReview = await Review.findOne({ bookingId });
      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: "You have already reviewed this service/booking.",
        });
      }

      // Create review
      const review = await Review.create({
        bookingId,
        userId: req.user._id,
        serviceId: booking.serviceId,
        rating,
        comment,
        detailedRatings,
        images: images || [],
      });

      const populatedReview = await Review.findById(review._id)
        .populate("userId", "name email")
        .populate("serviceId", "name")
        .populate("bookingId", "bookingNumber");

      res.status(201).json({
        success: true,
        message: "Review submitted successfully",
        review: populatedReview,
      });
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create review",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/reviews/service/{serviceId}:
 *   get:
 *     summary: Get reviews for a specific service
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [approved, pending, rejected, flagged]
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get("/service/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status = "approved", rating, page = 1, limit = 10 } = req.query;

    const query = { serviceId };

    // Only show approved reviews to public
    if (!req.user || req.user.role !== "admin") {
      query.status = "approved";
    } else if (status) {
      query.status = status;
    }

    if (rating) {
      query.rating = parseInt(rating);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reviews, total, stats] = await Promise.all([
      Review.find(query)
        .populate("userId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Review.countDocuments(query),
      Review.getServiceStats(serviceId),
    ]);

    res.json({
      success: true,
      reviews,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get service reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
    });
  }
});

/**
 * @swagger
 * /api/v1/reviews/my-reviews:
 *   get:
 *     summary: Get current user's reviews
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User reviews retrieved
 */
router.get("/my-reviews", auth, async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.user._id })
      .populate("serviceId", "name price")
      .populate("bookingId", "bookingNumber scheduledDate")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
    });
  }
});

/**
 * @swagger
 * /api/v1/reviews/{id}/report:
 *   post:
 *     summary: Report an inappropriate review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review reported successfully
 */
router.post(
  "/:id/report",
  auth,
  [body("reason").notEmpty().withMessage("Reason is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { reason } = req.body;

      const review = await Review.findById(req.params.id);

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        });
      }

      // Add report
      review.reportCount += 1;
      review.reportReasons.push({
        reason,
        reportedBy: req.user._id,
        reportedAt: new Date(),
      });

      // Auto-flag if reported 3 or more times
      if (review.reportCount >= 3 && review.status !== "flagged") {
        review.status = "flagged";
      }

      await review.save();

      res.json({
        success: true,
        message: "Review reported successfully",
      });
    } catch (error) {
      console.error("Report review error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to report review",
      });
    }
  }
);

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/v1/reviews/admin/reviews:
 *   get:
 *     summary: Get all reviews (Admin only)
 *     tags: [Reviews - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, flagged]
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get("/admin/reviews", [auth, adminAuth], async (req, res) => {
  try {
    const {
      status,
      rating,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (rating) query.rating = parseInt(rating);
    if (search) {
      query.$or = [{ comment: { $regex: search, $options: "i" } }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate("userId", "name email phone")
        .populate("serviceId", "name category")
        .populate("bookingId", "bookingNumber")
        .populate("moderatedBy", "name")
        .populate("adminResponse.respondedBy", "name")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Review.countDocuments(query),
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get admin reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviews",
    });
  }
});

/**
 * @swagger
 * /api/v1/reviews/admin/reviews/stats:
 *   get:
 *     summary: Get review statistics (Admin only)
 *     tags: [Reviews - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get("/admin/reviews/stats", [auth, adminAuth], async (req, res) => {
  try {
    const stats = await Review.getPlatformStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get review stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
    });
  }
});

/**
 * @swagger
 * /api/v1/reviews/admin/reviews/{id}:
 *   get:
 *     summary: Get single review details (Admin only)
 *     tags: [Reviews - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review details retrieved
 *       404:
 *         description: Review not found
 */
router.get("/admin/reviews/:id", [auth, adminAuth], async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("userId", "name email phone")
      .populate("serviceId", "name price category")
      .populate("bookingId", "bookingNumber scheduledDate status")
      .populate("moderatedBy", "name email")
      .populate("adminResponse.respondedBy", "name");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("Get single review error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch review",
    });
  }
});

/**
 * @swagger
 * /api/v1/reviews/admin/reviews/{id}/moderate:
 *   patch:
 *     summary: Moderate review (approve/reject/flag) (Admin only)
 *     tags: [Reviews - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, flagged]
 *               moderationNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review moderated successfully
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Review not found
 */
router.patch(
  "/admin/reviews/:id/moderate",
  [auth, adminAuth],
  [
    body("status")
      .isIn(["approved", "rejected", "flagged"])
      .withMessage("Invalid status"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { status, moderationNote } = req.body;

      const review = await Review.findByIdAndUpdate(
        req.params.id,
        {
          status,
          moderationNote: moderationNote || null,
          moderatedBy: req.user._id,
          moderatedAt: new Date(),
        },
        { new: true }
      )
        .populate("userId", "name email")
        .populate("serviceId", "name")
        .populate("moderatedBy", "name");

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        });
      }

      res.json({
        success: true,
        message: `Review ${status} successfully`,
        review,
      });
    } catch (error) {
      console.error("Moderate review error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to moderate review",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/reviews/admin/reviews/{id}/respond:
 *   post:
 *     summary: Admin response to a review (Admin only)
 *     tags: [Reviews - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response added successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Review not found
 */
router.post(
  "/admin/reviews/:id/respond",
  [auth, adminAuth],
  [
    body("message")
      .isLength({ min: 10, max: 500 })
      .withMessage("Response must be between 10 and 500 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { message } = req.body;

      const review = await Review.findByIdAndUpdate(
        req.params.id,
        {
          adminResponse: {
            message,
            respondedBy: req.user._id,
            respondedAt: new Date(),
          },
        },
        { new: true }
      )
        .populate("userId", "name email")
        .populate("serviceId", "name")
        .populate("adminResponse.respondedBy", "name");

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        });
      }

      res.json({
        success: true,
        message: "Response added successfully",
        review,
      });
    } catch (error) {
      console.error("Respond to review error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to add response",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/reviews/admin/reviews/{id}:
 *   delete:
 *     summary: Delete a review (Admin only)
 *     tags: [Reviews - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       404:
 *         description: Review not found
 */
router.delete("/admin/reviews/:id", [auth, adminAuth], async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete review",
    });
  }
});

module.exports = router;
