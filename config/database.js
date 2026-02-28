const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dailydot');

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