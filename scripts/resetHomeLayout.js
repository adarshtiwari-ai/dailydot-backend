const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SettingSchema = new mongoose.Schema({
    homeLayout: [{
        section: String,
        enabled: Boolean,
        order: Number
    }]
}, { strict: false });

const Setting = mongoose.model('Setting', SettingSchema);

const resetHomeLayout = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        const defaultLayout = [
            { section: 'categories', enabled: true, order: 1 },
            { section: 'banners', enabled: true, order: 2 },
            { section: 'recent_bookings', enabled: true, order: 3 },
            { section: 'trending_services', enabled: true, order: 4 },
            { section: 'safety_shield', enabled: true, order: 5 }
        ];

        const result = await Setting.updateOne(
            {},
            { $set: { homeLayout: defaultLayout } },
            { upsert: true }
        );

        console.log('Migration successful:', result);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

resetHomeLayout();
