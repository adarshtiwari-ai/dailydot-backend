const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Service = require('../models/Service');

dotenv.config();

const verifyIsStartingPrice = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not found in environment');
            return;
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Create a test service
        const testService = await Service.create({
            name: 'Test Dynamic Price Service',
            category: new mongoose.Types.ObjectId(), // Fake ID for testing
            description: 'Testing the isStartingPrice field',
            price: 50000, // 500 INR
            isStartingPrice: true
        });
        console.log('Created service with isStartingPrice: true');
        console.log('Field value:', testService.isStartingPrice);

        // 2. Fetch it
        const fetched = await Service.findById(testService._id);
        console.log('Fetched service isStartingPrice:', fetched.isStartingPrice);

        // 3. Update it
        fetched.isStartingPrice = false;
        await fetched.save();
        console.log('Updated service isStartingPrice to false');

        // 4. Cleanup
        await Service.findByIdAndDelete(testService._id);
        console.log('Deleted test service');

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
};

verifyIsStartingPrice();
