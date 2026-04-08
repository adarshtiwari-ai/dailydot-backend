const express = require("express");
const { body } = require("express-validator");
const { auth, adminAuth } = require("../middleware/auth");
const bookingController = require("../controllers/bookingController");

const router = express.Router();

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - scheduledDate
 *               - serviceAddress
 *             properties:
 *               serviceId:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               serviceAddress:
 *                 type: object
 *                 properties:
 *                   addressLine1:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   pincode:
 *                     type: string
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post(
  "/",
  auth,
  [
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.serviceId")
      .if((value, { req }) => req.body.bookingType !== "consultation")
      .notEmpty()
      .withMessage("Service ID is required"),
    body("scheduledDate").isISO8601().withMessage("Valid date is required"),
    body("scheduledTime").notEmpty().withMessage("Time slot is required"),
    body("serviceAddress.addressLine1").notEmpty().withMessage("Address is required"),
    body("serviceAddress.city").notEmpty().withMessage("City is required"),
    body("serviceAddress.pincode").notEmpty().withMessage("Pincode is required"),
    body("name").optional().isString(),
    body("phone").optional().isString(),
  ],
  bookingController.createBooking
);

/**
 * @swagger
 * /api/v1/bookings/calculate:
 *   post:
 *     summary: Calculate checkout pricing (SSOT)
 *     tags: [Bookings]
 */
router.post("/calculate", bookingController.calculateCheckoutPricing);
router.post("/validate-promo", auth, bookingController.calculateCheckoutPricing);

/**
 * @swagger
 * /api/v1/bookings/my-bookings:
 *   get:
 *     summary: Get user's bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's bookings
 */
router.get("/my-bookings", auth, bookingController.getMyBookings);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Booking details
 */
router.get("/:id", auth, bookingController.getBookingById);

/**
 * @swagger
 * /api/v1/bookings/{id}/status:
 *   patch:
 *     summary: Update booking status (Admin only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
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
 *                 enum: [pending, confirmed, completed, cancelled]
 */
router.patch(
  "/:id/status",
  [auth, adminAuth],
  [
    body("status")
      .isIn(["pending", "confirmed", "assigned", "on_the_way", "in_progress", "completed", "cancelled"])
      .withMessage("Invalid status"),
    body("professionalId")
      .optional()
      .isMongoId()
      .withMessage("Invalid Professional ID format"),
    body("proName").optional().isString(),
    body("proPhone").optional().isString(),
  ],
  bookingController.updateBookingStatus
);

/**
 * @swagger
 * /api/v1/bookings/{id}/assign-worker:
 *   patch:
 *     summary: Assign worker (Simulation)
 *     tags: [Bookings]
 */
router.patch("/:id/assign-worker", auth, bookingController.assignWorker);

/**
 * @swagger
 * /api/v1/bookings/{id}/update-location:
 *   patch:
 *     summary: Update worker location
 *     tags: [Bookings]
 */
router.patch("/:id/update-location", auth, bookingController.updateLocation);

/**
 * @swagger
 * /api/v1/bookings/{id}/cancel:
 *   patch:
 *     summary: Cancel booking
 *     tags: [Bookings]
 */
router.patch("/:id/cancel", auth, bookingController.cancelBooking);

/**
 * @swagger
 * /api/v1/bookings/{id}/approve-quote:
 *   post:
 *     summary: Approve a service quote
 *     tags: [Bookings]
 */
router.post("/:id/approve-quote", auth, bookingController.approveQuote);

/**
 * @swagger
 * /api/v1/bookings/{id}/record-payment:
 *   post:
 *     summary: Record a partial or full payment
 *     tags: [Bookings]
 */
router.post("/:id/record-payment", auth, bookingController.recordPayment);

/**
 * @swagger
 * /api/v1/bookings/{id}/confirm-cod:
 *   post:
 *     summary: Confirm COD booking
 *     tags: [Bookings]
 */
router.post("/:id/confirm-cod", auth, bookingController.confirmCod);

/**
 * @swagger
 * /api/v1/bookings/{id}/rate:
 *   patch:
 *     summary: Rate a booking
 *     tags: [Bookings]
 */
router.patch(
  "/:id/rate",
  auth,
  [
    body("serviceRating").isInt({ min: 1, max: 5 }).withMessage("Service rating 1-5"),
    body("proRating").isInt({ min: 1, max: 5 }).withMessage("Pro rating 1-5"),
    body("comment").optional().isString(),
  ],
  bookingController.rateBooking
);

/**
 * @swagger
 * /api/v1/bookings:
 *   get:
 *     summary: Get all bookings (Admin only)
 *     tags: [Bookings]
 */
router.patch("/:id/add-services", [auth, adminAuth], bookingController.addServicesToBooking);
router.get("/", [auth, adminAuth], bookingController.getAllBookings);


/**
 * @swagger
 * /api/v1/bookings/{id}/invoice:
 *   get:
 *     summary: Generate standard invoice JSON
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id/invoice", auth, bookingController.generateInvoice);

module.exports = router;
