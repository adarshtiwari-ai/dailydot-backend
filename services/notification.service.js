const emailService = require("./email.service");
const smsService = require("./sms.service");
const admin = require("../config/firebase");
const User = require("../models/User");

class NotificationService {
  // Send Push Notification
  async sendPushNotification(userId, title, body, data = {}) {
    try {
      if (!admin) return { success: false, error: "Firebase not initialized" };

      const user = await User.findById(userId).select("+fcmToken");
      if (!user || !user.fcmToken) {
        return { success: false, error: "User or Token not found" };
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          messageId: new Date().getTime().toString(),
        },
        token: user.fcmToken,
      };

      const response = await admin.messaging().send(message);
      console.log("Successfully sent push notification:", response);
      return { success: true, response };
    } catch (error) {
      console.error("Error sending push notification:", error);
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
