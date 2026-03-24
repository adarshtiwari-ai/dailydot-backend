const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    subtitle: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        required: true
    },
    redirectUrl: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    placement: {
        type: String,
        enum: ['home', 'category', 'service'],
        default: 'home'
    },
    linkType: {
        type: String,
        enum: ['url', 'service', 'category', 'none'],
        default: 'url'
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'linkType', 
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Banner', bannerSchema);
