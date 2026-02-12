const express = require('express');
const router = express.Router();
const QuickFix = require('../models/QuickFix');

// Get all active quick fixes
router.get('/', async (req, res) => {
    try {
        const query = req.query.all === 'true' ? {} : { isActive: true };
        const quickFixes = await QuickFix.find(query).sort({ sortOrder: 1 });
        res.json(quickFixes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create a new quick fix
router.post('/', async (req, res) => {
    try {
        const quickFix = new QuickFix(req.body);
        const newQuickFix = await quickFix.save();
        res.status(201).json(newQuickFix);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update a quick fix
router.put('/:id', async (req, res) => {
    try {
        const quickFix = await QuickFix.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!quickFix) return res.status(404).json({ message: 'Quick Fix not found' });
        res.json(quickFix);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete a quick fix
router.delete('/:id', async (req, res) => {
    try {
        const quickFix = await QuickFix.findByIdAndDelete(req.params.id);
        if (!quickFix) return res.status(404).json({ message: 'Quick Fix not found' });
        res.json({ message: 'Quick Fix deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
