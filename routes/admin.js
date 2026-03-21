const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, adminAuth } = require('../middleware/auth');

// PATCH /api/v1/admin/bookings/:id/status
router.patch('/bookings/:id/status', adminController.updateBookingStatus);

// POST /api/v1/admin/bookings/:id/materials
router.post('/bookings/:id/materials', adminController.addBookingMaterial);

// PATCH /api/v1/admin/bookings/:id/adjust
router.patch('/bookings/:id/adjust', adminController.adjustBookingPrice);

// POST /api/v1/admin/providers/:id/settle
router.post('/providers/:id/settle', adminController.settleProviderDues);

// GET /api/v1/admin/providers/wallets
router.get('/providers/wallets', auth, adminAuth, adminController.getProviderWallets);

// Provider Details Support
router.get('/providers/:id', auth, adminAuth, adminController.getProviderProfile);
router.get('/providers/:id/bookings', auth, adminAuth, adminController.getProviderBookings);
router.get('/providers/:id/transactions', auth, adminAuth, adminController.getProviderTransactions);

// POST /api/v1/admin/notifications/broadcast
router.post('/notifications/broadcast', auth, adminAuth, adminController.broadcastNotification);

module.exports = router;
