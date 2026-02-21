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
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'placement', // Dynamic reference based on placement? No, refPath usually points to a field holding the model name. 
        // Simpler to just store ObjectId and handle lookup manually if needed, or just use as filter.
        // Let's just store it as ObjectId.
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Banner', bannerSchema);
