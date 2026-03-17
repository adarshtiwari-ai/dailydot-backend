const Setting = require("../models/Setting");

/**
 * Calculates all billing metrics using integer math (paise/cents).
 * Now async to fetch dynamic settings from database.
 * 
 * @param {number} baseCost - The initial cost of the service.
 * @param {Array<{ amount: number, reason?: string }>} adjustments - Optional array of adjustment objects.
 * @returns {Object} Object containing calculated metrics and dynamic line items.
 */
const calculateBillDetails = async (baseCost, adjustments = []) => {
    if (baseCost < 0) {
        throw new Error("Base cost cannot be negative.");
    }

    const settings = await Setting.findOne();
    const billing = settings?.billing || {};
    
    const taxRate = billing.defaultTaxRate !== undefined ? billing.defaultTaxRate : 0.18;
    const serviceFee = (billing.serviceCharge !== undefined ? billing.serviceCharge : 50) * 100;
    const convenienceFee = (billing.convenienceFee !== undefined ? billing.convenienceFee : 25) * 100;
    const PLATFORM_FEE_RATE = 0.10;

    let adjustmentsTotal = 0;
    let appliedDiscounts = [];
    
    for (const adj of adjustments) {
        adjustmentsTotal += Math.round(adj.amount);
        if (adj.amount < 0) {
            appliedDiscounts.push({ 
                name: adj.reason || "Custom Discount", 
                amount: adj.amount 
            });
        }
    }

    const roundedBaseCost = Math.round(baseCost);
    const subtotal = roundedBaseCost + adjustmentsTotal;

    const totalTax = Math.round(subtotal * taxRate);
    const cgst = Math.round(totalTax / 2);
    const sgst = totalTax - cgst;

    const platformFee = Math.round(subtotal * PLATFORM_FEE_RATE);

    const appliedFees = [
        { name: "Service Fee", amount: serviceFee },
        { name: "Convenience Fee", amount: convenienceFee },
        { name: "Taxes (GST)", amount: totalTax }
    ];

    const finalTotal = subtotal + serviceFee + convenienceFee + totalTax;

    return {
        subtotal,
        taxAmount: totalTax,
        serviceFee,
        convenienceFee,
        cgst,
        sgst,
        platformFee,
        appliedFees,
        appliedDiscounts,
        finalTotal
    };
};

module.exports = {
    calculateBillDetails
};
