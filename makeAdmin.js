require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const promoteUser = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      console.error('Error: MONGODB_URI or MONGO_URI not found in environment variables.');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const identifier = process.argv[2];
    let user;

    if (identifier) {
      // Try finding by email or phone
      user = await User.findOne({
        $or: [{ email: identifier.toLowerCase() }, { phone: identifier }]
      });
      if (!user) {
        console.error(`User with email or phone "${identifier}" not found.`);
        process.exit(1);
      }
    } else {
      // Find the most recently created user
      user = await User.findOne().sort({ createdAt: -1 });
      if (!user) {
        console.error('No users found in the database.');
        process.exit(1);
      }
      console.log('No identifier provided. Selecting the most recently created user.');
    }

    user.role = 'admin';
    await user.save();

    console.log(`--- PROMOTION SUCCESSFUL ---`);
    console.log(`User: ${user.name}`);
    console.log(`Email: ${user.email || 'N/A'}`);
    console.log(`Phone: ${user.phone || 'N/A'}`);
    console.log(`Role updated to: ${user.role}`);
    console.log(`----------------------------`);

    process.exit(0);
  } catch (error) {
    console.error('Error promoting user:', error.message);
    process.exit(1);
  }
};

promoteUser();
