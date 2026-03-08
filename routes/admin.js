const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// PATCH /api/v1/admin/bookings/:id/status
router.patch('/bookings/:id/status', adminController.updateBookingStatus);

module.exports = router;
