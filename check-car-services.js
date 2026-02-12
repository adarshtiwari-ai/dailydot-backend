const mongoose = require('mongoose');
const Service = require('./models/Service');
require('dotenv').config();

const checkCarServices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const carServices = await Service.find({ section: 'car_on_wheels' });
        console.log(`Car on Wheels Services: ${carServices.length}`);
        carServices.forEach(s => console.log(`- ${s.name} (Active: ${s.isActive})`));

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkCarServices();
