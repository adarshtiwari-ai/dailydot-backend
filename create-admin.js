require("dotenv").config();
const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");
const User = require("./models/User");

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const hashedPassword = await bcryptjs.hash("Admin123", 12);

    const admin = await User.findOneAndUpdate(
      { email: "admin@dailydot.com" },
      {
        name: "Admin",
        email: "admin@dailydot.com",
        password: hashedPassword,
        phone: "9999999999",
        role: "admin",
        emailVerified: true,
      },
      { upsert: true, new: true }
    );

    console.log("Admin created successfully!");
    console.log("Email: admin@dailydot.com");
    console.log("Password: Admin123");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createAdmin();
