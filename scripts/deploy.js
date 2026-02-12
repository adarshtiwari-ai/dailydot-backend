// Deployment preparation script
const fs = require("fs");
const path = require("path");

console.log("Preparing for deployment...");

// Check required environment variables
const requiredEnvVars = ["MONGODB_URI", "JWT_SECRET", "NODE_ENV"];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    "Missing required environment variables:",
    missingVars.join(", ")
  );
  process.exit(1);
}

console.log("✓ Environment variables checked");
console.log("✓ Ready for deployment");
