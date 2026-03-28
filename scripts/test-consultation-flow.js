const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'http://localhost:3000/api/v1';

async function testConsultationFlow() {
    console.log('--- Starting Consultation Flow Test ---');
    console.log('💡 REMINDER: Ensure your local server is running (npm run dev) before continuing.');

    try {
        // 1. Register/Login as Device User
        const deviceId = uuidv4();
        console.log(`\n1. Device ID: ${deviceId}`);

        let authRes;
        try {
            authRes = await axios.post(`${SERVER_URL}/auth/register-device`, {
                name: 'Consultation Tester',
                phone: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
                address: '456 Expert St',
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
            return;
        }

        const { accessToken, user } = authRes.data;
        const token = accessToken;

        // 2. Fetch a valid Service ID
        console.log('\n2. Fetching valid Service ID...');
        let serviceId;
        try {
            const servicesRes = await axios.get(`${SERVER_URL}/services`);
            if (servicesRes.data.success && servicesRes.data.services.length > 0) {
                const firstService = servicesRes.data.services[0];
                serviceId = firstService._id;
                console.log(`✅ Found Service: "${firstService.name}" (ID: ${serviceId})`);
            } else {
                console.error('❌ No services found in database.');
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

        // 3. Create Consultation Booking
        const bookingPayload = {
            items: [
                {
                    serviceId: serviceId,
                    quantity: 1
                }
            ],
            scheduledDate: new Date().toISOString(),
            scheduledTime: '12:00 PM',
            serviceAddress: {
                addressLine1: '456 Expert St',
                city: 'Expert City',
                state: 'EX',
                pincode: '123456'
            },
            name: user.name,
            phone: user.phone,
            bookingType: 'consultation',
            notes: 'I need help with a custom home decor project.'
        };

        console.log('\n3. Creating Consultation Booking...');
        try {
            const bookingRes = await axios.post(`${SERVER_URL}/bookings`, bookingPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const booking = bookingRes.data.booking;
            console.log('✅ Booking Created:', booking.bookingNumber);
            console.log('✅ Booking Type:', booking.bookingType);
            console.log('✅ Notes saved:', booking.notes);
            
            if (booking.bookingType === 'consultation' && booking.notes === bookingPayload.notes) {
                console.log('\n✨ TEST PASSED: Consultation metadata is preserved correctly! ✨');
            } else {
                console.error('\n❌ TEST FAILED: Consultation metadata mismatch.');
                process.exit(1);
            }
        } catch (bookingError) {
            console.error('❌ Booking Failed:');
            if (bookingError.response) {
                console.error('- Status:', bookingError.response.status);
                console.error('- Data:', JSON.stringify(bookingError.response.data, null, 2));
            } else {
                console.error('- Message:', bookingError.message);
            }
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 Unexpected Test Failure:', error.message);
        process.exit(1);
    }
}

testConsultationFlow();
