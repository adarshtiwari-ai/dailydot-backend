const mongoose = require("mongoose");
const Category = require("./models/Category");
const Service = require("./models/Service");
require("dotenv").config();

async function debugDeletion() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // Create a dummy category to test deletion
        const testCategory = await Category.create({
            name: "Delete Test " + Date.now(),
            slug: "delete-test-" + Date.now(),
            description: "Temporary category for deletion test"
        });
        console.log(`Created test category: ${testCategory.name} (${testCategory._id})`);

        // Try to delete it using the same method as the route
        console.log("Attempting to delete...");
        const deleted = await Category.findByIdAndDelete(testCategory._id);

        if (deleted) {
            console.log("Deletion SUCCESS detected by Mongoose");
        } else {
            console.log("Deletion FAILED - Document not found or not deleted");
        }

        // Verify it's gone
        const check = await Category.findById(testCategory._id);
        console.log(`Verification check: ${check ? "STILL EXISTS" : "GONE"}`);

    } catch (error) {
        console.error("Deletion Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

debugDeletion();
