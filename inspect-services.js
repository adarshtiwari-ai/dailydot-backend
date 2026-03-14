const mongoose = require('mongoose');
const Service = require('./models/Service');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dailydot';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        try {
            const services = await Service.find({}).sort({ createdAt: -1 }).limit(10);
            console.log('\n--- 10 Most Recent Services ---');
            services.forEach(s => {
                console.log(`ID: ${s._id}`);
                console.log(`Name: ${s.name}`);
                console.log(`TagId: ${s.tagId}`);
                console.log(`Tags (Raw Object): ${JSON.stringify(s.tags)}`);
                console.log('---------------------------');
            });

        } catch (error) {
            console.error('Error querying database:', error);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
