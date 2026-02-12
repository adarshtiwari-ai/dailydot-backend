const mongoose = require("mongoose");
const Service = require("./models/Service");
require("dotenv").config();

async function checkServices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const services = await Service.find({}).sort({ createdAt: -1 }).limit(5);
        console.log("\n--- Latest 5 Services ---");
        services.forEach(svc => {
            console.log(`ID: ${svc._id}`);
            console.log(`Name: ${svc.name}`);
            console.log(`Images (Array): ${svc.images}`);
            console.log(`Image (Virtual): ${svc.image}`); // Should be populated by virtual
            console.log(`JSON Output: ${JSON.stringify(svc.toJSON(), null, 2)}`);
            console.log("-----------------------");
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

checkServices();
