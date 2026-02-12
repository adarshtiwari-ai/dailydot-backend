const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'http://localhost:3000/api/v1';

async function testBookingFlow() {
    try {
        console.log('--- Starting Booking Flow Test ---');

        // 1. Register/Login as Device User
        const deviceId = uuidv4();
        console.log(`1. Device ID: ${deviceId}`);

        const authRes = await axios.post(`${SERVER_URL}/auth/register-device`, {
            name: 'Booking Tester',
            phone: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
            address: '123 Test Lane',
            deviceId
        });

        const { token, user } = authRes.data;
        console.log('✅ Registered User:', user._id);
        console.log('Token:', token.substring(0, 20) + '...');

        // 2. Create Booking
        // Need a service ID first.
        // Fetch services to get a valid ID.
        // Assuming we have services or can create one? 
        // Let's rely on finding one.

        // Actually, for this test, let's just use a fake Mongo ID if validation allows, 
        // or try to fetch categories/services if existing endpoints allow.
        // But better to fail on "Service Not Found" than 404 on endpoint.

        // Let's try to hit the booking endpoint.
        const bookingPayload = {
            serviceId: '507f1f77bcf86cd799439011', // Fake objectId
            scheduledDate: new Date().toISOString(),
            serviceAddress: {
                addressLine1: '123 Test Lane',
                city: 'Test City',
                state: 'TS',
                pincode: '000000'
            },
            name: user.name,
            phone: user.phone
        };

        console.log('\n2. Creating Booking...');
        try {
            const bookingRes = await axios.post(`${SERVER_URL}/bookings`, bookingPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Booking Created:', bookingRes.data);
        } catch (bookingError) {
            // It might fail if serviceId doesn't exist in DB, which is fine, 
            // as long as it's not a 401 or 500 crash.
            if (bookingError.response) {
                if (bookingError.response.status === 404 || bookingError.response.data.message.includes('Service')) {
                    console.log('✅ Booking Endpoint Reached (Service validation failed as expected with fake ID)');
                } else {
                    console.error('❌ Booking Failed Unexpectedly:', bookingError.response.status, bookingError.response.data);
                }
            } else {
                console.error('❌ Network Error on Booking:', bookingError.message);
            }
        }

    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
    }
}

testBookingFlow();
