const ProviderWallet = require('../models/ProviderWallet');
const WalletTransaction = require('../models/WalletTransaction');

/**
 * Charge platform fee to a provider's wallet.
 * @param {string|ObjectId} providerId 
 * @param {string|ObjectId} bookingId 
 * @param {number} platformFeeAmount - In paise
 */
const chargePlatformFee = async (providerId, bookingId, platformFeeAmount) => {
    if (!platformFeeAmount || platformFeeAmount <= 0) return;
    const roundedAmount = Math.round(platformFeeAmount);

    // Idempotency Guard: Prevent duplicate platform fee deduction for the same booking
    const existingDebit = await WalletTransaction.findOne({ bookingId, type: 'COMMISSION_DEBIT' });
    if (existingDebit) {
        console.log(`[WalletService] COMMISSION_DEBIT already exists for booking ${bookingId}. Skipping.`);
        return;
    }

    // Create transaction
    await WalletTransaction.create({
        providerId,
        bookingId,
        amount: roundedAmount,
        type: 'COMMISSION_DEBIT',
        description: `Platform fee deducted for booking ${bookingId}`,
    });

    // Find and update or create wallet
    let wallet = await ProviderWallet.findOne({ providerId });
    if (!wallet) {
        wallet = new ProviderWallet({ providerId, balance: 0 });
    }

    // Deduct fee (balance goes negative representing debt)
    wallet.balance -= roundedAmount;
    await wallet.save();

    return wallet;
};

/**
 * Credit online payout to a provider's wallet.
 * @param {string|ObjectId} providerId 
 * @param {string|ObjectId} bookingId 
 * @param {number} providerCut - In paise
 */
const creditOnlinePayout = async (providerId, bookingId, providerCut) => {
    if (!providerCut || providerCut <= 0) return;
    const roundedAmount = Math.round(providerCut);

    // Idempotency Guard: Prevent duplicate online payout credit for the same booking
    const existingCredit = await WalletTransaction.findOne({ bookingId, type: 'ONLINE_PAYOUT_CREDIT' });
    if (existingCredit) {
        console.log(`[WalletService] ONLINE_PAYOUT_CREDIT already exists for booking ${bookingId}. Skipping.`);
        return;
    }

    // Create transaction
    await WalletTransaction.create({
        providerId,
        bookingId,
        amount: roundedAmount,
        type: 'ONLINE_PAYOUT_CREDIT',
        description: `Earnings from online payment for booking ${bookingId}`,
    });

    // Find and update or create wallet
    let wallet = await ProviderWallet.findOne({ providerId });
    if (!wallet) {
        wallet = new ProviderWallet({ providerId, balance: 0 });
    }

    // Credit balance
    wallet.balance += roundedAmount;
    await wallet.save();

    return wallet;
};

/**
 * Settle dues for a provider when they pay admin.
 * @param {string|ObjectId} providerId 
 * @param {number} amount - In paise
 */
const settleDues = async (providerId, amount) => {
    if (!amount || amount <= 0) return;
    const roundedAmount = Math.round(amount);

    await WalletTransaction.create({
        providerId,
        amount: roundedAmount,
        type: 'MANUAL_SETTLEMENT',
        description: `Manual settlement from Admin`,
    });

    let wallet = await ProviderWallet.findOne({ providerId });
    if (!wallet) {
        wallet = new ProviderWallet({ providerId, balance: 0 });
    }

    // Add back to balance
    wallet.balance += roundedAmount;
    await wallet.save();

    return wallet;
};

module.exports = {
    chargePlatformFee,
    creditOnlinePayout,
    settleDues,
};
