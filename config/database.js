const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: 5000, // 5 seconds
      connectTimeoutMS: 10000,       // 10 seconds
      socketTimeoutMS: 45000,        // 45 seconds
      family: 4                      // Use IPv4 (Render sometimes has issues with IPv6 resolution)
    };

    const conn = await mongoose.connect(
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dailydot',
      options
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Explicitly drop bad index if it exists (one-time fix for existing databases)
    try {
      await mongoose.connection.collections.users.dropIndex('phone_1');
      console.log('Successfully dropped phone_1 index');
    } catch (e) {
      if (e.codeName === 'IndexNotFound' || e.message?.includes('index not found')) {
        console.log('phone_1 index not found or already dropped, skipping.');
      } else {
        console.error('Error dropping phone_1 index:', e.message);
      }
    }

    return conn;
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;