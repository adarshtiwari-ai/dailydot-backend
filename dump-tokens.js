require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const fs = require("fs");

async function dumpTokens() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const users = await User.find({ pushToken: { $exists: true, $ne: "" } }).select("name pushToken");
        fs.writeFileSync("tokens_dump.txt", JSON.stringify(users, null, 2));
        console.log(`Dumped ${users.length} tokens to tokens_dump.txt`);
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

dumpTokens();
