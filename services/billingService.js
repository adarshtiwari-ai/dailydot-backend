const TAX_RATE = 0.18;
const PLATFORM_FEE_RATE = 0.10;

/**
 * Calculates all billing metrics using integer math (paise/cents).
 * 
 * @param {number} baseCost - The initial cost of the service.
 * @param {Array<{ amount: number, reason?: string }>} adjustments - Optional array of adjustment objects.
 * @returns {Object} Object containing calculated subtotal, taxes, fees, and finalTotal.
 */
const calculateBillDetails = (baseCost, adjustments = []) => {
    if (baseCost < 0) {
        throw new Error("Base cost cannot be negative.");
    }

    let adjustmentsTotal = 0;
    for (const adj of adjustments) {
        if (adj.amount < 0) {
            throw new Error("Adjustment amount cannot be negative.");
        }
        adjustmentsTotal += Math.round(adj.amount);
    }

    const roundedBaseCost = Math.round(baseCost);
    const subtotal = roundedBaseCost + adjustmentsTotal;

    const totalTaxRaw = subtotal * TAX_RATE;
    const totalTax = Math.round(totalTaxRaw);

    // Split 50/50, ensuring cgst + sgst exactly equals totalTax
    const cgst = Math.round(totalTax / 2);
    const sgst = totalTax - cgst;

    const platformFeeRaw = subtotal * PLATFORM_FEE_RATE;
    const platformFee = Math.round(platformFeeRaw);

    const finalTotal = subtotal + totalTax;

    return {
        subtotal,
        totalTax,
        cgst,
        sgst,
        platformFee,
        finalTotal
    };
};

module.exports = {
    TAX_RATE,
    PLATFORM_FEE_RATE,
    calculateBillDetails
};
