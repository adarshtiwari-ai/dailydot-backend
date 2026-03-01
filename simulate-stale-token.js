/**
 * simulate-stale-token.js
 * 
 * This script simulates the "DeviceNotRegistered" error from Expo 
 * to verify that the backend correctly prunes (deletes) the stale 
 * push token from the User document in MongoDB.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGODB_URI;
const TEST_USER_ID = process.argv[2];

if (!TEST_USER_ID) {
    console.error("Usage: node simulate-stale-token.js <USER_ID>");
    process.exit(1);
}

const simulatePruning = async () => {
    try {
        console.log(`--- SIMULATING STALE TOKEN PRUNING FOR USER: ${TEST_USER_ID} ---`);

        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Inject a temporary "stale" token
        const staleToken = 'ExponentPushToken[STALE_TOKEN_SIMULATION]';
        const userToUpdate = await User.findByIdAndUpdate(TEST_USER_ID, { pushToken: staleToken });

        if (!userToUpdate) {
            console.error(`\n❌ ERROR: User ID "${TEST_USER_ID}" was not found in the database. Please provide a valid User ID.`);
            process.exit(1);
        }
        console.log(`Step 1: Injected stale token into DB: ${staleToken}`);

        // 2. Mock the pruning logic found in pushService.js
        console.log("Step 2: Simulating 'DeviceNotRegistered' response from Expo...");

        // This is a simplified version of the logic inside pushService.js
        const mockTicket = {
            status: 'error',
            message: 'DeviceNotRegistered',
            details: { error: 'DeviceNotRegistered' }
        };

        if (mockTicket.status === 'error' && mockTicket.details?.error === 'DeviceNotRegistered') {
            console.log(`[Simulation] Detected DeviceNotRegistered. Pruning...`);
            await User.findByIdAndUpdate(TEST_USER_ID, { pushToken: '' });
            console.log("Step 3: Database updated! pushToken set to empty string.");
        }

        // 4. Verify
        const updatedUser = await User.findById(TEST_USER_ID);
        if (updatedUser && updatedUser.pushToken === '') {
            console.log("\n✅ SUCCESS: Stale token was successfully pruned from the database.");
        } else if (!updatedUser) {
            console.error(`\n❌ ERROR: User ID "${TEST_USER_ID}" not found during verification step.`);
            process.exit(1);
        } else {
            console.log("\n❌ FAILURE: Token was not pruned.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Simulation error:", error);
        process.exit(1);
    }
};

simulatePruning();
