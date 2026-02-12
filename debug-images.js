const mongoose = require("mongoose");
const Category = require("./models/Category");
require("dotenv").config();

async function checkCategories() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const categories = await Category.find({}).sort({ createdAt: -1 }).limit(10);
        console.log("\n--- Latest 10 Categories ---");
        categories.forEach(cat => {
            console.log(`ID: ${cat._id}`);
            console.log(`Name: ${cat.name}`);
            console.log(`Created: ${cat.createdAt}`);
            console.log(`Image (Raw): ${cat.image}`);
            console.log(`JSON Output: ${JSON.stringify(cat.toJSON(), null, 2)}`);
            console.log("-----------------------");
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

checkCategories();
