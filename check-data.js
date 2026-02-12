require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Service = require("./models/Service");
const Booking = require("./models/Booking");
const Category = require("./models/Category");
const Review = require("./models/Review");

async function checkData() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB at:", process.env.MONGODB_URI);

        const userCount = await User.countDocuments();
        const serviceCount = await Service.countDocuments();
        const bookingCount = await Booking.countDocuments();
        const categoryCount = await Category.countDocuments();
        const reviewCount = await Review.countDocuments();

        console.log("\n--- Database Counts ---");
        console.log(`Users: ${userCount}`);
        console.log(`Services: ${serviceCount}`);
        console.log(`Bookings: ${bookingCount}`);
        console.log(`Categories: ${categoryCount}`);
        console.log(`Reviews: ${reviewCount}`);
        console.log("-----------------------\n");

        if (userCount > 0) {
            console.log("Sample User:", await User.findOne().select("name email role"));
        }

    } catch (error) {
        console.error("Database Error:", error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkData();
