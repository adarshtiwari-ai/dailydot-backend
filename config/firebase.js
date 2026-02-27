const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, "..", "firebase-service-account.json");

        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized successfully.");
    } catch (error) {
        console.error("Firebase Admin initialization failed:", error);
        // We throw the error so the server doesn't start or we catch it in the caller
        // But for now, let's keep it logged as it's better for debug.
    }
}

module.exports = admin;
