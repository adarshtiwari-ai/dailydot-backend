const nodemailer = require("nodemailer");

// Create transporter based on email service
const createTransporter = () => {
  if (process.env.EMAIL_SERVICE === "gmail") {
    return nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else if (process.env.SENDGRID_API_KEY) {
    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    return sgMail;
  }
};

const transporter = createTransporter();

// Email templates
const emailTemplates = {
  welcome: (user) => ({
    subject: "Welcome to DailyDot!",
    html: `
      <h2>Welcome ${user.name}!</h2>
      <p>Thank you for joining DailyDot. We're excited to have you on board.</p>
      <p>You can now book home services easily through our platform.</p>
      <br>
      <p>Best regards,<br>DailyDot Team</p>
    `,
  }),

  bookingConfirmation: (booking, user) => ({
    subject: `Booking Confirmed - ${booking.bookingNumber}`,
    html: `
      <h2>Booking Confirmation</h2>
      <p>Hi ${user.name},</p>
      <p>Your booking has been confirmed!</p>
      <div style="border: 1px solid #ddd; padding: 15px; margin: 15px 0;">
        <p><strong>Booking Number:</strong> ${booking.bookingNumber}</p>
        <p><strong>Service:</strong> ${booking.serviceId.name}</p>
        <p><strong>Date:</strong> ${new Date(
          booking.scheduledDate
        ).toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${booking.status}</p>
        <p><strong>Amount:</strong> ₹${booking.totalAmount}</p>
      </div>
      <p>Thank you for choosing DailyDot!</p>
    `,
  }),

  paymentSuccess: (booking, user) => ({
    subject: `Payment Successful - ₹${booking.totalAmount}`,
    html: `
      <h2>Payment Confirmation</h2>
      <p>Hi ${user.name},</p>
      <p>We've received your payment of <strong>₹${booking.totalAmount}</strong></p>
      <p>Booking Number: ${booking.bookingNumber}</p>
      <p>Payment ID: ${booking.paymentId}</p>
      <br>
      <p>Thank you!</p>
    `,
  }),

  statusUpdate: (booking, user) => ({
    subject: `Booking ${booking.status} - ${booking.bookingNumber}`,
    html: `
      <h2>Booking Status Update</h2>
      <p>Hi ${user.name},</p>
      <p>Your booking ${booking.bookingNumber} status has been updated to: <strong>${booking.status}</strong></p>
      <p>If you have any questions, please contact our support team.</p>
    `,
  }),
};

// Send email function
const sendEmail = async (to, templateName, data) => {
  try {
    const template = emailTemplates[templateName](
      data.booking || data,
      data.user || data
    );

    if (process.env.EMAIL_SERVICE === "gmail") {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: template.subject,
        html: template.html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent:", info.messageId);
      return { success: true, messageId: info.messageId };
    }
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail: (user) => sendEmail(user.email, "welcome", user),
  sendBookingConfirmation: (booking, user) =>
    sendEmail(user.email, "bookingConfirmation", { booking, user }),
  sendPaymentSuccess: (booking, user) =>
    sendEmail(user.email, "paymentSuccess", { booking, user }),
  sendStatusUpdate: (booking, user) =>
    sendEmail(user.email, "statusUpdate", { booking, user }),
};
