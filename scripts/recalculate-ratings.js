const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Review = require('../models/Review');
const Service = require('../models/Service');
const Professional = require('../models/Professional');

dotenv.config();

const recalculateRatings = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        // 1. Get all Service IDs
        const services = await Service.find({}, '_id name');
        console.log(`Found ${services.length} services. Recalculating...`);
        
        for (const service of services) {
            process.stdout.write(`Updating Service: ${service.name}... `);
            await Review.calcAverageRatings(service._id, null);
            console.log('✅');
        }

        // 2. Get all Professional IDs
        const professionals = await Professional.find({}, '_id name');
        console.log(`\nFound ${professionals.length} professionals. Recalculating...`);
        
        for (const pro of professionals) {
            process.stdout.write(`Updating Professional: ${pro.name}... `);
            await Review.calcAverageRatings(null, pro._id);
            console.log('✅');
        }

        console.log('\n✨ ALL RATINGS RECALCULATED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during recalculation:', error);
        process.exit(1);
    }
};

recalculateRatings();
