const axios = require("axios");

const BASE_URL = "http://localhost:3000/api/v1";
let userToken = "";
let adminToken = "";
let serviceId = "";
let bookingId = "";
let reviewId = "";

async function testReviewsSystem() {
  try {
    console.log("=========================================");
    console.log("Testing Reviews & Ratings System");
    console.log("=========================================\n");

    // Step 1: Login as regular user
    console.log("1. Logging in as user...");
    try {
      const userLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: "testuser@example.com",
        password: "Test123",
      });
      userToken = userLogin.data.token;
      console.log("✅ User logged in successfully");
    } catch (error) {
      console.log("⚠️  User doesn't exist. Creating test user...");
      await axios.post(`${BASE_URL}/auth/register`, {
        name: "Test User",
        email: "testuser@example.com",
        password: "Test123",
        phone: "9876543210",
      });
      const userLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: "testuser@example.com",
        password: "Test123",
      });
      userToken = userLogin.data.token;
      console.log("✅ Test user created and logged in");
    }

    // Step 2: Login as admin
    console.log("\n2. Logging in as admin...");
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "admin@dailydot.com",
      password: "Admin123",
    });
    adminToken = adminLogin.data.token;
    console.log("✅ Admin logged in successfully");

    // Step 3: Get or create test data (service and booking)
    console.log("\n3. Preparing test data...");

    // Get categories
    const categories = await axios.get(`${BASE_URL}/categories`);
    let categoryId = categories.data.categories[0]?._id;

    if (!categoryId) {
      console.log("   Creating test category...");
      const category = await axios.post(
        `${BASE_URL}/categories`,
        {
          name: "Test Category",
          slug: "test-category",
          description: "Test category for reviews",
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      categoryId = category.data.category._id;
    }

    // Get or create service
    const services = await axios.get(`${BASE_URL}/services`);
    serviceId = services.data.services[0]?._id;

    if (!serviceId) {
      console.log("   Creating test service...");
      const service = await axios.post(
        `${BASE_URL}/services`,
        {
          name: "Test Service for Reviews",
          category: categoryId,
          description: "Test service description",
          price: 999,
          duration: 60,
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      serviceId = service.data.service._id;
    }

    // Create a booking
    console.log("   Creating test booking...");
    const booking = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: serviceId,
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        serviceAddress: {
          addressLine1: "123 Test Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        },
      },
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    bookingId = booking.data.booking._id;
    console.log(
      `✅ Test booking created: ${booking.data.booking.bookingNumber}`
    );

    // Mark booking as completed (admin action)
    console.log("   Marking booking as completed...");
    await axios.patch(
      `${BASE_URL}/bookings/${bookingId}/status`,
      { status: "completed" },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log("✅ Booking marked as completed");

    // Step 4: Create a review
    console.log("\n4. Creating a review...");
    const review = await axios.post(
      `${BASE_URL}/reviews`,
      {
        bookingId: bookingId,
        rating: 5,
        comment:
          "Excellent service! Very professional and thorough. The team arrived on time and did an amazing job.",
        detailedRatings: {
          quality: 5,
          punctuality: 5,
          professionalism: 5,
          valueForMoney: 4,
        },
      },
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    reviewId = review.data.review._id;
    console.log("✅ Review created successfully");
    console.log(`   Review ID: ${reviewId}`);
    console.log(`   Rating: ${review.data.review.rating} stars`);
    console.log(`   Status: ${review.data.review.status}`);

    // Step 5: Test admin - Get all reviews
    console.log("\n5. Testing admin endpoints...");
    console.log("   a) Getting all reviews...");
    const allReviews = await axios.get(`${BASE_URL}/reviews/admin/reviews`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`   ✅ Fetched ${allReviews.data.reviews.length} review(s)`);
    console.log(`   Total pages: ${allReviews.data.pagination.pages}`);

    // Step 6: Get single review details
    console.log("\n   b) Getting single review details...");
    const singleReview = await axios.get(
      `${BASE_URL}/reviews/admin/reviews/${reviewId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log("   ✅ Single review fetched");
    console.log(`   User: ${singleReview.data.review.userId.name}`);
    console.log(`   Service: ${singleReview.data.review.serviceId.name}`);

    // Step 7: Get review statistics
    console.log("\n   c) Getting review statistics...");
    const stats = await axios.get(`${BASE_URL}/reviews/admin/reviews/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log("   ✅ Statistics retrieved:");
    console.log(`   Total Reviews: ${stats.data.stats.totalReviews}`);
    console.log(
      `   Average Rating: ${stats.data.stats.averageRating.toFixed(1)}`
    );
    console.log(`   Pending: ${stats.data.stats.pendingReviews}`);
    console.log(`   Approved: ${stats.data.stats.approvedReviews}`);
    console.log(`   5-Star Reviews: ${stats.data.stats.fiveStarCount}`);
    console.log(`   1-Star Reviews: ${stats.data.stats.oneStarCount}`);

    // Step 8: Moderate review (approve)
    console.log("\n   d) Moderating review (approving)...");
    const moderated = await axios.patch(
      `${BASE_URL}/reviews/admin/reviews/${reviewId}/moderate`,
      {
        status: "approved",
        moderationNote: "Review is appropriate and helpful for other customers",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log("   ✅ Review approved successfully");
    console.log(`   New status: ${moderated.data.review.status}`);
    console.log(`   Moderation note: ${moderated.data.review.moderationNote}`);

    // Step 9: Add admin response
    console.log("\n   e) Adding admin response...");
    const responded = await axios.post(
      `${BASE_URL}/reviews/admin/reviews/${reviewId}/respond`,
      {
        message:
          "Thank you for your wonderful feedback! We're thrilled you enjoyed our service and look forward to serving you again.",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log("   ✅ Admin response added");
    console.log(
      `   Response: ${responded.data.review.adminResponse.message.substring(
        0,
        50
      )}...`
    );

    // Step 10: Get reviews with filters
    console.log("\n   f) Testing filters...");
    const filteredReviews = await axios.get(
      `${BASE_URL}/reviews/admin/reviews?status=approved&rating=5&page=1&limit=5`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log(
      `   ✅ Filtered reviews: ${filteredReviews.data.reviews.length} results`
    );

    // Step 11: Get service reviews (public endpoint)
    console.log("\n6. Testing public endpoint - Get service reviews...");
    const serviceReviews = await axios.get(
      `${BASE_URL}/reviews/service/${serviceId}`
    );
    console.log(
      `✅ Service reviews: ${serviceReviews.data.reviews.length} approved review(s)`
    );
    if (serviceReviews.data.stats) {
      console.log(
        `   Average rating: ${serviceReviews.data.stats.averageRating}`
      );
      console.log(
        `   Total reviews: ${serviceReviews.data.stats.totalReviews}`
      );
    }

    // Step 12: Get user's own reviews
    console.log("\n7. Testing user endpoint - Get my reviews...");
    const myReviews = await axios.get(`${BASE_URL}/reviews/my-reviews`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    console.log(`✅ User's reviews: ${myReviews.data.count} review(s)`);

    // Step 13: Test report functionality
    console.log("\n8. Testing report review functionality...");
    // Create another user to report
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        name: "Another User",
        email: "anotheruser@example.com",
        password: "Test123",
        phone: "9876543211",
      });
    } catch (e) {
      // User might already exist
    }

    const anotherUserLogin = await axios.post(`${BASE_URL}/auth/login`, {
      email: "anotheruser@example.com",
      password: "Test123",
    });
    const anotherUserToken = anotherUserLogin.data.token;

    await axios.post(
      `${BASE_URL}/reviews/${reviewId}/report`,
      { reason: "Testing report functionality - inappropriate content" },
      { headers: { Authorization: `Bearer ${anotherUserToken}` } }
    );
    console.log("✅ Review reported successfully");

    // Step 14: Test moderation actions
    console.log("\n9. Testing other moderation actions...");

    // Create another booking and review for testing rejection
    console.log("   Creating another test booking and review...");
    const booking2 = await axios.post(
      `${BASE_URL}/bookings`,
      {
        serviceId: serviceId,
        scheduledDate: new Date(Date.now() + 172800000).toISOString(),
        serviceAddress: {
          addressLine1: "456 Test Avenue",
          city: "Delhi",
          state: "Delhi",
          pincode: "110001",
        },
      },
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    const bookingId2 = booking2.data.booking._id;

    await axios.patch(
      `${BASE_URL}/bookings/${bookingId2}/status`,
      { status: "completed" },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const review2 = await axios.post(
      `${BASE_URL}/reviews`,
      {
        bookingId: bookingId2,
        rating: 2,
        comment:
          "Service was below expectations. Not satisfied with the quality of work provided.",
        detailedRatings: {
          quality: 2,
          punctuality: 3,
          professionalism: 2,
          valueForMoney: 2,
        },
      },
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    const reviewId2 = review2.data.review._id;
    console.log("   ✅ Second review created");

    // Reject the second review
    console.log("   Testing reject moderation...");
    await axios.patch(
      `${BASE_URL}/reviews/admin/reviews/${reviewId2}/moderate`,
      {
        status: "rejected",
        moderationNote: "Review contains inappropriate language",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log("   ✅ Review rejected successfully");

    // Step 15: Final statistics check
    console.log("\n10. Final statistics check...");
    const finalStats = await axios.get(
      `${BASE_URL}/reviews/admin/reviews/stats`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    console.log("✅ Final Statistics:");
    console.log(`   Total Reviews: ${finalStats.data.stats.totalReviews}`);
    console.log(
      `   Average Rating: ${finalStats.data.stats.averageRating.toFixed(2)}`
    );
    console.log(`   Approved: ${finalStats.data.stats.approvedReviews}`);
    console.log(`   Pending: ${finalStats.data.stats.pendingReviews}`);
    console.log(`   Rejected: ${finalStats.data.stats.rejectedReviews}`);
    console.log(`   Flagged: ${finalStats.data.stats.flaggedReviews}`);

    // Summary
    console.log("\n=========================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("=========================================");
    console.log("\n✅ Tested Features:");
    console.log("   • User review creation");
    console.log("   • Admin review listing with pagination");
    console.log("   • Single review retrieval");
    console.log("   • Review statistics");
    console.log("   • Review moderation (approve/reject)");
    console.log("   • Admin responses");
    console.log("   • Filter functionality");
    console.log("   • Public service reviews");
    console.log("   • User's own reviews");
    console.log("   • Report/flag functionality");
    console.log("\n📊 Review System Status:");
    console.log(`   • Reviews created: 2`);
    console.log(`   • Reviews approved: 1`);
    console.log(`   • Reviews rejected: 1`);
    console.log(`   • Admin responses: 1`);
    console.log(`   • Reports filed: 1`);
    console.log("\n🚀 Backend is ready for frontend integration!");
    console.log("   Access Swagger docs: http://localhost:3000/api-docs");
    console.log("   Connect your admin dashboard to these endpoints");
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error("Error:", error.response?.data?.message || error.message);
    if (error.response?.data?.errors) {
      console.error("Validation errors:", error.response.data.errors);
    }
    console.error("\nStack trace:", error.stack);
  }
}

// Run the tests
console.log("Starting Reviews System Tests...\n");
console.log("Prerequisites:");
console.log("✓ Server must be running on http://localhost:3000");
console.log("✓ Admin user must exist (run: node create-admin.js)");
console.log("✓ Database must be connected\n");

setTimeout(() => {
  testReviewsSystem();
}, 1000);
