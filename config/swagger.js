const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DailyDot API",
      version: "1.0.0",
      description: "API for DailyDot on-demand services platform",
      contact: {
        name: "API Support",
        email: "support@dailydot.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token",
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication endpoints",
      },
      {
        name: "Categories",
        description: "Service categories management",
      },
      {
        name: "Services",
        description: "Services management",
      },
      {
        name: "Bookings",
        description: "Booking operations",
      },
      {
        name: "Payments",
        description: "Payment processing",
      },
      {
        name: "Reviews",
        description: "Review and rating operations",
      },
      {
        name: "Users",
        description: "User management",
      },
    ],
  },
  apis: ["./routes/*.js"], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
