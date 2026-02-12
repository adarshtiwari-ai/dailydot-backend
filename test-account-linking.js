const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'http://localhost:3000/api/v1';

// Adarsh's phone from inspect-data.js
const LEGACY_PHONE = '8541236547';
const NEW_DEVICE_ID = uuidv4();

async function testAccountLinking() {
    console.log('--- Testing Account Linking ---');
    console.log(`Target Phone: ${LEGACY_PHONE}`);
    console.log(`New Device ID: ${NEW_DEVICE_ID}`);

    try {
        // 1. Attempt to register device with existing phone
        console.log('\n1. Sending /register-device request...');
        const res = await axios.post(`${SERVER_URL}/auth/register-device`, {
            name: 'Adarsh Verified',
            phone: LEGACY_PHONE,
            deviceId: NEW_DEVICE_ID,
            address: '123 New Device Lane'
        });

        console.log('✅ Success! Response:', res.data);

        if (res.data.user.deviceId === NEW_DEVICE_ID) {
            console.log('✅ Device ID linked correctly.');
        } else {
            console.error('❌ Device ID mismatch:', res.data.user.deviceId);
        }

        if (res.data.message === "Device linked to existing account") {
            console.log('✅ Specific Success Message Received.');
        }

        // 2. Verify Login with New Device ID works
        console.log('\n2. Verifying Login with New Device ID...');
        const loginRes = await axios.post(`${SERVER_URL}/auth/device-login`, {
            deviceId: NEW_DEVICE_ID
        });

        if (loginRes.data.user.phone === LEGACY_PHONE) {
            console.log('✅ Login Successful & Phone Matches Legacy User!');
        } else {
            console.error('❌ Login Failed or User Mismatch');
        }

    } catch (error) {
        if (error.response) {
            console.error('❌ Request Failed:', error.response.status, error.response.data);
        } else {
            console.error('❌ Network Error:', error.message);
        }
    }
}

testAccountLinking();
