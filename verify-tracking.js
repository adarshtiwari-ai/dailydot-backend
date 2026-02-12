
const io = require("socket.io-client");
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("./models/User");
const Service = require("./models/Service");
const connectDB = require("./config/database");

const API_URL = "http://localhost:3000/api/v1";
const SOCKET_URL = "http://localhost:3000";

let socket;
let authToken;
let bookingId;
let serviceId;

const runVerification = async () => {
    try {
        console.log("🚀 Starting Live Tracking Verification...");

        // 1. Database Connection
        await connectDB();
        console.log("✅ Database connected");

        // 2. Login/Setup User
        // We'll create a temp user or find one
        let user = await User.findOne({ email: "verifier@test.com" });
        if (!user) {
            user = await User.create({
                name: "Verifier",
                email: "verifier@test.com",
                password: "password123",
                phone: "9999999999"
            });
        }

        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "verifier@test.com",
            password: "password123"
        });
        authToken = loginRes.data.token;
        console.log("✅ User logged in");

        // 3. Get a Service
        const service = await Service.findOne();
        if (!service) {
            throw new Error("No services found in DB. Please seed data.");
        }
        serviceId = service._id;

        // 4. Create Booking
        const bookingRes = await axios.post(
            `${API_URL}/bookings`,
            {
                serviceId: serviceId,
                scheduledDate: new Date().toISOString(),
                serviceAddress: {
                    addressLine1: "123 Test St",
                    city: "Test City",
                    state: "Test State",
                    pincode: "123456"
                }
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        bookingId = bookingRes.data.booking._id;
        console.log(`✅ Booking created: ${bookingId}`);

        // 5. Connect Socket
        socket = io(SOCKET_URL);

        await new Promise((resolve) => {
            socket.on("connect", () => {
                console.log("✅ Socket connected");
                socket.emit("join_room", bookingId);
                console.log(`✅ Joined room: ${bookingId}`);
                resolve();
            });
        });

        // 6. Listen for Updates
        const locationUpdatePromise = new Promise((resolve, reject) => {
            socket.on("location_update", (data) => {
                console.log("✅ Received location update via Socket:", data);
                if (data.lat === 28.123 && data.lng === 77.456) {
                    resolve();
                } else {
                    reject(new Error("Incorrect location data received"));
                }
            });

            // Timeout if no event received
            setTimeout(() => reject(new Error("Socket timeout")), 5000);
        });

        // 7. Assign Worker (Simulated)
        await axios.patch(
            `${API_URL}/bookings/${bookingId}/assign-worker`,
            {},
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log("✅ Worker assigned");

        // 8. Update Location
        console.log("📍 Updating location...");
        await axios.patch(
            `${API_URL}/bookings/${bookingId}/update-location`,
            { lat: 28.123, lng: 77.456 },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );

        // Wait for socket
        await locationUpdatePromise;
        console.log("🎉 Verification Successful! Real-time tracking is working.");

    } catch (error) {
        console.error("❌ Verification Failed:", error.message);
        if (error.response) {
            console.error("API Error Data:", error.response.data);
        }
    } finally {
        if (socket) socket.disconnect();
        mongoose.disconnect();
        process.exit(0);
    }
};

runVerification();
