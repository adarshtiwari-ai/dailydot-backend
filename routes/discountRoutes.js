const express = require("express");
const router = express.Router();
const { 
  getActiveDiscounts, 
  getAllDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount
} = require("../controllers/discountController");
const { auth, adminAuth } = require("../middleware/auth");

// Public route for mobile app
router.get("/active", getActiveDiscounts);

// Management Routes (Admin Only)
router.use(auth, adminAuth);

router.route("/")
  .get(getAllDiscounts)
  .post(createDiscount);

router.route("/:id")
  .patch(updateDiscount)
  .delete(deleteDiscount);

module.exports = router;
