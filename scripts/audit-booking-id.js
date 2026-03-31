require("dotenv").config({ path: '../.env' });
const mongoose = require("mongoose");
const Booking = require("../models/Booking");

async function audit() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const targetId = "69cb53e6d378e84fc4390a65";
        const booking = await Booking.findById(targetId)
            .populate('userId', 'name email phone')
            .populate('assignedPro', 'name phone')
            .lean();

        if (booking) {
            console.log("\n--- TARGET BOOKING RAW JSON ---");
            console.log(JSON.stringify(booking, null, 2));
        } else {
            console.log(`\n❌ Target ID ${targetId} not found.`);
            // List 10 most recent IDs to verify if we are in the right DB or if there's a prefix mismatch
            const recent = await Booking.find().sort({createdAt: -1}).limit(10).select('_id bookingNumber');
            console.log("\nMost Recent IDs in Collection:");
            recent.forEach(b => console.log(`- ${b._id} (${b.bookingNumber})`));
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

audit();
