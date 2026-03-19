const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
    {
        system: {
            siteName: { type: String, default: "DailyDot Admin" },
            currency: { type: String, default: "INR" },
            timezone: { type: String, default: "Asia/Kolkata" },
            maintenanceMode: { type: Boolean, default: false },
            allowRegistrations: { type: Boolean, default: true },
            autoBackup: { type: Boolean, default: true },
            activeMapProvider: { type: String, enum: ['ola', 'google'], default: 'ola' }
        },
        notifications: {
            newBookings: { type: Boolean, default: true },
            paymentUpdates: { type: Boolean, default: true },
            userRegistrations: { type: Boolean, default: true },
            systemAlerts: { type: Boolean, default: true },
            dailyReports: { type: Boolean, default: false },
            weeklyReports: { type: Boolean, default: true },
            monthlyReports: { type: Boolean, default: true },
        },
        theme: {
            primary: { type: String, default: "#4f46e5" },
            secondary: { type: String, default: "#818cf8" },
            backgroundType: { type: String, enum: ['solid', 'gradient'], default: 'solid' },
            gradientColors: { type: [String], default: ["#667eea", "#764ba2"] },
            fonts: {
                main: { type: String, default: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" },
                heading: { type: String, default: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&display=swap" }
            }
        },
        navigation: [
            {
                label: { type: String, default: "Home" },
                icon: { type: String, default: "home" },
                route: { type: String, default: "Home" }
            },
            {
                label: { type: String, default: "Bookings" },
                icon: { type: String, default: "calendar" },
                route: { type: String, default: "Bookings" }
            },
            {
                label: { type: String, default: "Profile" },
                icon: { type: String, default: "person" },
                route: { type: String, default: "Profile" }
            }
        ],
        homeLayout: [
            {
                section: { type: String, default: "categories" },
                order: { type: Number, default: 1 },
                enabled: { type: Boolean, default: true }
            },
            {
                section: { type: String, default: "banners" },
                order: { type: Number, default: 2 },
                enabled: { type: Boolean, default: true }
            },
            {
                section: { type: String, default: "recent_bookings" },
                order: { type: Number, default: 3 },
                enabled: { type: Boolean, default: true }
            },
            {
                section: { type: String, default: "trending_services" },
                order: { type: Number, default: 4 },
                enabled: { type: Boolean, default: true }
            },
            {
                section: { type: String, default: "safety_shield" },
                order: { type: Number, default: 5 },
                enabled: { type: Boolean, default: true }
            }
        ],
        safetyShield: {
            label1: { type: String, default: "Verified Pros" },
            label2: { type: String, default: "Insured" },
            label3: { type: String, default: "Quality Guaranteed" }
        },
        billing: {
            defaultTaxRate: { type: Number, default: 0.18 },
            serviceCharge: { type: Number, default: 50 },
            convenienceFee: { type: Number, default: 25 },
            globalFees: [{
                name: { type: String, required: true },
                amount: { type: Number, required: true },
                type: { type: String, enum: ['flat', 'percentage'], default: 'flat' },
                isActive: { type: Boolean, default: true }
            }]
        },
        featuredServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
        splash: {
            logoUrl: { type: String, default: '' },
            backgroundColor: { type: String, default: '#0F172A' }
        },
        featureFlags: {
            enableWallet:       { type: Boolean, default: false },
            enableReferrals:    { type: Boolean, default: false },
            enableNewUI:        { type: Boolean, default: false },
            seasonalMode:       { type: Boolean, default: false },
            enableProviderChat: { type: Boolean, default: false }
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
