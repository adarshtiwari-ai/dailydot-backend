require("dotenv").config({ path: '../.env' });
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Review = require("../models/Review");

async function checkStatus() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // We check the most recent booking that has a paymentOrderId
        const recentBooking = await Booking.findOne({ paymentOrderId: { $ne: null } }).sort({ createdAt: -1 });

        if (!recentBooking) {
            console.log("No bookings found with a paymentOrderId");
            process.exit(0);
        }

        console.log("--- LATEST BOOKING DETAILS ---");
        console.log(`Booking ID: ${recentBooking._id}`);
        console.log(`Payment Order ID: ${recentBooking.paymentOrderId}`);
        console.log(`Status: ${recentBooking.status}`);
        console.log(`Payment Status: ${recentBooking.paymentStatus}`);

        console.log("\n--- TRUST ENGINE (REVIEWS) ---");
        const reviews = await Review.find({ userId: recentBooking.userId });
        
        if (reviews.length === 0) {
            console.log(`User ${recentBooking.userId} has no reviews yet.`);
        } else {
            reviews.forEach((r, i) => {
                console.log(`Review ${i+1}: isVerified = ${r.isVerified}`);
            });
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

checkStatus();
