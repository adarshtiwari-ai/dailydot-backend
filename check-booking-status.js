require("dotenv").config();
const mongoose = require("mongoose");
const Booking = require("./models/Booking");

async function checkBookings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const bookings = await Booking.find({}, "status totalAmount bookingNumber");
        console.log("Bookings:", bookings);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}
checkBookings();
