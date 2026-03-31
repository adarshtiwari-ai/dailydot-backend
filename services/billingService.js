const Setting = require("../models/Setting");
const Discount = require("../models/Discount");
const mongoose = require("mongoose");

/**
 * Calculates all billing metrics using integer math (paise/cents).
 * 
 * @param {number} baseCost - The initial cost (in Paise).
 * @param {Array} adjustments - Optional adjustments.
 * @param {Array} items - Items in the cart (for specific discount filtering).
 * @param {Array} materials - Material updates.
 * @param {string} promoCode - Applied promo code (optional).
 * @returns {Object} Full bill breakdown.
 */
const calculateBillDetails = async (baseCost, adjustments = [], items = [], materials = [], promoCode = null) => {
    const safeBaseCost = Number(baseCost) || 0;
    const safeMaterials = Array.isArray(materials) ? materials : [];
    const settings = await Setting.findOne();
    const billing = settings?.billing || {};
    
    // Constants
    const PLATFORM_FEE_RATE = 0.10; 

    // 1. Calculate Materials & Adjustments
    const adjustmentsTotal = adjustments.reduce((sum, adj) => sum + (Number(adj.amount) || 0), 0);
    const materialsTotal = safeMaterials.reduce((sum, mat) => sum + (Number(mat.cost) || 0), 0);
    const taxableSubtotal = safeBaseCost + materialsTotal;

    // 2. Handle Dynamic Promo Logic (CRITICAL)
    const appliedDiscounts = [];
    let discountAmount = 0;

    if (promoCode) {
        const now = new Date();
        const discount = await Discount.findOne({ 
            code: promoCode.toUpperCase().trim(),
            isActive: true,
            $or: [
                { endDate: { $exists: false } },
                { endDate: null },
                { endDate: { $gte: now } }
            ]
        });

        if (discount) {
            if (discount.isUniversal) {
                // Scenario A: Universal Discount
                if (discount.type === 'percentage') {
                    discountAmount = Math.round(taxableSubtotal * (discount.value / 100));
                } else {
                    discountAmount = discount.value * 100; // Convert Flat Rupee to Paise
                }
            } else {
                // Scenario B: Service-Specific Discount
                // Only calculate on eligible items
                const eligibleTotal = items
                    .filter(item => {
                        const sId = item.serviceId?._id || item.serviceId || item.id;
                        return discount.applicableServices.some(asId => asId.toString() === sId.toString());
                    })
                    .reduce((sum, item) => sum + (Number(item.price) || 0), 0);

                if (eligibleTotal > 0) {
                    if (discount.type === 'percentage') {
                        discountAmount = Math.round(eligibleTotal * (discount.value / 100));
                    } else {
                        discountAmount = discount.value * 100;
                    }
                }
            }

            // Enforce Max Cap
            if (discount.maxDiscountAmount > 0 && discountAmount > discount.maxDiscountAmount) {
                discountAmount = discount.maxDiscountAmount;
            }

            if (discountAmount > 0) {
                appliedDiscounts.push({ 
                    name: `${discount.name} (${discount.code})`, 
                    amount: -discountAmount,
                    code: discount.code
                });
            }
        }
    }

    const discountedSubtotal = taxableSubtotal - discountAmount;

    // 3. Handle Tax
    let taxRate = billing.defaultTaxRate !== undefined ? billing.defaultTaxRate : 0.18;
    if (taxRate > 1) taxRate = taxRate / 100;

    const totalTax = Math.round(discountedSubtotal * taxRate);
    const cgst = Math.round(totalTax / 2);
    const sgst = totalTax - cgst;
    const platformFee = Math.round(discountedSubtotal * PLATFORM_FEE_RATE);

    // 4. Calculate Dynamic Global Fees
    let totalDynamicFees = 0;
    const appliedFees = [];
    
    if (billing.globalFees && billing.globalFees.length > 0) {
        billing.globalFees.forEach(fee => {
            if (fee.isActive) {
                let feeAmount = 0;
                if (fee.type === 'flat') {
                    feeAmount = (Number(fee.amount) || 0) * 100;
                } else if (fee.type === 'percentage') {
                    feeAmount = Math.round(discountedSubtotal * ((Number(fee.amount) || 0) / 100));
                }
                totalDynamicFees += feeAmount;
                appliedFees.push({ name: fee.name, amount: feeAmount });
            }
        });
    }

    appliedFees.push({ name: "Taxes (GST)", amount: totalTax });

    // 5. Final Total
    const finalTotal = discountedSubtotal + totalTax + totalDynamicFees + adjustmentsTotal;

    return {
        subtotal: taxableSubtotal,
        discountedSubtotal,
        discountAmount,
        taxAmount: totalTax,
        totalDynamicFees,
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
