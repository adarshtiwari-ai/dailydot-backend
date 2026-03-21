const mongoose = require('mongoose');

const providerWalletSchema = new mongoose.Schema(
    {
        providerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Professional',
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            default: 0,
            set: v => Math.round(v), // Enforce Integer in Paise
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ProviderWallet', providerWalletSchema);
