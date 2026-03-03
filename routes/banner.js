const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Get all active banners (filtered by placement)
router.get('/', async (req, res) => {
    try {
        const { placement, referenceId } = req.query;
        let query = { isActive: true };

        if (placement) {
            query.placement = placement;
            if (referenceId && placement !== 'home') {
                query.referenceId = referenceId;
            } else if (placement !== 'home') {
                // If specific placement requested but no ID, maybe return generic ones for that placement?
                // Or maybe user wants ALL category banners? 
                // Let's stick to strict filtering if ID provided.
                // If placement is 'category' and no ID, return all category banners?
            }
        } else {
            // Default to home if no placement specified? Or return all? 
            // Existing app expects home banners by default or all?
            // Let's assume existing call expects 'home' or general.
            // Safest for backward compat: if no placement query, return everything or filtered?
            // User request: "Update getBanners... to accept query param".
            // Let's make it: if no params, return ALL (or just home? implementation_plan says "Filter results").
            // Let's Default to 'home' if no query provided? No, old app might fetch all.
            // Let's just apply filter IF params exist.
        }

        const banners = await Banner.find(query).sort({ sortOrder: 1 });
        res.json(banners ?? []);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new banner (for admin/seed usage)
router.post('/', upload.single("image"), async (req, res) => {
    try {
        // Handle image upload
        if (req.file) {
            try {
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: "banners",
                });
                req.body.image = result.secure_url;
                fs.unlinkSync(req.file.path);
            } catch (error) {
                console.error("Cloudinary upload error (banner):", error);
            }
        }

        const banner = new Banner(req.body);
        const newBanner = await banner.save();
        res.status(201).json(newBanner);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update a banner
router.put('/:id', upload.single("image"), async (req, res) => {
    try {
        // Handle image upload
        if (req.file) {
            try {
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: "banners",
                });
                req.body.image = result.secure_url;
                fs.unlinkSync(req.file.path);
            } catch (error) {
                console.error("Cloudinary upload error (update banner):", error);
            }
        }

        const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!banner) return res.status(404).json({ message: 'Banner not found' });
        res.json(banner);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete a banner
router.delete('/:id', async (req, res) => {
    try {
        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (!banner) return res.status(404).json({ message: 'Banner not found' });
        res.json({ message: 'Banner deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
