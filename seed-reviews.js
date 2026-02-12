const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Review = require('./models/Review');
const Booking = require('./models/Booking');
const User = require('./models/User');
const Service = require('./models/Service');

dotenv.config();

const seedReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected');

        // 1. Find a Random User
        const user = await User.findOne({ role: 'user' });
        if (!user) {
            console.error("No User found. Create a user first.");
            process.exit(1);
        }
        console.log(`Using User: ${user.name} (${user._id})`);

        // 2. Find a Random Service
        const service = await Service.findOne();
        if (!service) {
            console.error("No Service found. Create a service first.");
            process.exit(1);
        }
        console.log(`Using Service: ${service.name} (${service._id})`);

        // 3. Create a Dummy Completed Booking
        let booking = await Booking.findOne({ userId: user._id, serviceId: service._id, status: 'completed' });

        if (!booking) {
            console.log("Creating a temporary completed booking for this review...");
            booking = await Booking.create({
                userId: user._id,
                serviceId: service._id,
                bookingNumber: 'DEMO-' + Date.now(),
                totalAmount: service.price,
                scheduledDate: new Date(),
                status: 'completed',
                paymentStatus: 'paid',
                name: user.name, // Required field
                phone: user.phone || '9876543210', // Required field
                address: {
                    street: "123 Demo St",
                    city: "Demo City",
                    zipCode: "123456"
                }
            });
        }
        console.log(`Using Booking: ${booking.bookingNumber} (${booking._id})`);

        // 4. Create the Review
        const reviewData = {
            bookingId: booking._id,
            userId: user._id,
            serviceId: service._id,
            rating: 5,
            comment: 'Excellent service! The AC is working perfectly now. (Test Seed Review)',
            status: 'pending', // Pending approval
            detailedRatings: {
                quality: 5,
                punctuality: 5,
                professionalism: 5,
                valueForMoney: 4
            }
        };

        // Check if review exists for this booking
        const existing = await Review.findOne({ bookingId: booking._id });
        if (existing) {
            console.log("Review already exists for this booking. Deleting old one...");
            await Review.deleteOne({ _id: existing._id });
        }

        const review = await Review.create(reviewData);
        console.log('✅ Review Created Successfully!');
        console.log(review);
        console.log("-----------------------------------------");
        console.log("GO TO ADMIN DASHBOARD -> REVIEWS TO APPROVE THIS.");

        process.exit(0);
    } catch (error) {
        console.error('Error seeding reviews:', error);
        process.exit(1);
    }
};

seedReviews();
