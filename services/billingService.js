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
    const serviceFee = (billing.serviceCharge !== undefined ? billing.serviceCharge : 50) * 100;
    const convenienceFee = (billing.convenienceFee !== undefined ? billing.convenienceFee : 25) * 100;
    const PLATFORM_FEE_RATE = 0.10;

    // 1. Calculate Materials Total
    const materialsTotal = (materials || []).reduce((sum, mat) => sum + (Number(mat.cost) || 0), 0);

    // 2. Taxable Subtotal (Base + Materials)
    const taxableSubtotal = Math.round(baseCost) + materialsTotal;

    // 3. Fetch active discounts from the DB
    const activeDiscounts = await Discount.find({ isActive: true });
    let totalDiscountAmount = 0;
    let appliedDiscounts = [];

    activeDiscounts.forEach(discount => {
        let isApplicable = false;

        // Check if Universal OR if the cart contains an applicable service
        if (discount.isUniversal) {
            isApplicable = true;
        } else if (items && items.length > 0) {
            isApplicable = items.some(item => {
                const sId = (item.serviceId?._id || item.serviceId || "").toString();
                return discount.applicableServices.some(appSId => appSId.toString() === sId);
            });
        }

        if (isApplicable) {
            const discountAmount = discount.type === 'percentage' 
                ? Math.round(taxableSubtotal * (discount.value / 100)) 
                : discount.value * 100;

            totalDiscountAmount += discountAmount;
            appliedDiscounts.push({ name: discount.name, amount: -discountAmount });
        }
    });

    // 4. Handle manual adjustments
    let adjustmentsTotal = 0;
    for (const adj of adjustments) {
        adjustmentsTotal += Math.round(adj.amount);
        if (adj.amount < 0) {
            appliedDiscounts.push({ 
                name: adj.reason || "Custom Adjustment", 
                amount: adj.amount 
            });
        }
    }

    // 5. Discounted Subtotal (for Tax Calculation)
    // We apply discounts to the taxableSubtotal before tax
    const discountedSubtotal = Math.max(0, taxableSubtotal - totalDiscountAmount);

    // 6. Calculate Tax based on Discounted Subtotal
    const totalTax = Math.round(discountedSubtotal * taxRate);
    const cgst = Math.round(totalTax / 2);
    const sgst = totalTax - cgst;

    const platformFee = Math.round(discountedSubtotal * PLATFORM_FEE_RATE);

    const appliedFees = [
        { name: "Service Fee", amount: serviceFee },
        { name: "Convenience Fee", amount: convenienceFee },
        { name: "Taxes (GST)", amount: totalTax }
    ];

    // 7. Final Total
    const finalTotal = discountedSubtotal + serviceFee + convenienceFee + totalTax + adjustmentsTotal;

    return {
        subtotal: taxableSubtotal,
        discountedSubtotal,
        taxAmount: totalTax,
        serviceFee,
        convenienceFee,
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
