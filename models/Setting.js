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
    },
    { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
