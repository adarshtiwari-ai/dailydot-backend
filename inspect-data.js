const mongoose = require('mongoose');
const User = require('./models/User');
const Booking = require('./models/Booking');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dailydot';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        try {
            const users = await User.find({}).sort({ createdAt: -1 }).limit(5);
            console.log('\n--- 5 Most Recent Users ---');
            users.forEach(u => {
                console.log(`ID: ${u._id}`);
                console.log(`Name: ${u.name}`);
                console.log(`Phone: ${u.phone}`);
                console.log(`DeviceId: ${u.deviceId}`);
                console.log(`Created: ${u.createdAt}`);
                console.log('---------------------------');
            });

            const bookings = await Booking.find({}).sort({ createdAt: -1 }).limit(5).populate('userId');
            console.log('\n--- 5 Most Recent Bookings ---');
            bookings.forEach(b => {
                console.log(`Booking ID: ${b._id}`);
                console.log(`Status: ${b.status}`);
                console.log(`User Name: ${b.userId?.name}`);
                console.log(`User ID: ${b.userId?._id}`);
                console.log(`Total: ${b.totalAmount}`);
                console.log(`Created: ${b.createdAt}`);
                console.log('---------------------------');
            });

        } catch (error) {
            console.error('Error querying database:', error);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
