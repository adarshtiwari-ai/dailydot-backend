const express = require("express");
const Setting = require("../models/Setting");
const Banner = require("../models/Banner");
const Category = require("../models/Category");
const Service = require("../models/Service");
const { auth, adminAuth } = require("../middleware/auth");
const { getIo } = require("../services/socket.service");
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

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
                backgroundType: settings.theme?.backgroundType || 'solid',
                gradientColors: settings.theme?.gradientColors || ["#667eea", "#764ba2"],
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
            maintenance: settings.system?.maintenanceMode || false,
            splash: {
                logoUrl: settings.splash?.logoUrl || '',
                backgroundColor: settings.splash?.backgroundColor || '#0F172A'
            },
            featureFlags: {
                enableWallet:       settings.featureFlags?.enableWallet       ?? false,
                enableReferrals:    settings.featureFlags?.enableReferrals    ?? false,
                enableNewUI:        settings.featureFlags?.enableNewUI        ?? false,
                seasonalMode:       settings.featureFlags?.seasonalMode       ?? false,
                enableProviderChat: settings.featureFlags?.enableProviderChat ?? false
            },
            homeScreen: {
                heroBannerUrl: settings.homeScreen?.heroBannerUrl || '',
                gradientTopColor: settings.homeScreen?.heroBannerUrl ? 'rgba(0,0,0,0.6)' : 'transparent',
                gradientMidColor: settings.homeScreen?.gradientMidColor || 'transparent',
                gradientBottomColor: settings.homeScreen?.gradientBottomColor || 'rgba(0,0,0,0.8)',
                gradientOpacity: settings.homeScreen?.gradientOpacity ?? 1,
                heroBanners: settings.homeScreen?.heroBanners || [],
                homeScreenMascotUrl: settings.homeScreen?.homeScreenMascotUrl || ''
            },
            billing: settings.billing || { defaultTaxRate: 0.18, serviceCharge: 50, convenienceFee: 25 },
            activeMapProvider: settings.system?.activeMapProvider || 'google'
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

// Upload Mascot Image
router.put("/mascot", [auth, adminAuth, upload.single("image")], async (req, res) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) settings = new Setting();

        if (req.file) {
            try {
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: "settings",
                });
                
                if (!settings.homeScreen) settings.homeScreen = {};
                settings.homeScreen.homeScreenMascotUrl = result.secure_url;
                settings.markModified('homeScreen');
                
                await settings.save();
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

                return res.json({
                    success: true,
                    message: "Mascot updated successfully",
                    data: { homeScreenMascotUrl: settings.homeScreen.homeScreenMascotUrl }
                });
            } catch (error) {
                console.error("Cloudinary upload error (mascot):", error);
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(500).json({ success: false, message: "Error uploading image to Cloudinary" });
            }
        } else {
            return res.status(400).json({ success: false, message: "No image file provided" });
        }
    } catch (error) {
        console.error("Mascot upload error:", error);
        res.status(500).json({ success: false, message: "Failed to upload mascot" });
    }
});

// Update settings
router.put("/", [auth, adminAuth], async (req, res) => {
    try {
        const { system, notifications, theme, navigation, homeLayout, safetyShield, featuredServices, billing, splash, featureFlags, homeScreen } = req.body;
        let settings = await Setting.findOne();

        if (!settings) {
            settings = new Setting();
        }

        // Update fields if provided
        if (system) {
            settings.system = { ...settings.system.toObject(), ...system };
            settings.markModified('system');
        }
        if (billing) {
            settings.billing = { ...settings.billing.toObject(), ...billing };
            settings.markModified('billing');
        }
        if (notifications) settings.notifications = { ...settings.notifications.toObject(), ...notifications };
        if (theme) settings.theme = { ...settings.theme.toObject(), ...theme };
        if (navigation) settings.navigation = navigation;
        if (homeLayout) settings.homeLayout = homeLayout;
        if (safetyShield) settings.safetyShield = safetyShield;
        if (featuredServices) settings.featuredServices = featuredServices;
        if (splash) {
            settings.splash = { ...settings.splash?.toObject(), ...splash };
            settings.markModified('splash');
        }
        if (featureFlags) {
            settings.featureFlags = { ...settings.featureFlags?.toObject(), ...featureFlags };
            settings.markModified('featureFlags');
        }
        if (homeScreen) {
            settings.homeScreen = { ...settings.homeScreen?.toObject(), ...homeScreen };
            settings.markModified('homeScreen');
        }

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

// Update Map Provider Strategy
router.put("/map-provider", [auth, adminAuth], async (req, res) => {
    try {
        const { provider } = req.body;
        if (!['ola', 'google'].includes(provider)) {
            return res.status(400).json({ success: false, message: "Invalid provider specified" });
        }

        let settings = await Setting.findOne();
        if (!settings) {
            settings = new Setting();
        }

        settings.system.activeMapProvider = provider;
        await settings.save();

        // Emit socket event for real-time mobile update
        const io = getIo();
        if (io) {
            io.emit('map-provider-changed', { provider });
        }

        res.json({
            success: true,
            message: `Map provider updated to ${provider.toUpperCase()}`,
            data: settings.system.activeMapProvider
        });
    } catch (error) {
        console.error("Update map provider error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update map provider"
        });
    }
});

module.exports = router;
