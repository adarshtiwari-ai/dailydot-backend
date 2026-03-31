require("dotenv").config();
const crypto = require("crypto");
const axios = require("axios");

// Configuration
// CHANGE THIS TO A REAL PAYMENT ORDER ID FROM YOUR DATABASE to test the flow properly
const TEST_ORDER_ID = "order_test_XYZ123";
const WEBHOOK_URL = "https://dailydot-api.onrender.com/api/v1/payments/webhook";

const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!SECRET) {
    console.error("❌ ERROR: RAZORPAY_WEBHOOK_SECRET is missing from your .env file!");
    process.exit(1);
}

// 1. Create Mock Payload Structure
const mockPayload = {
    event: "payment.captured",
    payload: {
        payment: {
            entity: {
                id: "pay_test_mock_transaction_id",
                order_id: TEST_ORDER_ID,
                amount: 50000,
                status: "captured"
            }
        }
    }
};

// 2. Stringify Payload (This simulates the EXACT rawBody string Razorpay sends)
const rawBodyString = JSON.stringify(mockPayload);

// 3. Generate Valid Signature
const expectedSignature = crypto
    .createHmac("sha256", SECRET)
    .update(rawBodyString)
    .digest("hex");

console.log(`🚀 Sending mock webhook to: ${WEBHOOK_URL}`);
console.log(`🔐 Generated Signature: ${expectedSignature}`);

// 4. Fire the Webhook Request
async function testWebhook() {
    try {
        const response = await axios.post(WEBHOOK_URL, rawBodyString, {
            headers: {
                "Content-Type": "application/json",
                "x-razorpay-signature": expectedSignature,
            },
        });

        console.log("✅ Server Accepted Webhook (Status 200)");
        console.log("Response:", response.data);
        console.log("\nIf you used a real order_id, check your database to ensure the booking is now 'Confirmed'!");

    } catch (error) {
        console.error("❌ Webhook Request Failed:", error.response?.status);
        console.error("Error Detail:", error.response?.data || error.message);
    }
}

testWebhook();
