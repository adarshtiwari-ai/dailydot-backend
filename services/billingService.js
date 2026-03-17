const Setting = require("../models/Setting");
const Discount = require("../models/Discount");

/**
 * Calculates all billing metrics using integer math (paise/cents).
 * Now async to fetch dynamic settings from database.
 * 
 * @param {number} baseCost - The initial cost of the service.
 * @param {Array<{ amount: number, reason?: string }>} adjustments - Optional array of adjustment objects.
 * @param {Array} items - Optional array of items in the cart to check for applicable discounts.
 * @param {Array} materials - Optional array of material objects { name: string, cost: number }.
 * @returns {Object} Object containing calculated metrics and dynamic line items.
 */
const calculateBillDetails = async (baseCost, adjustments = [], items = [], materials = []) => {
    if (baseCost < 0) {
        throw new Error("Base cost cannot be negative.");
    }

    const settings = await Setting.findOne();
    const billing = settings?.billing || {};
    
    let taxRate = billing.defaultTaxRate !== undefined ? billing.defaultTaxRate : 0.18;
    // Defensive check: if taxRate is percentage (e.g. 18), convert to decimal (0.18)
    if (taxRate > 1) {
        taxRate = taxRate / 100;
    }
    // 6. Calculate Tax based on Discounted Subtotal
    const totalTax = Math.round(discountedSubtotal * taxRate);
    const cgst = Math.round(totalTax / 2);
    const sgst = totalTax - cgst;

    const platformFee = Math.round(discountedSubtotal * PLATFORM_FEE_RATE);

    // 7. Calculate Dynamic Global Fees
    let totalDynamicFees = 0;
    const appliedFees = [];
    
    if (billing.globalFees && billing.globalFees.length > 0) {
        billing.globalFees.forEach(fee => {
            if (fee.isActive) {
                let feeAmount = 0;
                if (fee.type === 'flat') {
                    feeAmount = fee.amount * 100; // Convert to paise
                } else if (fee.type === 'percentage') {
                    feeAmount = Math.round(taxableSubtotal * (fee.amount / 100));
                }
                
                totalDynamicFees += feeAmount;
                appliedFees.push({ name: fee.name, amount: feeAmount });
            }
        });
    } else {
        // FALLBACK: Use legacy fields if globalFees array is empty
        const legacyServiceFee = (billing.serviceCharge !== undefined ? billing.serviceCharge : 50) * 100;
        const legacyConvenienceFee = (billing.convenienceFee !== undefined ? billing.convenienceFee : 25) * 100;
        
        totalDynamicFees = legacyServiceFee + legacyConvenienceFee;
        appliedFees.push({ name: "Service Fee", amount: legacyServiceFee });
        appliedFees.push({ name: "Convenience Fee", amount: legacyConvenienceFee });
    }

    // Add Tax to appliedFees
    appliedFees.push({ name: "Taxes (GST)", amount: totalTax });

    // 8. Final Total
    const finalTotal = discountedSubtotal + totalTax + totalDynamicFees + adjustmentsTotal;

    return {
        subtotal: taxableSubtotal,
        discountedSubtotal,
        taxAmount: totalTax,
        totalDynamicFees, // Replaces static fee fields in return object
        cgst,
        sgst,
        platformFee,
        appliedFees,
        appliedDiscounts,
        materialsTotal,
        finalTotal
    };
};

module.exports = {
    calculateBillDetails
};
