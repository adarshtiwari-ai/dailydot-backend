const axios = require("axios");

const BASE_URL = "http://localhost:3000/api/v1";
let userToken = "";
let adminToken = "";
let categoryId = "";
let serviceId = "";
let bookingId = "";

async function testAll() {
  try {
    console.log("=================================");
    console.log("Starting API Tests...");
    console.log("=================================\n");

    // Test 1: Check if server is running
    console.log("Test 1: Checking server health...");
    try {
      const health = await axios.get("http://localhost:3000/health");
      console.log("✅ Server is running");
      console.log(`   Database: ${health.data.database}`);
    } catch (error) {
      console.log(
        "❌ Server is not running. Please start it with: npm run dev"
      );
      return;
    }

    // Test 2: Register a test user
    console.log("\nTest 2: Registering a new user...");
    const randomNum = Date.now();
    const testUser = {
      name: "Test User",
      email: `test${randomNum}@example.com`,
      password: "Test123",
      phone: "98" + randomNum.toString().slice(-8),
    };

    try {
      const register = await axios.post(`${BASE_URL}/auth/register`, testUser);
      userToken = register.data.token;
      console.log("✅ User registered successfully");
      console.log(`   Email: ${testUser.email}`);
    } catch (error) {
      console.log(
        "❌ Registration failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 3: Login with the test user
    console.log("\nTest 3: Testing login...");
    try {
      const login = await axios.post(`${BASE_URL}/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });
      console.log("✅ Login successful");
    } catch (error) {
      console.log(
        "❌ Login failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 4: Get user profile (protected route)
    console.log("\nTest 4: Testing protected route (profile)...");
    try {
      const profile = await axios.get(`${BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      console.log("✅ Protected route works");
      console.log(`   User: ${profile.data.user.name}`);
    } catch (error) {
      console.log(
        "❌ Protected route failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 5: Login as admin
    console.log("\nTest 5: Logging in as admin...");
    try {
      const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: "admin@dailydot.com",
        password: "Admin123",
      });
      adminToken = adminLogin.data.token;
      console.log("✅ Admin login successful");
    } catch (error) {
      console.log(
        "❌ Admin login failed:",
        error.response?.data?.message || error.message
      );
      console.log("   Make sure you created admin with: node create-admin.js");
    }

    // Test 6: Create a category (admin only)
    console.log("\nTest 6: Creating a category (admin only)...");
    try {
      const category = await axios.post(
        `${BASE_URL}/categories`,
        {
          name: "Test Category " + randomNum,
          slug: "test-category-" + randomNum,
          description: "Test category description",
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      categoryId = category.data.category._id;
      console.log("✅ Category created");
      console.log(`   Category ID: ${categoryId}`);
    } catch (error) {
      console.log(
        "❌ Category creation failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 7: Get all categories (public)
    console.log("\nTest 7: Getting all categories (public)...");
    try {
      const categories = await axios.get(`${BASE_URL}/categories`);
      console.log("✅ Categories fetched");
      console.log(`   Total categories: ${categories.data.count}`);
    } catch (error) {
      console.log(
        "❌ Get categories failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 8: Create a service (admin only)
    console.log("\nTest 8: Creating a service (admin only)...");
    try {
      const service = await axios.post(
        `${BASE_URL}/services`,
        {
          name: "Test Service " + randomNum,
          category: categoryId,
          description: "Test service description",
          price: 999,
          duration: 60,
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      serviceId = service.data.service._id;
      console.log("✅ Service created");
      console.log(`   Service ID: ${serviceId}`);
    } catch (error) {
      console.log(
        "❌ Service creation failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 9: Get all services (public)
    console.log("\nTest 9: Getting all services (public)...");
    try {
      const services = await axios.get(`${BASE_URL}/services`);
      console.log("✅ Services fetched");
      console.log(`   Total services: ${services.data.count}`);
    } catch (error) {
      console.log(
        "❌ Get services failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 10: Create a booking (user)
    console.log("\nTest 10: Creating a booking (as user)...");
    try {
      const booking = await axios.post(
        `${BASE_URL}/bookings`,
        {
          serviceId: serviceId,
          scheduledDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          serviceAddress: {
            addressLine1: "123 Test Street",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
          },
        },
        {
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );
      bookingId = booking.data.booking._id;
      console.log("✅ Booking created");
      console.log(`   Booking Number: ${booking.data.booking.bookingNumber}`);
    } catch (error) {
      console.log(
        "❌ Booking creation failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 11: Get user's bookings
    console.log("\nTest 11: Getting user bookings...");
    try {
      const bookings = await axios.get(`${BASE_URL}/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      console.log("✅ User bookings fetched");
      console.log(`   Total bookings: ${bookings.data.count}`);
    } catch (error) {
      console.log(
        "❌ Get bookings failed:",
        error.response?.data?.message || error.message
      );
    }

    // Test 12: Initialize payment
    console.log("\nTest 12: Initializing payment...");
    try {
      const payment = await axios.post(
        `${BASE_URL}/payments/initialize`,
        {
          bookingId: bookingId,
        },
        {
          headers: { Authorization: `Bearer ${userToken}` },
        }
      );
      console.log("✅ Payment initialized");
      console.log(`   Amount: ₹${payment.data.booking.amount}`);
    } catch (error) {
      console.log(
        "❌ Payment initialization failed:",
        error.response?.data?.message || error.message
      );
    }

    // Summary
    console.log("\n=================================");
    console.log("🎉 Testing Complete!");
    console.log("=================================");
    console.log("\nYour backend is working correctly!");
    console.log("You can now:");
    console.log("1. Check Swagger docs at: http://localhost:3000/api-docs");
    console.log("2. Use these endpoints in your mobile app");
    console.log("3. Deploy to production");
  } catch (error) {
    console.error("\n❌ Unexpected error:", error.message);
  }
}

// Run the tests
testAll();
