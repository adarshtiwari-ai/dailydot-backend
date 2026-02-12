const axios = require("axios");

async function fullRazorpayTest() {
  try {
    console.log("Complete Razorpay Test\n");
    console.log("======================\n");

    // Try to create user (skip if exists)
    try {
      await axios.post("http://localhost:3000/api/v1/auth/register", {
        name: "Test User",
        email: "testuser@example.com",
        password: "Test123",
        phone: "9876543211",
      });
      console.log("✅ Test user created");
    } catch (e) {
      console.log("ℹ️  Test user already exists");
    }

    // Login
    console.log("\n1. Logging in...");
    const login = await axios.post("http://localhost:3000/api/v1/auth/login", {
      email: "testuser@example.com",
      password: "Test123",
    });
    const token = login.data.token;
    console.log("✅ Login successful");

    // Login as admin to create category and service
    console.log("\n2. Setting up test data as admin...");
    const adminLogin = await axios.post(
      "http://localhost:3000/api/v1/auth/login",
      {
        email: "admin@dailydot.com",
        password: "Admin123",
      }
    );
    const adminToken = adminLogin.data.token;

    // Create category
    let categoryId;
    try {
      const category = await axios.post(
        "http://localhost:3000/api/v1/categories",
        {
          name: "Test Category",
          slug: "test-category",
          description: "Test category for payment",
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      categoryId = category.data.category._id;
    } catch (e) {
      // Get existing category
      const categories = await axios.get(
        "http://localhost:3000/api/v1/categories"
      );
      categoryId = categories.data.categories[0]._id;
    }
    console.log("✅ Category ready:", categoryId);

    // Create service
    const service = await axios.post(
      "http://localhost:3000/api/v1/services",
      {
        name: "Test Service for Razorpay",
        category: categoryId,
        description: "Test service",
        price: 999,
        duration: 60,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const serviceId = service.data.service._id;
    console.log("✅ Service created:", serviceId);

    // Create booking as regular user
    console.log("\n3. Creating booking...");
    const booking = await axios.post(
      "http://localhost:3000/api/v1/bookings",
      {
        serviceId: serviceId,
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        serviceAddress: {
          addressLine1: "Test Address",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const bookingId = booking.data.booking._id;
    console.log("✅ Booking created:", bookingId);
    console.log("   Amount: ₹" + booking.data.booking.totalAmount);

    // Create Razorpay order
    console.log("\n4. Creating Razorpay order...");
    const order = await axios.post(
      "http://localhost:3000/api/v1/payments/create-order",
      { bookingId: bookingId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("\n✅ RAZORPAY INTEGRATION SUCCESSFUL!");
    console.log("=====================================");
    console.log("Order Details:");
    console.log(`  Order ID: ${order.data.order.id}`);
    console.log(`  Amount: ₹${order.data.order.amount / 100}`);
    console.log(`  Currency: ${order.data.order.currency}`);
    console.log(`  Razorpay Key: ${order.data.order.key}`);
    console.log("\nYou can now use this order ID in your frontend!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.log("\nMake sure all routes are properly configured");
    }
  }
}

fullRazorpayTest();
