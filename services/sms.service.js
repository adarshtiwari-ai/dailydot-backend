/**
 * Mock SMS Service for DailyDot
 * Created to resolve MODULE_NOT_FOUND errors on Render deployment.
 */

class SMSService {
    /**
     * Mock booking confirmation SMS
     * @param {string} phone 
     * @param {string} bookingNumber 
     */
    async sendBookingConfirmation(phone, bookingNumber) {
        console.log(`[Mock SMS] Booking Confirmation sent to ${phone}: Your booking #${bookingNumber} has been received and is pending assignment.`);
        return { success: true, messageId: 'mock-sms-id-1' };
    }

    /**
     * Mock payment success SMS
     * @param {string} phone 
     * @param {number} totalAmount 
     */
    async sendPaymentSuccess(phone, totalAmount) {
        console.log(`[Mock SMS] Payment Success sent to ${phone}: We received your payment of ₹${totalAmount}.`);
        return { success: true, messageId: 'mock-sms-id-2' };
    }

    /**
     * Mock status update SMS
     * @param {string} phone 
     * @param {string} bookingNumber 
     * @param {string} status 
     */
    async sendStatusUpdate(phone, bookingNumber, status) {
        console.log(`[Mock SMS] Status Update sent to ${phone}: Your booking #${bookingNumber} is now ${status}.`);
        return { success: true, messageId: 'mock-sms-id-3' };
    }
}

module.exports = new SMSService();
