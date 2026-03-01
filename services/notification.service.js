const emailService = require("./email.service");
const smsService = require("./sms.service");
const { sendPushNotification } = require("../utils/pushService");
const User = require("../models/User");

class NotificationService {
  // Send Push Notification
  async sendPushNotification(userId, title, body, data = {}) {
    try {
      const tickets = await sendPushNotification(userId, title, body, data);
      return { success: true, tickets };
    } catch (error) {
      console.error("Error sending push notification via Expo:", error);
      return { success: false, error: error.message };
    }
  }

  // Send both email and SMS and Push
  async sendNotification(type, data) {
    const { user, booking } = data;

    // Robust data extraction with fallbacks
    const name = user?.name || booking?.name || "Customer";
    const phone = user?.phone || booking?.phone;
    const email = user?.email || booking?.email;
    const userId = user?._id || booking?.userId;

    const safeUser = { ...user, name, phone, email, _id: userId };
    const results = {};

    try {
      switch (type) {
        case "welcome":
          results.email = await emailService.sendWelcomeEmail(safeUser);
          break;
        case "booking_confirmation":
          results.email = await emailService.sendBookingConfirmation(
            booking,
            safeUser
          );
          if (phone) {
            results.sms = await smsService.sendBookingConfirmation(
              phone,
              booking.bookingNumber
            );
          }
          if (userId) {
            results.push = await this.sendPushNotification(
              userId,
              "Booking Confirmed! ✅",
              `Your booking #${booking.bookingNumber} has been confirmed.`,
              { bookingId: booking._id.toString(), type: "booking_confirmation" }
            );
          }
          break;
        case "payment_success":
          results.email = await emailService.sendPaymentSuccess(booking, safeUser);
          if (phone) {
            results.sms = await smsService.sendPaymentSuccess(
              phone,
              booking.totalAmount
            );
          }
          if (userId) {
            results.push = await this.sendPushNotification(
              userId,
              "Payment Successful! 💰",
              `We received your payment of ₹${booking.totalAmount}.`,
              { bookingId: booking._id.toString(), type: "payment_success" }
            );
          }
          break;
        case "status_update":
          results.email = await emailService.sendStatusUpdate(booking, safeUser);
          if (phone) {
            results.sms = await smsService.sendStatusUpdate(
              phone,
              booking.bookingNumber,
              booking.status
            );
          }
          if (userId) {
            results.push = await this.sendPushNotification(
              userId,
              `Booking Status: ${booking.status.toUpperCase()}`,
              `Your booking #${booking.bookingNumber} is now ${booking.status}.`,
              { bookingId: booking._id.toString(), type: "status_update" }
            );
          }
          break;
      }
    } catch (error) {
      console.error("Notification error:", error);
      results.error = error.message;
    }

    return results;
  }
}

module.exports = new NotificationService();
