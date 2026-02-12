const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function checkAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const admin = await User.findOne({ email: 'admin@dailydot.com' });
        if (admin) {
            console.log('Admin User Found:');
            console.log('ID:', admin._id);
            console.log('Role:', admin.role);
            console.log('Email Verified:', admin.emailVerified);
        } else {
            console.log('Admin user NOT found');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

checkAdmin();
