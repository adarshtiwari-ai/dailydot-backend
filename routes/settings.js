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
        const [banners, categories, trendingServices] = await Promise.all([
            Banner.find({ isActive: true, placement: 'home' }).sort({ sortOrder: 1 }).limit(5),
            Category.find({ isActive: true }).sort({ sortOrder: 1 }).limit(10),
            settings.featuredServices && settings.featuredServices.length > 0
                ? Service.find({ _id: { $in: settings.featuredServices }, isActive: true }).populate('category')
                : Service.find({ isActive: true, isTopBooked: true }).populate('category').limit(6)
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
                    ? settings.homeLayout
                        .filter(s => s.enabled !== false)
                        .sort((a, b) => a.order - b.order)
                    : [
                        { section: 'categories', enabled: true, order: 1 },
                        { section: 'banners', enabled: true, order: 2 },
                        { section: 'recent_bookings', enabled: true, order: 3 },
                        { section: 'trending_services', enabled: true, order: 4 },
                        { section: 'safety_shield', enabled: true, order: 5 }
                    ]
            },
            safetyShield: settings.safetyShield || {
                label1: "Verified Pros",
                label2: "Insured",
                label3: "Quality Guaranteed"
            },
            banners: banners ?? [],
            categories: categories ?? [],
            trending: trendingServices ?? [],
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

// Update specific layout section (Instant Update)
router.patch("/layout/:section", [auth, adminAuth], async (req, res) => {
    try {
        const { section } = req.params;
        const { enabled } = req.body;

        const settings = await Setting.findOne();
        if (!settings) return res.status(404).json({ success: false, message: "Settings not found" });

        const layoutIndex = settings.homeLayout.findIndex(s => s.section === section);
        if (layoutIndex === -1) {
            return res.status(404).json({ success: false, message: "Section not found" });
        }

        settings.homeLayout[layoutIndex].enabled = enabled;
        await settings.save();

        res.json({
            success: true,
            message: `Section ${section} ${enabled ? 'enabled' : 'disabled'}`,
            data: settings.homeLayout
        });
    } catch (error) {
        console.error("Patch layout error:", error);
        res.status(500).json({ success: false, message: "Update failed" });
    }
});

// Update settings
router.put("/", [auth, adminAuth], async (req, res) => {
    try {
        const { system, notifications, theme, navigation, homeLayout, safetyShield, featuredServices } = req.body;
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
        if (safetyShield) settings.safetyShield = safetyShield;
        if (featuredServices) settings.featuredServices = featuredServices;

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
