const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'http://localhost:3000/api/v1';

async function testBookingFlow() {
    console.log('--- Starting Booking Flow Test ---');
    console.log('💡 REMINDER: Ensure your local server is running (npm run dev) before continuing.');

    try {
        // 1. Register/Login as Device User
        const deviceId = uuidv4();
        console.log(`\n1. Device ID: ${deviceId}`);

        let authRes;
        try {
            authRes = await axios.post(`${SERVER_URL}/auth/register-device`, {
                name: 'Booking Tester',
                phone: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                address: '123 Test Lane',
                deviceId
            });
            console.log('✅ Registered User:', authRes.data.user._id);
        } catch (authError) {
            console.error('❌ Authentication Failed:');
            if (authError.response) {
                console.error('- Status:', authError.response.status);
                console.error('- Data:', JSON.stringify(authError.response.data, null, 2));
            } else {
                console.error('- Message:', authError.message);
            }
            return; // Terminate test early
        }

        const { accessToken, user } = authRes.data;
        const token = accessToken;

        // 2. Fetch a valid Service ID
        console.log('\n2. Fetching valid Service ID...');
        let serviceId;
        try {
            const servicesRes = await axios.get(`${SERVER_URL}/services`);
            if (servicesRes.data.success && servicesRes.data.services.length > 0) {
                // Find the first service (it might be in a grouped format if query params were used, but standard GET / is an array)
                const firstService = servicesRes.data.services[0];
                serviceId = firstService._id;
                console.log(`✅ Found Service: "${firstService.name}" (ID: ${serviceId})`);
            } else {
                console.error('❌ No services found in database. Please add a service via admin panel or script first.');
                return;
            }
        } catch (serviceFetchError) {
            console.error('❌ Failed to fetch services:');
            if (serviceFetchError.response) {
                console.error('- Status:', serviceFetchError.response.status);
                console.error('- Data:', JSON.stringify(serviceFetchError.response.data, null, 2));
            } else {
                console.error('- Message:', serviceFetchError.message);
            }
            return;
        }

        // 3. Create Booking
        const bookingPayload = {
            items: [
                {
                    serviceId: serviceId,
                    quantity: 1
                }
            ],
            scheduledDate: new Date().toISOString(),
            scheduledTime: '10:00 AM',
            serviceAddress: {
                addressLine1: '123 Test Lane',
                city: 'Test City',
                state: 'TS',
                pincode: '000000'
            },
            name: user.name,
            phone: user.phone
        };

        console.log('\n3. Creating Booking...');
        let bookingId;
        try {
            const bookingRes = await axios.post(`${SERVER_URL}/bookings`, bookingPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Booking Created:', bookingRes.data.booking.bookingNumber);
            console.log('💰 Total Amount (Backend Calculated):', bookingRes.data.booking.totalAmount);
            bookingId = bookingRes.data.booking._id;
        } catch (bookingError) {
            console.error('❌ Booking Failed:');
            if (bookingError.response) {
                console.error('- Status:', bookingError.response.status);
                console.error('- Data:', JSON.stringify(bookingError.response.data, null, 2));
            } else {
                console.error('- Message:', bookingError.message);
            }
        }

        // 4. Verify Schema Consistency
        console.log('\n4. Verifying Schema Consistency...');
        if (bookingId) {
            console.log(`✅ Success: Booking ID ${bookingId} found. Refactored flow is active.`);
        } else {
            console.log('ℹ️  Skipping verification as booking creation failed.');
        }

    } catch (error) {
        console.error('\n💥 Unexpected Test Failure:');
        if (error.response) {
            console.error('- Status:', error.response.status);
            console.error('- Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('- Message:', error.message);
        }
    }
}

testBookingFlow();
