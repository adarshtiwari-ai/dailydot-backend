const axios = require("axios");

class SMSService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || "msg91";
  }

  // MSG91 Implementation (Recommended for India)
  async sendViaMSG91(phone, message) {
    try {
      const response = await axios.post("https://api.msg91.com/api/v5/flow/", {
        sender: process.env.MSG91_SENDER_ID,
        mobiles: "91" + phone, // Add country code
        authkey: process.env.MSG91_AUTH_KEY,
        route: process.env.MSG91_ROUTE,
        country: "91",
        sms: [
          {
            message: message,
            to: [phone],
          },
        ],
      });

      return { success: true, response: response.data };
    } catch (error) {
      console.error("MSG91 SMS error:", error);
      return { success: false, error: error.message };
    }
  }

  // Twilio Implementation (Alternative)
  async sendViaTwilio(phone, message) {
    try {
      const twilio = require("twilio");
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: "+91" + phone,
      });

      return { success: true, sid: result.sid };
    } catch (error) {
      console.error("Twilio SMS error:", error);
      return { success: false, error: error.message };
    }
  }

  // Main send method
  async send(phone, message) {
    if (this.provider === "msg91") {
      return this.sendViaMSG91(phone, message);
    } else if (this.provider === "twilio") {
      return this.sendViaTwilio(phone, message);
    }
  }

  // SMS Templates
  sendOTP(phone, otp) {
    const message = `Your DailyDot OTP is ${otp}. Valid for 10 minutes.`;
    return this.send(phone, message);
  }

  sendBookingConfirmation(phone, bookingNumber) {
    const message = `DailyDot: Your booking ${bookingNumber} has been confirmed. Check app for details.`;
    return this.send(phone, message);
  }

  sendPaymentSuccess(phone, amount) {
    const message = `DailyDot: Payment of Rs.${amount} received successfully. Thank you!`;
    return this.send(phone, message);
  }

  sendStatusUpdate(phone, bookingNumber, status) {
    const message = `DailyDot: Your booking ${bookingNumber} status updated to ${status}.`;
    return this.send(phone, message);
  }
}

module.exports = new SMSService();
