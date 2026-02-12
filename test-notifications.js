require("dotenv").config();
const emailService = require("./services/email.service");
const smsService = require("./services/sms.service");

async function testNotifications() {
  // Test email
  const emailResult = await emailService.sendWelcomeEmail({
    email: "test@example.com",
    name: "Test User",
  });
  console.log("Email test:", emailResult);

  // Test SMS (use your phone number)
  const smsResult = await smsService.sendOTP("9876543210", "123456");
  console.log("SMS test:", smsResult);
}

testNotifications();
