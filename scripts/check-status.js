require("dotenv").config({ path: '../.env' }); // Make sure to load from root if run within scripts/
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Review = require("../models/Review");

const BOOKING_ID = "69cb53e6d378e84fc4390a65";

async function verifyDatabase() {
    try {
        console.log("Connecting to MongoDB...");
        // Fallback to local .env if run from root directory
        if (!process.env.MONGODB_URI) {
            require("dotenv").config();
        }
        await mongoose.connect(process.env.MONGODB_URI);

        console.log(`\n--- Querying Booking Identifier: ${BOOKING_ID} ---`);
        
        let booking = null;
        if (mongoose.Types.ObjectId.isValid(BOOKING_ID)) {
             booking = await Booking.findById(BOOKING_ID);
        }
        if (!booking) {
             booking = await Booking.findOne({ paymentOrderId: BOOKING_ID });
        }

        if (!booking) {
            console.log("❌ ERROR: Booking not found in Database!");
            process.exit(0);
        }

        console.log("Current Status:");
        console.log(`- paymentOrderId: ${booking.paymentOrderId}`);
        console.log(`- status:         ${booking.status}`);
        console.log(`- paymentStatus:  ${booking.paymentStatus}`);
        console.log(`- paymentId:      ${booking.paymentId}`);

        console.log("\n--- Trust Engine (Reviews Verify) ---");
        const reviews = await Review.find({ userId: booking.userId });

        if (reviews.length === 0) {
            console.log("ℹ️ No reviews exist for this user yet.");
        } else {
            console.log(`Found ${reviews.length} review(s) for User ${booking.userId}:`);
            let allVerified = true;
            reviews.forEach((r, idx) => {
                console.log(` [${idx + 1}] Review ID ${r._id} -> isVerified: ${r.isVerified}`);
                if (!r.isVerified) allVerified = false;
            });
            console.log(allVerified ? "✅ TRUST ENGINE PASS" : "❌ TRUST ENGINE FAILED (Some reviews are not verified)");
        }
        
    } catch (err) {
        console.error("Diagnostic Script Error:", err);
    } finally {
        mongoose.disconnect();
    }
}

verifyDatabase();
