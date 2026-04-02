const mongoose = require("mongoose");
const path = require('path');
require("dotenv").config({ path: path.resolve(__dirname, '../.env') });
const Service = require("../models/Service");

const migrateBestCostPrice = async () => {
    try {
        console.log("--- STARTING BEST COST PRICE MIGRATION ---");
        
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("Database URI not found in .env file (checked MONGO_URI and MONGODB_URI)");
        }

        await mongoose.connect(uri);
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
