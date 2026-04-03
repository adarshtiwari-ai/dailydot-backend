const mongoose = require('mongoose');
const Service = require('../models/Service');
require('dotenv').config();

async function auditServices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const services = await Service.find({ isActive: true }).limit(5);
        
        console.log("--- SERVICE PRICE AUDIT ---");
        services.forEach(s => {
            console.log(`Service: ${s.name}`);
            console.log(`Stored Price: ${s.price}`);
            console.log(`Likely Unit: ${s.price > 5000 ? 'Paise' : 'Rupees'}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

auditServices();
