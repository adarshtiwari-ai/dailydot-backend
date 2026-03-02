const EventEmitter = require('events');
const notificationService = require('./notification.service');
const { sendPushNotification } = require('../utils/pushService');

/**
 * Event Hub for decoupled notification logic.
 * Improves API response times by handling notifications asynchronously.
 */
class BookingEventHub extends EventEmitter { }

const eventHub = new BookingEventHub();

// --- Event Listeners ---

// Handle new booking notifications
eventHub.on('BOOKING_CREATED', async (data) => {
    try {
        const { booking, user } = data;
        console.log(`[EventHub] BOOKING_CREATED received for #${booking.bookingNumber}`);

        // Centralized notification call (Email, SMS, Push)
        await notificationService.sendNotification("booking_confirmation", {
            booking,
            user
        });
    } catch (error) {
        console.error("[EventHub] Error in BOOKING_CREATED listener:", error);
    }
});

// Handle status changes (Confirmed, Completed)
eventHub.on('BOOKING_STATUS_UPDATED', async (data) => {
    try {
        const { booking, status } = data;
        console.log(`[EventHub] BOOKING_STATUS_UPDATED (${status}) received for #${booking.bookingNumber}`);

        const userId = booking.userId._id || booking.userId;

        if (status === "confirmed") {
            await sendPushNotification(
                userId,
                "Booking Confirmed! 🎉",
                "Your professional has been assigned and is on the way.",
                { screen: "History", bookingId: booking._id.toString() }
            );
        } else if (status === "completed") {
            await sendPushNotification(
                userId,
                "Service Complete ✅",
                "Please tap here to rate your professional and view your receipt.",
                { screen: "History", bookingId: booking._id.toString() }
            );
        }
    } catch (error) {
        console.error("[EventHub] Error in BOOKING_STATUS_UPDATED listener:", error);
    }
});

// Handle worker assignment notifications
eventHub.on('WORKER_ASSIGNED', async (data) => {
    try {
        const { booking, workerName } = data;
        console.log(`[EventHub] WORKER_ASSIGNED received for #${booking.bookingNumber}`);

        const userId = booking.userId._id || booking.userId;

        await notificationService.sendPushNotification(
            userId,
            "Worker Assigned 👷",
            `${workerName} has been assigned to your booking!`,
            { bookingId: booking._id.toString(), type: "worker_assigned" }
        );
    } catch (error) {
        console.error("[EventHub] Error in WORKER_ASSIGNED listener:", error);
    }
});

module.exports = eventHub;
