const User = require("../models/User");
const Booking = require("../models/Booking");
const Professional = require("../models/Professional");
const Service = require("../models/Service");
const Review = require("../models/Review");
const { validationResult } = require("express-validator");
const eventHub = require("../services/event.service");
const { generateInvoicePDF } = require("../services/pdfService");
const walletService = require("../services/walletService");
const notificationService = require("../services/notification.service");

// @desc    Create a new booking
// @route   POST /api/v1/bookings
// @access  Private
exports.createBooking = async (req, res) => {
    console.log("--- NEW BOOKING REQUEST RECEIVED ---");
    console.log("Body:", req.body);
    try {
        const { 
            bookingId, // Check for existing booking ID (Idempotency)
            items, 
            scheduledDate, 
            scheduledTime, 
            serviceAddress, 
            name, 
            phone, 
            notes, 
            bookingType, 
            paymentMethod,
            amount // Partial payment amount
        } = req.body;

        // 1. Partial Payment Validation (₹50 Minimum)
        const numericAmount = Number(amount || 0);
        if (paymentMethod === 'online' && numericAmount > 0 && numericAmount < 50) {
            return res.status(400).json({
                success: false,
                message: "Minimum payment of ₹50 is required for online transactions."
            });
        }

        // 2. ID-Aware Routing (Upsert/Idempotent Logic)
        if (bookingId) {
            const existingBooking = await Booking.findById(bookingId);
            if (existingBooking) {
                // Update payment method if it changed
                if (paymentMethod) existingBooking.paymentMethod = paymentMethod;
                await existingBooking.save();

                return res.status(200).json({
                    success: true,
                    message: "Existing booking updated",
                    booking: existingBooking,
                });
            }
        }

        // 3. New Booking Logic
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
            });
        }

        // Process items and calculate total amount securely
        const detailedItems = [];
        let itemsSubtotal = 0;
        let bestCostTotal = 0;

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

            // Accumulate itemsSubtotal and bestCostPrice in Paise (no conversion needed as DB is now unified)
            itemsSubtotal += Math.round(service.price) * (item.quantity || 1);
            bestCostTotal += Math.round((service.bestCostPrice || service.price)) * (item.quantity || 1);
        }

        const { promoCode } = req.body;

        // Centralized Math Engine (Server-Side)
        const { calculateBillDetails } = require("../services/billingService");
        const billingResult = await calculateBillDetails(itemsSubtotal, [], detailedItems, [], promoCode, bestCostTotal);
        const {
            taxAmount,
            totalDynamicFees,
            finalTotal,
            appliedFees,
            appliedDiscounts
        } = billingResult;


        // Create booking with full breakdown
        const booking = await Booking.create({
            userId: req.user._id,
            items: detailedItems,
            scheduledDate,
            scheduledTime,
            serviceAddress,
            // Math Engine Fields
            subtotal: itemsSubtotal,
            taxAmount,
            appliedFees,
            appliedDiscounts,
            totalAmount: finalTotal, // Saving the real Grand Total
            baseCost: itemsSubtotal, // Consistency for Invoicing
            name: name || req.user.name,
            phone: phone || req.user.phone,
            notes,
            bookingType: bookingType || 'standard',
            paymentMethod: "cod",
            paymentStatus: "pending",
            billingStatus: "pending_visit", // Service Agreement logic: Start as quote-pending
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
            .populate("items.serviceId", "name price duration image images imageUrl")
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
            .populate("items.serviceId", "name price duration image images imageUrl")
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

        const { status, proName, proPhone, professionalId, materialCost, adminCommission, taxAmount } = req.body;
        let assignedProId = null;
        let finalStatus = status;

        // Logic for ID-Based Professional Assignment (Strict State Dominance)
        if (professionalId) {
            assignedProId = professionalId;
            finalStatus = "assigned"; // VOIOLENT OVERRIDE: Assignment ALWAYS forces 'assigned' status
        } else if (status === "confirmed" && proName && proPhone) {
            // DEPRECATED FALLBACK: Legacy lookup (keeping for temporary backward compatibility)
            const Professional = require("../models/Professional");
            let pro = await Professional.findOne({ phone: proPhone });
            if (pro) {
                assignedProId = pro._id;
                finalStatus = "assigned";
            }
        }

        const updateData = { status: finalStatus };
        if (assignedProId) {
            updateData.assignedPro = assignedProId;
        }

        // Settlement Data for Completion
        if (status === "completed" || status === "Completed") {
            const safeMaterialCost = Number(materialCost) || 0;
            const safeAdminCommission = Number(adminCommission) || 0;

            updateData.materialCost = safeMaterialCost;
            updateData.adminCommission = safeAdminCommission;
            updateData.netPlatformProfit = safeAdminCommission;
            updateData.taxAmount = Number(taxAmount) || 0;
            updateData.isSettled = true;
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

        // Validation: Cannot complete/settle without an assigned professional
        if ((status === 'completed' || status === 'Completed') && !booking.assignedPro) {
            return res.status(400).json({
                success: false,
                message: 'Cannot complete and settle a booking without an assigned professional.'
            });
        }

        // Provider Debt Ledger Hook (Updated for MANUAL SETTLEMENT)
        if (
            (status === "completed" || status === "Completed") &&
            booking.assignedPro
        ) {
            const totalToSplit = booking.finalTotal || booking.totalAmount || 0;
            const mCost = booking.materialCost || 0;
            const aComm = booking.adminCommission || 0;

            // The split: Provider Payout = Total - Materials - Commission
            const providerPayout = totalToSplit - mCost - aComm;

            if (booking.paymentMethod === "cod" || booking.paymentMethod === "cash") {
                // For COD, the provider already has the cash. 
                // Platform take-home = Total - Payout = Materials + Commission.
                // We charge the provider for the platform's share.
                const platformTakeHome = totalToSplit - providerPayout;

                if (platformTakeHome > 0) {
                    await walletService.chargePlatformFee(
                        booking.assignedPro._id || booking.assignedPro,
                        booking._id,
                        platformTakeHome
                    );
                }
            } else {
                // For Online payments, platform has the cash. 
                // We credit the provider their specific payout.
                if (providerPayout > 0) {
                    await walletService.creditOnlinePayout(
                        booking.assignedPro._id || booking.assignedPro,
                        booking._id,
                        providerPayout
                    );
                }
            }
        }

        res.json({
            success: true,
            message: "Booking status updated successfully",
            booking,
        });

        // Emit BOOKING_STATUS_UPDATED event
        eventHub.emit("BOOKING_STATUS_UPDATED", {
            booking,
            status: finalStatus,
        });

        // Trigger Push Notification to newly assigned Professional
        if (finalStatus === "assigned" && assignedProId) {
            try {
                await notificationService.sendPushNotification(
                    assignedProId,
                    "New Job Assigned",
                    "You have been assigned to a new booking. Please review and provide a quote.",
                    { bookingId: booking._id.toString(), type: "job_assigned" }
                );
            } catch (pushErr) {
                console.error("Failed to send assignment notification:", pushErr);
            }
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

        // Update Booking status
        booking.serviceRating = serviceRating;
        booking.proRating = proRating;
        booking.comment = comment;
        booking.isRated = true;
        await booking.save();

        // NEW: Create a standalone Review document (The Single Source of Truth)
        // This will trigger the post-save hooks in Review.js to update Service/Professional averages
        if (booking.items && booking.items.length > 0) {
            await Review.create({
                bookingId: booking._id,
                userId: booking.userId,
                serviceId: booking.items[0].serviceId,
                providerId: booking.assignedPro, // links to Professional
                rating: serviceRating,
                comment: comment,
                status: "approved", // Auto-approved for verified bookings
            });
        }

        res.json({
            success: true,
            message: "Rating submitted successfully and review generated",
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
            .populate("items.serviceId", "name price duration image images imageUrl")
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
                appliedFees: booking.appliedFees || [],
                appliedDiscounts: booking.appliedDiscounts || [],
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
// @desc    Calculate checkout pricing for SSOT
// @route   POST /api/v1/bookings/calculate
// @access  Public
exports.calculateCheckoutPricing = async (req, res) => {
    try {
        const { baseCost, bestCostTotal, items = [], materials = [], adjustments = [], promoCode = null } = req.body;

        if (baseCost === undefined) {
            return res.status(400).json({
                success: false,
                message: "baseCost is required",
            });
        }

        const { calculateBillDetails } = require("../services/billingService");

        // Pass baseCost, adjustments, items, materials, promoCode, and bestCostTotal
        const result = await calculateBillDetails(Number(baseCost), adjustments, items, materials, promoCode, bestCostTotal);

        // Validation logic for mobile "Apply" button
        if (promoCode && result.appliedDiscounts.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired promo code"
            });
        }

        res.json({
            success: true,
            receipt: result
        });
    } catch (error) {
        console.error("Error calculating checkout pricing:", error);
        res.status(500).json({
            success: false,
            message: "Server error while calculating pricing",
        });
    }
};

// @desc    Submit Final Quote (Admin Only)
// @route   POST /api/v1/admin/bookings/:id/submit-quote
// @access  Private (Admin)
exports.submitQuote = async (req, res) => {
    try {
        const { totalAmount, breakdown = {}, materials = [], notes } = req.body;
        // Extract adminDiscount as a first-class field (in Paise)
        const adminDiscount = Math.max(0, Math.round(breakdown.adminDiscount || 0));
        if (!totalAmount) {
            return res.status(400).json({ success: false, message: "Quote amount is required" });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        const existingPromoDiscount = booking.discountAmount || 0;

        // SAFETY NET: If the frontend sent 0 for fees (race condition), fetch settings as a last resort
        let finalPlatformFee = Math.round(breakdown.platformFee || 0);
        let finalConvenienceFee = Math.round(breakdown.convenienceFee || 0);
        let finalTaxRate = breakdown.taxRate;

        if (finalPlatformFee === 0 || finalConvenienceFee === 0 || finalTaxRate === undefined) {
            const Setting = require("../models/Setting");
            const settings = await Setting.findOne();
            if (settings?.billing) {
                if (finalPlatformFee === 0) finalPlatformFee = (Number(settings.billing.serviceCharge) || 0) * 100;
                if (finalConvenienceFee === 0) finalConvenienceFee = (Number(settings.billing.convenienceFee) || 0) * 100;
                if (finalTaxRate === undefined) finalTaxRate = Number(settings.billing.defaultTaxRate) || 0.18;
            }
        }

        // 1. STRICT SERVER-SIDE MATH ENGINE (Raw Base + Materials)
        const basePrice = Math.round(breakdown.basePrice || booking.baseCost || 0);
        const calculatedMaterialsCost = materials.reduce((sum, m) => {
            const itemPrice = Number(m.price || m.cost || 0);
            const itemQty = Number(m.qty || 1);
            return sum + (itemPrice * itemQty);
        }, 0);

        const subtotal = basePrice + calculatedMaterialsCost;
        // TAX BASE = basePrice ONLY (labor). Materials are supplier costs excluded from GST.
        const calculatedTax = Math.round(basePrice * finalTaxRate);
        
        // Derive final total: Base + Materials + Tax(on base only) + Fees - Admin Discount - Promo Discount
        // Math.max(0, ...) floor guard prevents negative invoices
        const strictTotal = Math.max(0, subtotal + calculatedTax + finalPlatformFee + finalConvenienceFee - adminDiscount - existingPromoDiscount);

        booking.quote = {
            basePrice,
            tax: calculatedTax,
            taxRate: finalTaxRate, 
            materials: Math.round(calculatedMaterialsCost),
            materialsList: materials.map(m => ({ 
                name: m.name, 
                price: Math.round(m.price || m.cost || 0), 
                qty: Number(m.qty || 1),
                cost: Math.round((m.price || m.cost || 0) * (m.qty || 1))
            })),
            platformFee: finalPlatformFee,
            convenienceFee: finalConvenienceFee,
            adminDiscount, // First-class labeled discount (not disguised as negative material)
            totalDiscount: adminDiscount + existingPromoDiscount, // Summed transparency for frontend
            total: strictTotal,
            isApproved: false
        };
        
        // Atomic Sync
        booking.materials = booking.quote.materialsList;
        booking.totalAmount = strictTotal; // Force global lock to strict math
        booking.taxAmount = calculatedTax;
        booking.subtotal = subtotal;

        // Unified State Alignment
        booking.billingStatus = 'quote_sent';
        booking.status = 'quote_sent';
        
        if (notes !== undefined) booking.notes = notes;
        
        // PERSISTENCE: Strict await before any side effects (like push notifications)
        await booking.save();

        // Trigger Push Notification to User
        try {
            const serviceName = booking.items && booking.items.length > 0
                ? booking.items[0].name
                : "your requested service";

            await notificationService.sendPushNotification(
                booking.userId,
                `Quote Ready for ${serviceName}!`,
                `Your pro has assessed the job. Review and approve the final quote of ₹${totalAmount} to start work.`,
                { bookingId: booking._id.toString(), type: "quote_received" }
            );
        } catch (pushErr) {
            console.error("Failed to send quote notification:", pushErr);
        }

        res.json({
            success: true,
            message: "Quote submitted successfully",
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Approve Quote
// @route   POST /api/v1/bookings/:id/approve-quote
// @access  Private
exports.approveQuote = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        booking.quote.isApproved = true;
        booking.quote.approvedAt = new Date();
        booking.billingStatus = 'approved';
        booking.status = 'confirmed'; // Auto-confirm on approval

        await booking.save();

        // 1. Backend Worker Notification (Push)
        if (booking.assignedPro) {
            try {
                const proId = booking.assignedPro._id || booking.assignedPro;
                await notificationService.sendPushNotification(
                    proId,
                    "Quote Approved! 🟢",
                    "The customer has approved the quote. You are clear to begin the service.",
                    { bookingId: booking._id.toString(), type: "quote_approved" }
                );
            } catch (pushErr) {
                console.error("Failed to send quote approval notification:", pushErr);
            }
        }

        // 2. Backend Admin Broadcast (Socket)
        eventHub.emit("BOOKING_STATUS_UPDATED", {
            booking,
            status: 'confirmed'
        });

        res.status(200).json({
            success: true,
            message: "Quote approved successfully",
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Record Payment / Installment
// @route   POST /api/v1/bookings/:id/record-payment
// @access  Private
exports.recordPayment = async (req, res) => {
    try {
        const { amount, method, transactionId } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // Add to installments
        booking.installments.push({
            amount: Math.round(amount),
            method: method || 'online',
            transactionId,
            status: 'paid',
            paidAt: new Date()
        });

        // Check if fully paid
        const totalPaid = booking.installments.reduce((sum, inst) => sum + inst.amount, 0);
        const targetAmount = booking.quote?.total || booking.totalAmount;

        let fullyPaid = false;
        if (totalPaid >= targetAmount) {
            booking.paymentStatus = 'paid';
            if (booking.billingStatus === 'approved') {
                booking.billingStatus = 'completed';
            }
            booking.status = 'completed';
            fullyPaid = true;
        }

        await booking.save();

        if (fullyPaid) {
            const eventHub = require("../services/event.service");
            eventHub.emit("BOOKING_STATUS_UPDATED", { booking, status: 'completed' });
        }

        res.json({
            success: true,
            message: "Payment recorded successfully",
            totalPaid,
            remaining: Math.max(0, targetAmount - totalPaid),
            booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
