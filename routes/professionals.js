const express = require('express');
const router = express.Router();
const Professional = require('../models/Professional');
const Booking = require('../models/Booking');
const { auth, adminAuth } = require('../middleware/auth');

// @route   GET /api/v1/professionals
// @desc    Get all professionals
// @access  Private (Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
    try {
        const professionals = await Professional.find().sort({ createdAt: -1 });

        // Calculate bookings count for each pro (Optional optimization: store in pro model)
        // For now, let's just return the list. The pro model has `totalRatings` but not `totalBookings`.
        // We can aggregate or just return what we have.
        // Let's do a quick aggregation to get total bookings count if needed, 
        // OR rely on client side or scheduled jobs. 
        // For MVP, just returning the professionals is fine, they have `totalRatings`.
        // User asked for "Total Bookings". Let's try to get it.
        const professionalsWithCount = await Promise.all(professionals.map(async (pro) => {
            const bookingCount = await Booking.countDocuments({ assignedPro: pro._id });
            return {
                ...pro.toObject(),
                totalBookings: bookingCount
            };
        }));

        res.json({
            success: true,
            count: professionals.length,
            professionals: professionalsWithCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @route   PUT /api/v1/professionals/:id
// @desc    Update professional
// @access  Private (Admin)
router.put('/:id', [auth, adminAuth], async (req, res) => {
    try {
        const { name, isActive } = req.body;

        let pro = await Professional.findById(req.params.id);
        if (!pro) {
            return res.status(404).json({ success: false, message: 'Professional not found' });
        }

        if (name) pro.name = name;
        if (typeof isActive !== 'undefined') pro.isActive = isActive;

        await pro.save();

        res.json({ success: true, professional: pro });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
