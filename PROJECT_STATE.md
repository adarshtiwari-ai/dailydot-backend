# PROJECT_STATE.md - DailyDot Project Snapshot
**Date:** March 2, 2026
**Role:** Senior Full-Stack Architect

## 1. Database Schema (Mongoose Models)

### Booking Model
*   **Path:** `backend/models/Booking.js`
*   **Key Fields:**
    *   `userId`: Reference to `User` model.
    *   `items`: Array of items, each containing `serviceId`, `name`, `price`, `quantity`, and `category`.
    *   **`assignedPro`**: [RECENT CHANGE] Reference to `Professional` model. Replaced the legacy `workerId` field.
    *   `status`: enum [`pending`, `confirmed`, `assigned`, `on_the_way`, `in_progress`, `completed`, `cancelled`].
    *   `totalAmount`: Final booking price.
    *   `scheduledDate` & `scheduledTime`: Booking schedule.
    *   `serviceAddress`: Detailed object for service location and site contact.

### Professional Model (Pro Platform)
*   **Path:** `backend/models/Professional.js`
*   **Key Fields:** `name`, `phone`, `averageRating`, `totalRatings`, `isActive`.

### User Model (Customer Platform)
*   **Path:** `backend/models/User.js`
*   **Key Fields:** `name`, `email`, `phone`, `googleId`, `appleId`, `pushToken`, `addresses`.

---

## 2. Backend Architecture

### Controller-Service Pattern
The project has migrated to a decoupled architecture to improve maintainability and response times.

#### Booking Controller (`bookingController.js`)
*   **Secure Price Calculation:** The controller now fetches service definitions directly from the database using the provided `serviceId`. It ignores client-provided prices to prevent tampering.
*   **Server-Side Logic:** `totalAmount` is calculated server-side based on the latest service pricing.
*   **Session-Based Identity:** Customer `name` and `phone` are retrieved from the authenticated user context (`req.user`) if not provided, ensuring data integrity.

#### Event-Driven Notifications (`event.service.js`)
*   **Pattern:** Uses Node.js `EventEmitter` to decouple notification delivery from core business logic.
*   **Async Processing:** When a booking is created or updated, events are emitted to an internal Hub.
*   **Listeners:** Dedicated listeners handle high-latency operations:
    *   `BOOKING_CREATED`: Triggers Email, SMS (Twilio), and Push Notifications (Expo).
    *   `BOOKING_STATUS_UPDATED`: Sends real-time Push updates (e.g., "Confirmed", "Completed") to the customer.
    *   `WORKER_ASSIGNED`: Notifies the customer of their assigned professional.

---

## 3. Frontend API Contract (Bookings)

### `POST /api/v1/bookings` (DailyDot V2 App)

The payload has been significantly lean-weighted for security and efficiency.

**Request Payload Example:**
```json
{
  "items": [
    {
      "serviceId": "65e...",
      "quantity": 1
    }
  ],
  "scheduledDate": "2026-03-02T...",
  "scheduledTime": "12:00 PM",
  "serviceAddress": {
    "addressLine1": "...",
    "city": "...",
    "state": "...",
    "pincode": "..."
  },
  "phone": "9876543210",
  "notes": "Booking Name: John Doe",
  "paymentMethod": "cod"
}
```

**Key API Contract Updates:**
*   **REMOVED:** `price` and `name` from items (calculated server-side).
*   **REMOVED:** `totalAmount` from root (calculated server-side).
*   **REMOVED:** Customer `name` from root (retrieved from server session).

---

## 4. Next Immediate Steps

1.  **Razorpay Digital Payments Integration:** Move beyond "Cash on Delivery" by implementing a secure digital payment gateway.
2.  **Automated Worker Assignment Algorithm:** Replace manual assignment logic with an automated system that considers professional proximity, availability, and rating.
3.  **Real-Time Tracking Enhancement:** Implementing Socket.io for live professional location updates on the tracking screen.

---
**Status:** Architectural Refactor Complete ✅
**Architect:** Antigravity (Senior Full-Stack Architect)
