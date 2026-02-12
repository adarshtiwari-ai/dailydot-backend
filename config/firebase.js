const admin = require("firebase-admin");

// Initialize Firebase Admin with credentials
// You should download your service account key from Firebase Console
// and save it as 'firebase-service-account.json' in this directory.
// Or set GOOGLE_APPLICATION_CREDENTIALS environment variable.

let firebaseApp;

try {
    // Check if service account file exists or env var is set
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "../firebase-service-account.json";

    if (serviceAccountPath) {
        // Need to resolve path relative to this file if it's a relative path
        const resolvedPath = serviceAccountPath.startsWith(".")
            ? require("path").resolve(__dirname, serviceAccountPath)
            : serviceAccountPath;

        const serviceAccount = require(resolvedPath);
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized successfully.");
    } else {
        console.warn("Firebase Admin NOT initialized: Missing credentials.");
    }
} catch (error) {
    console.error("Firebase Admin initialization failed:", error);
}

module.exports = admin;
