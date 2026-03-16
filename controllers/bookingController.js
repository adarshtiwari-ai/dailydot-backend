const User = require("../models/User");
const Booking = require("../models/Booking");
const Professional = require("../models/Professional");
const Service = require("../models/Service");
const { validationResult } = require("express-validator");
const eventHub = require("../services/event.service");
const { generateInvoicePDF } = require("../services/pdfService");
const walletService = require("../services/walletService");

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
        let itemsSubtotal = 0;

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
                price: Math.round(service.price),
                quantity: item.quantity || 1,
            });

            itemsSubtotal += Math.round(service.price) * (item.quantity || 1);
        }

        // Centralized Math Engine (Server-Side)
        const SERVICE_FEE = 5000;
        const CONVENIENCE_FEE = 2500;
        const TAX_RATE = 0.18;
        const taxAmount = Math.round(itemsSubtotal * TAX_RATE);
        const grandTotal = itemsSubtotal + SERVICE_FEE + CONVENIENCE_FEE + taxAmount;

        // Generate booking number
        const date = new Date();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const bookingNumber = `BK${date.getFullYear()}${random}`;

        // Create booking with full breakdown
        const booking = await Booking.create({
            userId: req.user._id,
            items: detailedItems,
            bookingNumber,
            scheduledDate,
            scheduledTime,
            serviceAddress,
            // Math Engine Fields
            subtotal: itemsSubtotal,
            taxAmount,
            serviceFee: SERVICE_FEE,
            convenienceFee: CONVENIENCE_FEE,
            totalAmount: grandTotal, // Saving the real Grand Total
            baseCost: itemsSubtotal, // Consistency for Invoicing
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

        // Emit BOOKING_CREATED event
        eventHub.emit("BOOKING_CREATED", {
            booking: populatedBooking,
            user: populatedBooking.userId,
        });

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
            .populate("items.serviceId", "name price duration image imageURL imageUrl")
            .populate("assignedPro", "name phone averageRating totalRatings")
            .sort({ createdAt: -1 });

        console.log('Backend Bookings Found:', bookings.length);

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

        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        ).populate("assignedPro");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        // Provider Debt Ledger Hook
        if (
            (status === "completed" || status === "Completed") &&
            (booking.paymentMethod === "cod" || booking.paymentMethod === "cash") &&
            booking.billingStatus === "invoiced" &&
            booking.taxDetails &&
            booking.taxDetails.platformFee > 0 &&
            booking.assignedPro
        ) {
            await walletService.chargePlatformFee(
                booking.assignedPro._id || booking.assignedPro,
                booking._id,
                booking.taxDetails.platformFee
            );
        }

        res.json({
            success: true,
            message: "Booking status updated successfully",
            booking,
        });

        // Emit BOOKING_STATUS_UPDATED event
        eventHub.emit("BOOKING_STATUS_UPDATED", {
            booking,
            status,
        });
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

        // Emit WORKER_ASSIGNED event
        eventHub.emit("WORKER_ASSIGNED", {
            booking,
            workerName: req.user.name,
        });

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

        // Emit BOOKING_CREATED event for COD confirmation
        eventHub.emit("BOOKING_CREATED", {
            booking,
            user: booking.userId,
        });

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

// @desc    Generate Invoice JSON
// @route   GET /api/v1/bookings/:id/invoice
// @access  Private
exports.generateInvoice = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate("userId", "name phone addresses")
            .populate("assignedPro", "name");

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // Check ownership or admin
        if (booking.userId._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        // Must be finalized or invoiced
        // if (booking.billingStatus === "quote" || !booking.billingStatus) {
        //     return res.status(400).json({ success: false, message: "Cannot generate invoice for incomplete bookings." });
        // }

        const documentType = booking.status === "completed" || booking.billingStatus === "invoiced" ? "TAX INVOICE" : "SERVICE ESTIMATE / QUOTE";

        // Use strict Paise integers for the JSON payload
        const baseCostPaise = booking.baseCost || booking.totalAmount || 0;
        let subtotalPaise = baseCostPaise;

        const lineItems = [
            {
                description: "Base Service Cost",
                amount: baseCostPaise
            }
        ];

        if (booking.materials && booking.materials.length > 0) {
            booking.materials.forEach(mat => {
                const matAmount = mat.cost;
                subtotalPaise += matAmount;
                lineItems.push({
                    description: `Material: ${mat.name}`,
                    amount: matAmount,
                    date: mat.addedAt
                });
            });
        }

        // Ensure all amounts are in Paise. No toRupees conversion needed as they are already expected in Paise.
        const cgstPaise = booking.taxDetails?.cgst || 0;
        const sgstPaise = booking.taxDetails?.sgst || 0;
        const platformFeePaise = booking.taxDetails?.platformFee || 0;
        const grandTotalPaise = booking.finalTotal || booking.totalAmount || 0;

        // Address resolution
        const customerAddress = booking.serviceAddress
            ? `${booking.serviceAddress.addressLine1}, ${booking.serviceAddress.city}`
            : (booking.userId.addresses && booking.userId.addresses[0]
                ? booking.userId.addresses[0].addressLine1
                : "Address not matched");

        const invoice = {
            invoiceId: `INV-${booking._id.toString().slice(-6).toUpperCase()}`,
            date: new Date(),
            customer: {
                name: booking.name || booking.userId.name,
                phone: booking.phone || booking.userId.phone,
                address: customerAddress
            },
            provider: {
                name: booking.assignedPro ? booking.assignedPro.name : "Unassigned"
            },
            lineItems: lineItems,
            summary: {
                subtotal: subtotalPaise,
                cgst: cgstPaise,
                sgst: sgstPaise,
                platformFee: platformFeePaise,
                grandTotal: grandTotalPaise
            },
            paymentStatus: {
                status: booking.paymentStatus,
                method: booking.paymentMethod
            },
            documentType: documentType
        };

        // If it was finalized, update it to invoiced
        if (booking.billingStatus === "finalized") {
            booking.billingStatus = "invoiced";
            await booking.save();
        }

        if (req.query.format === "pdf") {
            return generateInvoicePDF(invoice, res);
        }

        res.json({
            success: true,
            invoice
        });

    } catch (error) {
        console.error("Invoice Generation Error:", error);
        res.status(500).json({ success: false, message: "Failed to generate invoice" });
    }
};
