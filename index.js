process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

require("dotenv").config();

// Environment Variable Validation
const requiredEnvVars = [
  "OLA_MAPS_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "MONGODB_URI",
  "JWT_SECRET"
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName] || process.env[varName].includes("your_")) {
    console.error(`❌ CRITICAL ERROR: Environment variable ${varName} is missing or has a placeholder value!`);
    process.exit(1);
  }
});

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const http = require("http");
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const connectDB = require("./config/database");
const { init } = require("./services/socket.service");
require("./services/event.service");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const app = express();
app.set('trust proxy', 1); // Trust Render's reverse proxy for rate-limiting
const server = http.createServer(app);

// Initialize Socket.IO
init(server);

// Connect to MongoDB
connectDB();

// 1) GLOBAL MIDDLEWARES
// Set security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Limit requests from same API
const limiter = rateLimit({
  max: 100, // Limit each IP to 100 requests per `window`
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP, please try again in 15 minutes!'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Express 5 req.query property override to allow mongoSanitize to work
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    enumerable: true,
    configurable: true
  });
  next();
});

// Data sanitization against NoSQL query injection
app.use(mongoSanitize({
  replaceWith: '_',
}));

// Data sanitization against XSS
app.use(xss());

// Serving static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:8081', 'http://localhost:5173', 'http://localhost:3000', 'https://dailydot-admin.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// 2) ROUTES
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

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

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
app.use("/api/v1/professionals", require("./routes/professionals"));
app.use("/api/v1/admin", require("./routes/admin"));
app.use("/api/location", require("./routes/location"));
app.use("/api/v1/discounts", require("./routes/discountRoutes"));

// 3) ERROR HANDLING
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log("Socket.IO enabled");
  console.log("CORS enabled for React Native development");
  console.log("✅ Reviews & Ratings system enabled");
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
