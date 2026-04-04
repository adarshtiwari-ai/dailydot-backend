const WalletService = require('./walletService');

/**
 * Execute final wallet settlement for a booking.
 * Calculates provider payout and platform commission.
 * 
 * @param {Object} booking - The Booking document
 */
exports.executeSettlement = async (booking) => {
    if (!booking || !booking.assignedPro) {
        console.log(`[SettlementService] No booking or assignedPro for settlement of ${booking?._id}. Skipping.`);
        return;
    }

    // 1. Math Logic: Unified Split
    const totalToSplit = booking.finalTotal || booking.totalAmount || 0;
    const mCost = booking.materialCost || 0;
    const aComm = booking.adminCommission || 0;

    // The split: Provider Payout = Total - Materials - Commission
    const providerPayout = totalToSplit - mCost - aComm;

    try {
        if (booking.paymentMethod === "cod" || booking.paymentMethod === "cash") {
            // Path B: COD/Cash — Provider already has the physical cash.
            // Platform take-home = Total - Payout = Materials + Commission.
            // We charge the provider's wallet for this amount.
            const platformTakeHome = totalToSplit - providerPayout;

            if (platformTakeHome > 0) {
                await WalletService.chargePlatformFee(
                    booking.assignedPro._id || booking.assignedPro,
                    booking._id,
                    platformTakeHome
                );
                console.log(`[SettlementService] Cash Settlement: Charged platform fee ₹${(platformTakeHome / 100).toFixed(2)} to Pro.`);
            }
        } else {
            // Path A: Online — Platform has the digital cash.
            // We credit the provider their specific payout.
            if (providerPayout > 0) {
                await WalletService.creditOnlinePayout(
                    booking.assignedPro._id || booking.assignedPro,
                    booking._id,
                    providerPayout
                );
                console.log(`[SettlementService] Online Settlement: Credited provider payout ₹${(providerPayout / 100).toFixed(2)} to Pro.`);
            }
        }

        // Mark as settled in DB if not already
        if (!booking.isSettled) {
            booking.isSettled = true;
            await booking.save();
        }

        return { success: true, providerPayout, platformCommission: aComm };

    } catch (error) {
        console.error(`[SettlementService] CRITICAL SETTLEMENT ERROR for booking ${booking._id}:`, error);
        throw error;
    }
};
