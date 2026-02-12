const mongoose = require('mongoose');

const quickFixSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    duration: {
        type: String,
        default: '60 mins'
    },
    icon: {
        type: String,
        default: 'build' // Default Ionicon name
    },
    iconColor: {
        type: String,
        default: '#4f46e5'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('QuickFix', quickFixSchema);
