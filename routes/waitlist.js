const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlistController');
const { auth, adminAuth } = require('../middleware/auth');

// Allow guests (req.user will be null if not auth'd)
// Optional auth is handled in the controller logic
router.post('/join', async (req, res, next) => {
  // If user is logged in, attach their ID, else proceed as guest
  auth(req, res, () => {
    // We don't want auth to throw an error if missing, just populate req.user if possible
    next();
  });
}, waitlistController.joinWaitlist);

// Admin-only route to view demands
router.get('/all', auth, adminAuth, waitlistController.getAllDemands);

module.exports = router;
