const mongoose = require('mongoose');
const Category = require('./models/Category');
const Service = require('./models/Service');
require('dotenv').config();

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const categories = await Category.find({});
        console.log(`Total Categories: ${categories.length}`);
        categories.forEach(c => console.log(`- ${c.name} (Active: ${c.isActive})`));

        const services = await Service.find({});
        console.log(`Total Services: ${services.length}`);
        services.forEach(s => console.log(`- ${s.name} (Category: ${s.category}, Active: ${s.isActive})`));

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkDB();
