const Setting = require("../models/Setting");
const Discount = require("../models/Discount");

/**
 * Calculates all billing metrics using integer math (paise/cents).
 * Now async to fetch dynamic settings from database.
 * 
 * @param {number} baseCost - The initial cost of the service.
 * @param {Array<{ amount: number, reason?: string }>} adjustments - Optional array of adjustment objects.
 * @param {Array} items - Optional array of items in the cart to check for applicable discounts.
 * @returns {Object} Object containing calculated metrics and dynamic line items.
 */
const calculateBillDetails = async (baseCost, adjustments = [], items = []) => {
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
    
    // 1. Fetch active discounts from the DB
    const activeDiscounts = await Discount.find({ isActive: true });
    let totalDiscountAmount = 0;

    activeDiscounts.forEach(discount => {
        let isApplicable = false;

        // Check if Universal OR if the cart contains an applicable service
        if (discount.isUniversal) {
            isApplicable = true;
        } else if (items && items.length > 0) {
            // Check if any item in the cart matches the applicable services for this discount
            const itemServiceIds = items.map(item => (item.serviceId?._id || item.serviceId || "").toString());
            isApplicable = items.some(item => {
                const sId = (item.serviceId?._id || item.serviceId || "").toString();
                return discount.applicableServices.some(appSId => appSId.toString() === sId);
            });
        }

        if (isApplicable) {
            const discountAmount = discount.type === 'percentage' 
                ? Math.round(baseCost * (discount.value / 100)) 
                : discount.value * 100; // Assuming value is in Rupees, convert to Paise

            totalDiscountAmount += discountAmount;
            appliedDiscounts.push({ name: discount.name, amount: -discountAmount });
        }
    });

    // 2. Handle manual adjustments (like those from admin dashboard)
    for (const adj of adjustments) {
        adjustmentsTotal += Math.round(adj.amount);
        if (adj.amount < 0) {
            appliedDiscounts.push({ 
                name: adj.reason || "Custom Adjustment", 
                amount: adj.amount 
            });
        }
    }

    const roundedBaseCost = Math.round(baseCost);
    // Prevent negative subtotals
    const subtotal = Math.max(0, roundedBaseCost - totalDiscountAmount + adjustmentsTotal);

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
