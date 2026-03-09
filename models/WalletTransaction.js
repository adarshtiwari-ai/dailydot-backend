const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
    {
        providerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
        },
        amount: {
            type: Number,
            required: true,
            set: v => Math.round(v), // Integer in Paise
        },
        type: {
            type: String,
            enum: ['COMMISSION_DEBIT', 'ONLINE_PAYOUT_CREDIT', 'MANUAL_SETTLEMENT'],
            required: true,
        },
        description: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
