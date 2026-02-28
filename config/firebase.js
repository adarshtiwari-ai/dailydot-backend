const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

if (!admin.apps.length) {
    try {
        // Dynamically resolve the path to firebase-service-account.json
        // Render usually puts secrets in the root or a specified path; user specifies src/
        const serviceAccountPath = path.join(process.cwd(), "src", "firebase-service-account.json");

        if (!fs.existsSync(serviceAccountPath)) {
            // Check root as fallback for local development
            const rootPath = path.join(process.cwd(), "firebase-service-account.json");

            if (!fs.existsSync(rootPath)) {
                console.error("🔥 ERROR: firebase-service-account.json is missing! Please check Render Secret Files configuration.");
                process.exit(1); // Exit if critical for boot
            }

            const serviceAccount = JSON.parse(fs.readFileSync(rootPath, "utf8"));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } else {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }

        console.log("Firebase Admin initialized successfully.");
    } catch (error) {
        console.error("🔥 ERROR: firebase-service-account.json is missing! Please check Render Secret Files configuration.");
        console.error("Details:", error.message);
    }
}

module.exports = admin;
