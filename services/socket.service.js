const socketIo = require("socket.io");
const Booking = require("../models/Booking");

let io;

const init = (server) => {
    io = socketIo(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log("New client connected", socket.id);

        // Join a booking room
        socket.on("join_room", (bookingId) => {
            socket.join(bookingId);
            console.log(`Socket ${socket.id} joined room ${bookingId}`);
        });

        // Leave a booking room
        socket.on("leave_room", (bookingId) => {
            socket.leave(bookingId);
            console.log(`Socket ${socket.id} left room ${bookingId}`);
        });

        // Worker updates location
        socket.on("update_location", async (data) => {
            const { bookingId, location } = data;
            // location = { lat: 12.34, lng: 56.78 }

            // Save to DB (optional: throttle this if too frequent)
            // await Booking.findByIdAndUpdate(bookingId, { workerLocation: location });

            // Broadcast to room
            io.to(bookingId).emit("location_update", location);
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = {
    init,
    getIo,
};
