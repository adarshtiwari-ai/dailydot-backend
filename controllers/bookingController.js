const User = require("../models/User");
const Booking = require("../models/Booking");
const Professional = require("../models/Professional");
const Service = require("../models/Service");
const { validationResult } = require("express-validator");
const { sendPushNotification } = require("../utils/pushService");
const notificationService = require("../services/notification.service");

// @desc    Create a new booking
// @route   POST /api/v1/bookings
// @access  Private
exports.createBooking = async (req, res) => {
    console.log("--- NEW BOOKING REQUEST RECEIVED ---");
    console.log("Body:", req.body);
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
            });
        }

        const {
            items,
            scheduledDate,
            scheduledTime,
            serviceAddress,
            notes,
            name,
            phone,
        } = req.body;

        // Process items and calculate total amount securely
        const detailedItems = [];
        let totalAmount = 0;

        for (const item of items) {
            const service = await Service.findById(item.serviceId);
            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: `Service not found: ${item.serviceId}`,
                });
            }

            detailedItems.push({
                serviceId: service._id,
                name: service.name,
                price: service.price,
                quantity: item.quantity || 1,
            });

            totalAmount += service.price * (item.quantity || 1);
        }

        // Generate booking number
        const date = new Date();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const bookingNumber = `BK${date.getFullYear()}${random}`;

        // Create booking
        const booking = await Booking.create({
            userId: req.user._id,
            items: detailedItems,
            bookingNumber,
            scheduledDate,
            scheduledTime,
            serviceAddress,
            totalAmount,
            name: name || req.user.name,
            phone: phone || req.user.phone,
            notes,
            paymentMethod: "cod",
            paymentStatus: "pending",
        });

        // Populate the booking with details
        const populatedBooking = await Booking.findById(booking._id)
            .populate("items.serviceId", "name price duration")
            .populate("userId", "name email phone");

        // Send Notification (Background)
        notificationService
            .sendNotification("booking_confirmation", {
                booking: populatedBooking,
                user: populatedBooking.userId,
            })
            .then(() => console.log("Booking confirmation sent"))
            .catch((err) => console.error("Notification error:", err));

        res.status(201).json({
            success: true,
            message: "Booking created successfully",
            booking: populatedBooking,
        });
    } catch (error) {
        console.error("CRITICAL BOOKING ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// @desc    Get user's bookings
// @route   GET /api/v1/bookings/my-bookings
// @access  Private
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user._id })
            .populate("items.serviceId", "name price duration")
            .populate("assignedPro", "name phone averageRating totalRatings")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: bookings.length,
            bookings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
        });
    }
};

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Private
exports.getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate("items.serviceId", "name price duration")
            .populate("userId", "name email phone")
            .populate("assignedPro", "name phone averageRating totalRatings");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Check if user owns this booking or is admin
        if (
            booking.userId._id.toString() !== req.user._id.toString() &&
            req.user.role !== "admin"
        ) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        res.json({
            success: true,
            booking,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch booking",
        });
    }
};

// @desc    Update booking status (Admin only)
// @route   PATCH /api/v1/bookings/:id/status
// @access  Private (Admin)
exports.updateBookingStatus = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
            });
        }

        const { status, proName, proPhone } = req.body;
        let assignedProId = null;

        // Logic for Assigning Professional on Confirmation
        if (status === "confirmed" && proName && proPhone) {
            // Find or create pro
            let pro = await Professional.findOne({ phone: proPhone });
            if (!pro) {
                pro = await Professional.create({
                    name: proName,
                    phone: proPhone,
                });
                console.log(`New Professional Created: ${pro.name}`);
            }
            assignedProId = pro._id;
        }

        const updateData = { status };
        if (assignedProId) {
            updateData.assignedPro = assignedProId;
        }

        const booking = await Booking.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
        }).populate("assignedPro");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        res.json({
            success: true,
            message: "Booking status updated successfully",
            booking,
        });

        // Trigger Push Notifications based on status (Background)
        if (status === "confirmed") {
            sendPushNotification(
                booking.userId,
                "Booking Confirmed! 🎉",
                "Your professional has been assigned and is on the way.",
                { screen: "History", bookingId: booking._id.toString() }
            ).catch((notifyError) =>
                console.error("Non-blocking notification error:", notifyError)
            );
        } else if (status === "completed") {
            sendPushNotification(
                booking.userId,
                "Service Complete ✅",
                "Please tap here to rate your professional and view your receipt.",
                { screen: "History", bookingId: booking._id.toString() }
            ).catch((notifyError) =>
                console.error("Non-blocking notification error:", notifyError)
            );
        }
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update booking",
        });
    }
};

// @desc    Assign Worker (Simulation)
// @route   PATCH /api/v1/bookings/:id/assign-worker
// @access  Private
exports.assignWorker = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res
                .status(404)
                .json({ success: false, message: "Booking not found" });
        }

        // Consolidated: Use assignedPro instead of workerId
        // Note: This simulation assigns the current user as the professional
        // In a real scenario, this would likely be a ref: Professional
        // However, to maintain functional parity with the original simulation:
        // We'll update the assignedPro. If the current user isn't in Professional table, 
        // we might need to create a dummy pro or just set the ID.
        // For consistency with the NEW schema which refs Professional:

        let pro = await Professional.findOne({ phone: req.user.phone });
        if (!pro) {
            pro = await Professional.create({
                name: req.user.name,
                phone: req.user.phone
            });
        }

        booking.status = "assigned";
        booking.assignedPro = pro._id; // Consolidated field
        booking.generateOtp();
        await booking.save();

        // Notify User
        try {
            await booking.populate("userId");
            notificationService.sendPushNotification(
                booking.userId._id,
                "Worker Assigned 👷",
                `${req.user.name} has been assigned to your booking!`,
                { bookingId: booking._id.toString(), type: "worker_assigned" }
            );
        } catch (err) {
            console.error("Notification error:", err);
        }

        res.json({ success: true, message: "Worker assigned", booking });
    } catch (error) {
        console.error("Assign Worker Error:", error);
        res.status(500).json({ success: false, message: "Failed to assign worker" });
    }
};

// @desc    Update Location
// @route   PATCH /api/v1/bookings/:id/update-location
// @access  Private
exports.updateLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            {
                workerLocation: { lat, lng, lastUpdated: new Date() },
                status: "on_the_way",
            },
            { new: true }
        );

        // Emit socket event
        const { getIo } = require("../services/socket.service");
        try {
            getIo().to(req.params.id).emit("location_update", { lat, lng });
        } catch (err) {
            console.log("Socket emit failed", err.message);
        }

        res.json({ success: true, location: { lat, lng } });
    } catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to update location" });
    }
};

// @desc    Cancel booking
// @route   PATCH /api/v1/bookings/:id/cancel
// @access  Private
exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Check if user owns this booking
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        // Check if booking can be cancelled
        if (booking.status !== "pending" && booking.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: "Booking cannot be cancelled",
            });
        }

        booking.status = "cancelled";
        await booking.save();

        res.json({
            success: true,
            message: "Booking cancelled successfully",
            booking,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to cancel booking",
        });
    }
};

// @desc    Confirm COD booking
// @route   POST /api/v1/bookings/:id/confirm-cod
// @access  Private
exports.confirmCod = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Check if user owns this booking
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        // Check if booking can be confirmed
        if (booking.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Booking is not in pending state",
            });
        }

        booking.status = "confirmed";
        booking.paymentMethod = "cod";
        booking.paymentStatus = "pending";
        await booking.save();

        // Send notification
        try {
            await booking.populate("userId", "name email phone");
            notificationService
                .sendNotification("booking_confirmation", {
                    booking,
                    user: booking.userId,
                })
                .catch((err) => console.error("Notification error:", err));
        } catch (error) {
            console.error("Notification service error:", error);
        }

        res.json({
            success: true,
            message: "Booking confirmed with Cash on Delivery",
            booking,
        });
    } catch (error) {
        console.error("COD confirmation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to confirm booking",
        });
    }
};

// @desc    Rate a booking
// @route   PATCH /api/v1/bookings/:id/rate
// @access  Private
exports.rateBooking = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { serviceRating, proRating, comment } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res
                .status(404)
                .json({ success: false, message: "Booking not found" });
        }

        // Check ownership
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        // Check if already rated
        if (booking.isRated) {
            return res
                .status(400)
                .json({ success: false, message: "Booking already rated" });
        }

        // Update Booking
        booking.serviceRating = serviceRating;
        booking.proRating = proRating;
        booking.comment = comment;
        booking.isRated = true;
        await booking.save();

        // Update Service Average Rating
        if (booking.items && booking.items.length > 0) {
            const serviceId = booking.items[0].serviceId;
            const service = await Service.findById(serviceId);
            if (service) {
                const newTotalRatings = (service.totalRatings || 0) + 1;
                const currentTotalScore =
                    (service.averageRating || 0) * (service.totalRatings || 0);
                const newAverage =
                    (currentTotalScore + serviceRating) / newTotalRatings;

                service.totalRatings = newTotalRatings;
                service.averageRating = newAverage;
                await service.save();
            }
        }

        // Update Professional Average Rating
        if (booking.assignedPro) {
            const pro = await Professional.findById(booking.assignedPro);
            if (pro) {
                const newTotalRatings = (pro.totalRatings || 0) + 1;
                const currentTotalScore =
                    (pro.averageRating || 0) * (pro.totalRatings || 0);
                const newAverage = (currentTotalScore + proRating) / newTotalRatings;

                pro.totalRatings = newTotalRatings;
                pro.averageRating = newAverage;
                await pro.save();
            }
        }

        res.json({
            success: true,
            message: "Rating submitted successfully",
            booking,
        });
    } catch (error) {
        console.error("Rating Error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to submit rating" });
    }
};

// @desc    Get all bookings (Admin only)
// @route   GET /api/v1/bookings
// @access  Private (Admin)
exports.getAllBookings = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 0;
        const bookings = await Booking.find()
            .populate("items.serviceId", "name price")
            .populate("userId", "name phone email")
            .populate("assignedPro", "name phone averageRating totalRatings")
            .sort({ createdAt: -1 })
            .limit(limit);

        res.json({
            success: true,
            count: bookings.length,
            bookings,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings",
        });
    }
};
