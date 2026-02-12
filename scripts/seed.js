require('dotenv').config();
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Service = require('../models/Service');

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Service.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const hashedPassword = await bcryptjs.hash('Admin123', 12);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@dailydot.com',
      password: hashedPassword,
      phone: '9999999999',
      role: 'admin',
      emailVerified: true,
      phoneVerified: true
    });
    console.log('Admin user created');

    // Create categories
    const categories = await Category.insertMany([
      {
        name: 'Cleaning',
        slug: 'cleaning',
        description: 'Professional cleaning services',
        icon: 'cleaning-icon'
      },
      {
        name: 'Plumbing',
        slug: 'plumbing',
        description: 'Expert plumbing solutions',
        icon: 'plumbing-icon'
      }
    ]);
    console.log('Categories created');

    // Create services
    await Service.insertMany([
      {
        name: 'Deep Home Cleaning',
        category: categories[0]._id,
        description: 'Complete deep cleaning of your home',
        price: 2999,
        duration: 180
      },
      {
        name: 'Tap Repair',
        category: categories[1]._id,
        description: 'Fix leaking or broken taps',
        price: 499,
        duration: 60
      }
    ]);
    console.log('Services created');

    console.log('✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();