const mongoose = require("mongoose");
require("dotenv").config();
const Service = require("../models/Service");

const migrateBestCostPrice = async () => {
    try {
        console.log("--- STARTING BEST COST PRICE MIGRATION ---");
        
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const services = await Service.find({ bestCostPrice: { $exists: false } });
        console.log(`Found ${services.length} services requiring migration.`);

        let count = 0;
        for (const service of services) {
            // Default bestCostPrice to the current service price
            service.bestCostPrice = service.price;
            await service.save();
            count++;
            if (count % 10 === 0) console.log(`Migrated ${count} services...`);
        }

        console.log(`--- MIGRATION COMPLETE: ${count} SERVICES UPDATED ---`);
        process.exit(0);
    } catch (error) {
        console.error("MIGRATION FAILED:", error);
        process.exit(1);
    }
};

migrateBestCostPrice();
