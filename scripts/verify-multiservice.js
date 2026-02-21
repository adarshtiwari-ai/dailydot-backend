require("dotenv").config();
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");

const verifyMultiServiceBooking = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to DB");

        // 1. Get a user
        const user = await User.findOne({ role: "user" });
        if (!user) throw new Error("No user found");
        console.log("User found:", user._id);

        // 2. Get two services
        const services = await Service.find().limit(2);
        if (services.length < 2) throw new Error("Need at least 2 services");

        console.log("Services found:", services.map(s => `${s.name} (${s.price})`).join(", "));

        // 3. Prepare items
        const items = services.map(s => ({
            serviceId: s._id,
            name: s.name,
            price: s.price,
            category: s.category.toString()
        }));

        // 4. Create booking (simulating controller logic)
        const totalAmount = items.reduce((sum, item) => sum + item.price, 0);
        console.log("Calculated Total Amount:", totalAmount);

        const bookingJSON = {
            userId: user._id,
            items,
            bookingNumber: "TEST" + Date.now(),
            scheduledDate: new Date(),
            serviceAddress: {
                addressLine1: "Test Address",
                city: "Test City",
                state: "Test State",
                pincode: "123456"
            },
            totalAmount: totalAmount,
            name: "Test User",
            phone: "1234567890",
            paymentMethod: "cod",
            paymentStatus: "pending"
        };

        const booking = await Booking.create(bookingJSON);
        console.log("Booking created:", booking._id);

        // 5. Verify
        const savedBooking = await Booking.findById(booking._id);

        if (savedBooking.items.length !== 2) throw new Error("Items length mismatch");
        if (savedBooking.totalAmount !== totalAmount) throw new Error("Total amount mismatch");
        console.log("✅ Verification Successful: Booking created with multiple items and correct total.");

        // 6. Cleanup
        await Booking.deleteOne({ _id: booking._id });
        console.log("Cleanup: Test booking deleted");

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyMultiServiceBooking();
