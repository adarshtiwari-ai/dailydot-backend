const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { auth, adminAuth } = require("../middleware/auth");

// All routes are protected and for admins only
router.use(auth);
router.use(adminAuth);

router.get("/metrics", analyticsController.getMetrics);
router.get("/revenue", analyticsController.getRevenueChart);
router.get("/services-distribution", analyticsController.getServiceDistribution);

module.exports = router;
