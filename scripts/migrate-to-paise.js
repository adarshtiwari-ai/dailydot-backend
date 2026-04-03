const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Service = require('../models/Service');

async function migrate() {
    const execute = process.argv.includes('--execute');
    
    try {
        console.log(`📡 Connecting to MongoDB...`);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ Connected successfully.`);

        const services = await Service.find({});
        console.log(`🔍 Found ${services.length} services to audit.`);

        let convertedCount = 0;
        let skippedCount = 0;

        for (const service of services) {
            const oldPrice = service.price || 0;
            const oldMrp = service.mrp || 0;
            const oldBestCost = service.bestCostPrice || 0;

            // Heuristic: If price < 10000, it's Rupees. If >= 10000, it's likely already Paise (e.g. 10000 = ₹100).
            const needsConversion = oldPrice < 10000 && oldPrice > 0;

            if (needsConversion) {
                const newPrice = Math.round(oldPrice * 100);
                const newMrp = oldMrp ? Math.round(oldMrp * 100) : undefined;
                const newBestCost = oldBestCost ? Math.round(oldBestCost * 100) : undefined;

                console.log(`[CONVERT] ${service.name.padEnd(30)} | ${oldPrice.toString().padStart(6)} -> ${newPrice.toString().padStart(8)} Paise`);
                
                if (execute) {
                    service.price = newPrice;
                    if (newMrp) service.mrp = newMrp;
                    if (newBestCost) service.bestCostPrice = newBestCost;
                    await service.save();
                }
                convertedCount++;
            } else {
                console.log(`[SKIP]    ${service.name.padEnd(30)} | ${oldPrice.toString().padStart(6)} (Likely already Paise)`);
                skippedCount++;
            }
        }

        console.log("\n--- MIGRATION SUMMARY ---");
        console.log(`Total Services:   ${services.length}`);
        console.log(`Targeted:        ${convertedCount}`);
        console.log(`Skipped:         ${skippedCount}`);
        console.log(`Mode:            ${execute ? 'LIVE EXECUTION' : 'DRY RUN'}`);
        
        if (!execute && convertedCount > 0) {
            console.log("\n⚠️  REPLY '--execute' to perform the actual migration.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

migrate();
