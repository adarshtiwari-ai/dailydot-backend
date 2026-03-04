const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ServiceSchema = new mongoose.Schema({
    isTrending: { type: Boolean, default: false }
}, { strict: false });

const Service = mongoose.model('Service', ServiceSchema);

const markTrending = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        // Get 5 random services and mark them as trending
        const services = await Service.find({}).limit(5);

        if (services.length === 0) {
            console.log('No services found to mark as trending.');
            process.exit(0);
        }

        const serviceIds = services.map(s => s._id);

        const result = await Service.updateMany(
            { _id: { $in: serviceIds } },
            { $set: { isTrending: true } }
        );

        console.log(`Successfully marked ${result.modifiedCount} services as trending.`);
        process.exit(0);
    } catch (error) {
        console.error('Operation failed:', error);
        process.exit(1);
    }
};

markTrending();
