require("dotenv").config({ path: '../.env' });
const mongoose = require("mongoose");
const Booking = require("../models/Booking");

async function fetchBooking() {
    try {
        if (!process.env.MONGODB_URI) require("dotenv").config();
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log("Fetching booking 69cb53e6d378e84fc4390a65...");
        const booking = await Booking.findById("69cb53e6d378e84fc4390a65")
            .populate('userId', 'name email phone')
            .populate('assignedPro', 'name email phone')
            .populate('items.serviceId', 'name price');
            
        if (!booking) {
            console.log("\nBooking not found! Fetching the 3 most recent bookings instead to verify data structure:");
            const recent = await Booking.find().sort({createdAt: -1}).limit(3);
            console.log(JSON.stringify(recent, null, 2));
        } else {
            console.log(JSON.stringify(booking.toObject(), null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

fetchBooking();
