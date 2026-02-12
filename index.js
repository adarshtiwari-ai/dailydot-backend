require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const http = require("http");
const connectDB = require("./config/database");
const { init } = require("./services/socket.service");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");


const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
init(server);

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ✅ UPDATED CORS Configuration for React Native
// ✅ UPDATED CORS Configuration (Status: Allow All for Cloud)
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ✅ Additional CORS headers for preflight requests
// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "DailyDot API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      categories: "/api/v1/categories",
      services: "/api/v1/services",
      bookings: "/api/v1/bookings",
      payments: "/api/v1/payments",
      reviews: "/api/v1/reviews",
    },
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1/users", require("./routes/users"));
app.use("/api/v1/categories", require("./routes/categories"));
app.use("/api/v1/services", require("./routes/services"));
app.use("/api/v1/bookings", require("./routes/bookings"));
app.use("/api/v1/payments", require("./routes/payments"));
app.use("/api/v1/reviews", require("./routes/reviews"));
app.use("/api/v1/analytics", require("./routes/analytics"));
app.use("/api/v1/settings", require("./routes/settings"));
app.use("/api/v1/banners", require("./routes/banner"));
app.use("/api/v1/quick-fixes", require("./routes/quickFix"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 3000;

// Use server.listen instead of app.listen for Socket.IO
server.listen(PORT, "0.0.0.0", () => {
  // ✅ Listen on all interfaces
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log("Socket.IO enabled");
  console.log("CORS enabled for React Native development");
  console.log("✅ Reviews & Ratings system enabled");
});
