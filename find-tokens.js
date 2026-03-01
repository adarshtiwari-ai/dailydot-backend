require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function findTokens() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const usersWithTokens = await User.find({ pushToken: { $ne: "" } }).select("name phone pushToken");

        if (usersWithTokens.length === 0) {
            console.log("No users found with a push token.");
        } else {
            console.log("Users with Push Tokens:");
            usersWithTokens.forEach(u => {
                console.log(`- ${u.name} (${u.phone}): ${u.pushToken} [ID: ${u._id}]`);
            });
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

findTokens();
