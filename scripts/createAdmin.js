require('dotenv').config();
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');

const createAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const email = 'admin@gmail.com';
        const password = 'password@admin';
        const name = 'System Admin';

        // Check if user exists
        let user = await User.findOne({ email });

        if (user) {
            console.log('Admin user already exists. Updating password and role...');
            user.password = await bcryptjs.hash(password, 12);
            user.role = 'admin';
            user.name = name;
            await user.save();
        } else {
            console.log('Creating new admin user...');
            const hashedPassword = await bcryptjs.hash(password, 12);
            user = await User.create({
                name,
                email,
                password: hashedPassword,
                role: 'admin',
                isVerified: true,
                emailVerified: true
            });
        }

        console.log('✅ Admin user ready!');
        console.log('Email:', email);
        console.log('Password:', password);
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
