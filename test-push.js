require("dotenv").config();
const { sendPushNotification } = require("./utils/pushService");
const mongoose = require("mongoose");
const connectDB = require("./config/database");

async function testPush() {
    const userId = process.argv[2];

    if (!userId) {
        console.error("Usage: node test-push.js <userId> [title] [body]");
        process.exit(1);
    }

    const title = process.argv[3] || "Test Notification 🔔";
    const body = process.argv[4] || "This is a test notification from the DailyDot backend.";

    try {
        console.log("Connecting to database...");
        await connectDB();

        console.log(`Attempting to send notification to user: ${userId}`);
        const result = await sendPushNotification(userId, title, body, {
            type: "test",
            timestamp: new Date().toISOString()
        });

        console.log("Result:", result);
    } catch (error) {
        console.error("Test Push Error:", error);
    } finally {
        mongoose.connection.close();
    }
}

testPush();
