const express = require("express");
const Setting = require("../models/Setting");
const Banner = require("../models/Banner");
const Category = require("../models/Category");
const Service = require("../models/Service");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();

// Public: Get Mobile Application Configuration
router.get("/app-config", async (req, res) => {
    try {
        let settings = await Setting.findOne();

        if (!settings) {
            settings = await Setting.create({});
        }

        // Fetch initial data for faster hydration
        const [banners, categories, trending] = await Promise.all([
            Banner.find({ isActive: true, placement: 'home' }).sort({ sortOrder: 1 }).limit(5),
            Category.find({ isActive: true }).sort({ sortOrder: 1 }).limit(10),
            Service.find({ isActive: true, isTopBooked: true }).populate('category').limit(6)
        ]);

        // Transform for mobile app consumption with robust defaults
        const config = {
            theme: {
                primary: settings.theme?.primary || "#667eea",
                secondary: settings.theme?.secondary || "#764ba2",
                fontUrls: settings.theme?.fontUrls || []
            },
            navigation: (settings.navigation && settings.navigation.length > 0) ? settings.navigation : [
                { label: 'Home', route: 'home', icon: 'home' },
                { label: 'Bookings', route: 'history', icon: 'time-outline' },
                { label: 'Decor', route: 'decor', icon: 'color-palette-outline' },
                { label: 'Profile', route: 'profile', icon: 'person' },
            ],
            layout: {
                home: (settings.homeLayout && settings.homeLayout.length > 0)
                    ? settings.homeLayout.sort((a, b) => a.order - b.order)
                    : [
                        { section: 'banners', visible: true, order: 1 },
                        { section: 'categories', visible: true, order: 2 },
                        { section: 'trending', visible: true, order: 3 }
                    ]
            },
            banners: banners ?? [],
            categories: categories ?? [],
            trending: trending ?? [],
            maintenance: settings.system?.maintenanceMode || false
        };

        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error("App Config error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch app configuration"
        });
    }
});

// Get settings (singleton)
router.get("/", auth, async (req, res) => {
    try {
        let settings = await Setting.findOne();

        // Create default settings if none exist
        if (!settings) {
            settings = await Setting.create({});
        }

        res.json({
            success: true,
            data: settings,
        });
    } catch (error) {
        console.error("Get settings error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch settings",
        });
    }
});

// Update settings
router.put("/", [auth, adminAuth], async (req, res) => {
    try {
        const { system, notifications, theme, navigation, homeLayout } = req.body;
        let settings = await Setting.findOne();

        if (!settings) {
            settings = new Setting();
        }

        // Update fields if provided
        if (system) settings.system = { ...settings.system.toObject(), ...system };
        if (notifications) settings.notifications = { ...settings.notifications.toObject(), ...notifications };
        if (theme) settings.theme = { ...settings.theme.toObject(), ...theme };
        if (navigation) settings.navigation = navigation;
        if (homeLayout) settings.homeLayout = homeLayout;

        await settings.save();

        res.json({
            success: true,
            message: "Settings updated successfully",
            data: settings,
        });
    } catch (error) {
        console.error("Update settings error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update settings",
        });
    }
});

module.exports = router;
