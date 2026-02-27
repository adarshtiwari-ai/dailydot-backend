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
    const { user, booking, message } = data;
    const results = {};

    // Send Email
    try {
      switch (type) {
        case "welcome":
          results.email = await emailService.sendWelcomeEmail(user);
          break;
        case "booking_confirmation":
          results.email = await emailService.sendBookingConfirmation(
            booking,
            user
          );
          results.sms = await smsService.sendBookingConfirmation(
            user.phone,
            booking.bookingNumber
          );
          results.push = await this.sendPushNotification(
            user._id,
            "Booking Confirmed! ✅",
            `Your booking #${booking.bookingNumber} has been confirmed.`,
            { bookingId: booking._id.toString(), type: "booking_confirmation" }
          );
          break;
        case "payment_success":
          results.email = await emailService.sendPaymentSuccess(booking, user);
          results.sms = await smsService.sendPaymentSuccess(
            user.phone,
            booking.totalAmount
          );
          results.push = await this.sendPushNotification(
            user._id,
            "Payment Successful! 💰",
            `We received your payment of ₹${booking.totalAmount}.`,
            { bookingId: booking._id.toString(), type: "payment_success" }
          );
          break;
        case "status_update":
          results.email = await emailService.sendStatusUpdate(booking, user);
          results.sms = await smsService.sendStatusUpdate(
            user.phone,
            booking.bookingNumber,
            booking.status
          );
          results.push = await this.sendPushNotification(
            user._id,
            `Booking Status: ${booking.status.toUpperCase()}`,
            `Your booking #${booking.bookingNumber} is now ${booking.status}.`,
            { bookingId: booking._id.toString(), type: "status_update" }
          );
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
