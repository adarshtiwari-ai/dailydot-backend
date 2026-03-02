require("dotenv").config();

console.log("--- DailyDot Environment Test ---");

const checkEnv = (name, value) => {
    if (!value) {
        console.log(`❌ ${name}: NOT FOUND`);
    } else if (value.includes("your_")) {
        console.log(`⚠️  ${name}: FOUND (Placeholder Value)`);
    } else {
        // Mask most of the key for security
        const masked = value.substring(0, 4) + "..." + value.substring(value.length - 4);
        console.log(`✅ ${name}: LOADED (${masked})`);
    }
};

console.log("\n[Backend Keys]");
checkEnv("MONGODB_URI", process.env.MONGODB_URI);
checkEnv("JWT_SECRET", process.env.JWT_SECRET);
checkEnv("OLA_MAPS_API_KEY", process.env.OLA_MAPS_API_KEY);
checkEnv("GOOGLE_MAPS_API_KEY", process.env.GOOGLE_MAPS_API_KEY);

console.log("\n[Frontend Keys (must use EXPO_PUBLIC_ for React Native)]");
checkEnv("EXPO_PUBLIC_OLA_MAPS_API_KEY", process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY);
checkEnv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

console.log("\n---------------------------------");
if (Object.values(process.env).some(v => v && v.includes("your_"))) {
    console.log("RESULT: Please replace placeholders with real keys in your .env files.");
} else {
    console.log("RESULT: Environment looks good!");
}
