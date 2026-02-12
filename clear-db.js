require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');
const Service = require('./models/Service');
const Booking = require('./models/Booking');

async function clearDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    await User.deleteMany({});
    console.log('Cleared all users');
    
    await Category.deleteMany({});
    console.log('Cleared all categories');
    
    await Service.deleteMany({});
    console.log('Cleared all services');
    
    await Booking.deleteMany({});
    console.log('Cleared all bookings');
    
    console.log('✅ Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearDatabase();