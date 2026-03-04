const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SettingSchema = new mongoose.Schema({}, { strict: false });
const Setting = mongoose.model('Setting', SettingSchema);

const seedSettings = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        const defaultTheme = {
            primary: '#4f46e5',
            secondary: '#818cf8',
            backgroundType: 'gradient',
            gradientColors: ['#667eea', '#764ba2'], // Blue-to-Purple gradient
            fonts: {
                main: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
                heading: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&display=swap"
            }
        };

        const defaultHomeLayout = [
            { section: 'categories', enabled: true, order: 1 },
            { section: 'banners', enabled: true, order: 2 },
            { section: 'recent_bookings', enabled: true, order: 3 },
            { section: 'trending_services', enabled: true, order: 4 },
            { section: 'safety_shield', enabled: true, order: 5 },
            { section: 'car_on_wheels', enabled: true, order: 6 },
            { section: 'top_booked', enabled: true, order: 7 }
        ];

        const result = await Setting.updateOne(
            {},
            {
                $set: {
                    theme: defaultTheme,
                    homeLayout: defaultHomeLayout,
                    system: {
                        siteName: "DailyDot Admin",
                        currency: "INR",
                        timezone: "Asia/Kolkata",
                        maintenanceMode: false
                    }
                }
            },
            { upsert: true }
        );

        console.log('Settings seeded successfully:', result);
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedSettings();
