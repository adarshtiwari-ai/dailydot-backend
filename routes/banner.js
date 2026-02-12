const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const upload = require('../middleware/upload');

// Get all active banners
router.get('/', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1 });
        res.json(banners);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new banner (for admin/seed usage)
router.post('/', upload.single("image"), async (req, res) => {
    try {
        // Handle image upload
        if (req.file) {
            req.body.image = `/uploads/${req.file.filename.replace(/\\/g, "/")}`;
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
            req.body.image = `/uploads/${req.file.filename.replace(/\\/g, "/")}`;
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
