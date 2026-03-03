require("dotenv").config();
const mongoose = require("mongoose");
const Setting = require("./models/Setting");
const connectDB = require("./config/database");

const seedConfig = async () => {
    try {
        await connectDB();

        let settings = await Setting.findOne();
        if (!settings) {
            settings = new Setting();
        }

        // Set default theme
        settings.theme = {
            primary: "#4f46e5",
            secondary: "#818cf8",
            fonts: {
                main: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
                heading: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&display=swap"
            }
        };

        // Set default navigation
        settings.navigation = [
            { label: "Home", icon: "home", route: "Home" },
            { label: "Bookings", icon: "calendar", route: "Bookings" },
            { label: "Account", icon: "person", route: "Profile" }
        ];

        // Set default home layout
        settings.homeLayout = [
            { section: "banners", order: 1, visible: true },
            { section: "categories", order: 2, visible: true },
            { section: "trending", order: 3, visible: true }
        ];

        await settings.save();
        console.log("✅ App Config seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedConfig();
