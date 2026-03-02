# Technical Audit Report: DailyDot Backend
**Role:** Senior Backend Architect Audit  
**Date:** March 02, 2026  
**Project:** DailyDot On-Demand Home Services App

---

## 1. Project Architecture & Tech Stack
The backend is a robust Node.js application built with the Express.js framework, following a monolithic architecture with some service-oriented patterns for external integrations.

- **Runtime:** Node.js (CommonJS modules)
- **Framework:** Express.js (v5.1.0)
- **Database:** MongoDB with Mongoose ODM (v8.18.0)
- **Real-time Communication:** Socket.IO for live service tracking.
- **Security:** JWT-based authentication, Firebase Admin SDK for mobile auth, Helmet for header security, and CORS for cross-origin management.
- **Documentation:** OpenAPI/Swagger (swagger-ui-express).

---

## 2. Database Schema Map (Mongoose Models)

### **User Model (`User.js`)**
Stores both customers and providers with role-based access control.
- **Fields:** `deviceId`, `googleId`, `appleId`, `name`, `email` (sparse), `password` (hidden), `phone` (unique/sparse), `fcmToken`, `pushToken`, `role` (user/provider/admin), `addresses` (embedded array).
- **Key Feature:** Support for multiple authentication providers and hardware device identifiers.

### **Booking Model (`Booking.js`)**
The core transactional model of the application.
- **Fields:** `userId`, `items` (array of services), `name/phone` (contact details), `bookingNumber` (auto-generated), `scheduledDate/Time`, `status`, `totalAmount`, `assignedPro` (ref: Professional), `workerLocation` (real-time), `otp`, `paymentStatus/Method`.
- **Enums:** `status` (pending, confirmed, assigned, on_the_way, in_progress, completed, cancelled).

### **Professional Model (`Professional.js`)**
Represents the service providers (workers).
- **Fields:** `name`, `phone` (unique), `averageRating`, `totalRatings`, `isActive`.
- **Relationship:** Linked to Bookings via `assignedPro`.

### **Service & Category Models (`Service.js`, `Category.js`)**
Define the marketplace offerings.
- **Service:** `name`, `category`, `description`, `price`, `duration`, `images`, `isTopBooked`, `tagId`.
- **Category:** `name`, `slug`, `icon`, `image`, `tags` (embedded array for sub-grouping).

---

## 3. API Routing & Data Flows

The application uses an "Action-based Routing" pattern where much of the business logic is handled within the route definitions (Fat Routes) or delegated to specialized controllers for complex flows.

### **Primary Endpoints:**
- **Auth (`/api/v1/auth`):** Handled by `authController.js`. Supports Firebase login, Social login (Google/Apple), and legacy Email/Password flows.
- **Bookings (`/api/v1/bookings`):**
    - `POST /`: Creates booking, calculates totals, triggers notifications.
    - `PATCH /:id/status`: Admin-only status updates, handles Professional assignment.
    - `PATCH /:id/rate`: Handles two-way rating (Service & Professional).
- **Services (`/api/v1/services`):** Public retrieval with complex filtering (price, category, grouping by tags).
- **Users (`/api/v1/users`):** Profile management, multi-address support, and push token synchronization.

---

## 4. Third-Party Integrations & Services

### **Push Notifications (Expo)**
- **Implementation:** `utils/pushService.js` and `services/notification.service.js`.
- **Logic:** Uses `expo-server-sdk`. Includes a proactive **Stale Token Pruning** mechanism that detects `DeviceNotRegistered` errors and clears the invalid token from the DB.

### **Payments (Razorpay)**
- **Implementation:** `config/razorpay.js` and `routes/payments.js`.
- **Current Flow:** Supports Razorpay order creation. However, the booking flow currently has a heavy fallback/hardcode for **Cash on Delivery (COD)**.

### **Image Management (Cloudinary)**
- **Implementation:** `config/cloudinary.js` and `middleware/upload.js` (Multer).
- **Usage:** Admin-uploaded images for Categories and Services are transformed and stored in Cloudinary.

### **Communication (Twilio & SendGrid)**
- **SMS:** `services/sms.service.js` (Twilio) for booking confirmations.
- **Email:** `services/email.service.js` (SendGrid/Nodemailer) for transactional emails.

---

## 5. Security & Middleware

- **Authentication:** `middleware/auth.js` verifies JWTs. Decoded `userId` is used to populate `req.user`.
- **Authorization:** `adminAuth` middleware restricts sensitive routes (banner management, service creation, user list).
- **Input Validation:** Extensive use of `express-validator` across all POST/PUT/PATCH routes to ensure data integrity.
- **Database Security:** Improper indices (like `phone_1` on the User collection) are proactively dropped during DB initialization (`config/database.js`) to prevent duplicate key errors during social login.

---

## 6. Technical Debt & Missing Pieces

### **Code Organization (Architectural Debt)**
- **Fat Routes:** Routes like `bookings.js` contain hundreds of lines of business logic (notification triggering, professional assignment, math). This should be moved to a dedicated `BookingController` or `BookingService`.
- **Redundant Worker Fields:** The `Booking` model has both `workerId` (ref: User) and `assignedPro` (ref: Professional). This causes confusion in the "Assign Worker" vs "Confirm Booking" logic.

### **Logic & Error Handling**
- **Hardcoded Payment Logic:** COD is forced in several places (`paymentMethod: "cod"`), bypassing the Razorpay integration for core flows.
- **Notification Consistency:** Notification calls are scattered across route files rather than being centralized in a single event-driven system or service hook.
- **Error Silencing:** Some `try-catch` blocks in `notification.service.js` log errors but don't provide fallback/retry mechanisms.

### **Missing Features for Production**
- **Cancellation Policy:** The `/:id/cancel` route is basic; it lacks logic for refunds or late-cancellation fees.
- **Automated Worker Assignment:** Currently, professionals are assigned manually via an admin status update. A matching algorithm or "Bid" system is missing.
- **Unit/Integration Tests:** While several `test-*.js` scripts exist in the root, there is no standardized testing framework (like Jest or Mocha) integrated into the CI/CD pipeline.

---

**Report Summary:** The DailyDot backend is feature-complete for an MVP but requires architectural refactoring (Slimmer Routes) and a more robust payment/assignment logic before scaling to high-traffic production environments.
