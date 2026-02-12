const mongoose = require("mongoose");
const Category = require("./models/Category");
require("dotenv").config();

async function checkCategories() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const categories = await Category.find({}).sort({ createdAt: -1 }).limit(5);
        console.log("\n--- Latest 5 Categories ---");
        categories.forEach(cat => {
            console.log(`ID: ${cat._id}`);
            console.log(`Name: ${cat.name}`);
            console.log(`Image: ${cat.image}`);
            console.log("-----------------------");
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

checkCategories();
