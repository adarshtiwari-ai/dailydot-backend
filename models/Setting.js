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
                section: { type: String, default: "banners" },
                order: { type: Number, default: 1 },
                visible: { type: Boolean, default: true }
            },
            {
                section: { type: String, default: "categories" },
                order: { type: Number, default: 2 },
                visible: { type: Boolean, default: true }
            },
            {
                section: { type: String, default: "trending" },
                order: { type: Number, default: 3 },
                visible: { type: Boolean, default: true }
            }
        ]
    },
    { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
