const Setting = require("../models/Setting");
const Discount = require("../models/Discount");
const mongoose = require("mongoose");

/**
 * Calculates all billing metrics using integer math (paise/cents).
 * 
 * @param {number} baseCost - The customer-facing base price (before additions).
 * @param {Array} adjustments - Optional adjustments (manual discounts/additions).
 * @param {Array} items - Items in the cart.
 * @param {Array} materials - Material updates.
 * @param {string} promoCode - Applied promo code (optional).
 * @param {number} bestCostTotal - The taxable base of the service (Service-Agreement logic).
 * @returns {Object} Full bill breakdown.
 */
const calculateBillDetails = async (baseCost, adjustments = [], items = [], materials = [], promoCode = null, bestCostTotal = null) => {
    const safeBaseCost = Number(baseCost) || 0;
    const safeMaterials = Array.isArray(materials) ? materials : [];
    const settings = await Setting.findOne();
    const billing = settings?.billing || {};

    // 1. Fetch Dynamic Fees from Settings
    const platformFee = (Number(billing.serviceCharge) ?? 0) * 100; // in Paise
    const convenienceFee = (Number(billing.convenienceFee) ?? 0) * 100; // in Paise
    const taxRate = Number(billing.defaultTaxRate) ?? 0.18; // Use setting or fallback to 18%

    // 2. Calculate Materials & Adjustments
    const adjustmentsTotal = adjustments.reduce((sum, adj) => sum + (Number(adj.amount) || 0), 0);
    const materialsTotal = safeMaterials.reduce((sum, mat) => sum + (Number(mat.cost) || 0), 0);
    
    // Use bestCostTotal if provided (from Admin UI), otherwise fallback to baseCost
    const taxableBase = Number(bestCostTotal) || safeBaseCost;

    // 3. Handle Promo Logic (Applied only to Service Base if not universal)
    let discountAmount = 0;
    const appliedDiscounts = [];

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
                discountAmount = discount.type === 'percentage' 
                    ? Math.round(taxableBase * (discount.value / 100))
                    : discount.value * 100;
            } else {
                const eligibleTotal = items
                    .filter(item => {
                        const sId = item.serviceId?._id || item.serviceId || item.id;
                        return discount.applicableServices.some(asId => asId.toString() === sId.toString());
                    })
                    .reduce((sum, item) => sum + (Number(item.price) || 0), 0);

                if (eligibleTotal > 0) {
                    discountAmount = discount.type === 'percentage'
                        ? Math.round(eligibleTotal * (discount.value / 100))
                        : discount.value * 100;
                }
            }

            if (discount.maxDiscountAmount > 0 && discountAmount > discount.maxDiscountAmount) {
                discountAmount = discount.maxDiscountAmount;
            }

            discountAmount = Math.min(discountAmount, taxableBase);
            if (discountAmount > 0) {
                appliedDiscounts.push({
                    name: `${discount.name} (${discount.code})`,
                    amount: -discountAmount,
                    code: discount.code
                });
            }
        }
    }

    // 4. Handle Tax (STRICTLY ON bestCostTotal/taxableBase)
    const totalTax = Math.round(taxableBase * taxRate);
    const cgst = Math.round(totalTax / 2);
    const sgst = totalTax - cgst;

    // 5. Final Calculation
    // Total = bestCostTotal + Tax + materialsTotal - discounts + platformFee + convenienceFee
    const finalTotal = Math.max(0, taxableBase + totalTax + materialsTotal - discountAmount + platformFee + convenienceFee + adjustmentsTotal);

    return {
        subtotal: taxableBase,
        discountAmount,
        taxAmount: totalTax,
        taxRate, // Persist the rate used for this calculation
        cgst,
        sgst,
        platformFee,
        convenienceFee,
        materialsTotal,
        appliedDiscounts,
        finalTotal
    };
};

module.exports = {
    calculateBillDetails
};
