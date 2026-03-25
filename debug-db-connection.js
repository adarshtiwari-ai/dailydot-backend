require("dotenv").config();
const mongoose = require("mongoose");

const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoURI) {
  console.error("❌ ERROR: MONGODB_URI is not defined in your environment variables.");
  process.exit(1);
}

console.log("--- MongoDB Connection Test ---");
console.log(`Connecting to: ${mongoURI.replace(/:([^:@]{1,})@/, ":****@")}`); // Mask password

const options = {
  serverSelectionTimeoutMS: 5000, // 5 seconds
  connectTimeoutMS: 10000,       // 10 seconds
  socketTimeoutMS: 45000,        // 45 seconds
};

async function runTest() {
  try {
    console.log("1. Attempting to connect...");
    await mongoose.connect(mongoURI, options);
    console.log("✅ SUCCESS: Connected to MongoDB Atlas.");

    console.log("2. Verifying database state...");
    const state = mongoose.connection.readyState;
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    console.log(`Current state: ${states[state]} (${state})`);

    console.log("3. Running 'ping' command...");
    const admin = mongoose.connection.db.admin();
    const result = await admin.ping();
    console.log("✅ PING RESULT:", result);

    console.log("4. Attempting a simple find() on 'users' collection...");
    const userCount = await mongoose.connection.db.collection("users").countDocuments();
    console.log(`✅ READ SUCCESS: Found ${userCount} users in the database.`);

    console.log("\n--- TEST COMPLETED SUCCESSFULLY ---");
  } catch (error) {
    console.error("\n❌ TEST FAILED");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }

    if (error.name === "MongooseServerSelectionError") {
      console.log("\n💡 ANALYSIS: This usually means MongoDB Atlas is blocking your IP.");
      console.log("Action Required: Go to MongoDB Atlas -> Network Access and add 0.0.0.0/0.");
    }

    if (error.message.includes("ETIMEDOUT")) {
      console.log("\n💡 ANALYSIS: Network timeout. Check if Render's firewall or Atlas is dropping the connection.");
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTest();
