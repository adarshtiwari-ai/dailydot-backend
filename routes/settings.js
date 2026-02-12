const express = require("express");
const Setting = require("../models/Setting");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();

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
        const { system, notifications } = req.body;
        let settings = await Setting.findOne();

        if (!settings) {
            settings = new Setting();
        }

        // Update fields if provided
        if (system) settings.system = { ...settings.system.toObject(), ...system };
        if (notifications) settings.notifications = { ...settings.notifications.toObject(), ...notifications };

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
