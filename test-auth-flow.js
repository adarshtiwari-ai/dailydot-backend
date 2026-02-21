const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1/auth';
const TEST_PHONE = '9876543210';
const TEST_OTP = '1234';

async function testAuth() {
    console.log('--- Starting Auth Flow Test ---');

    try {
        // 1. Send OTP
        console.log(`\n1. Sending OTP to ${TEST_PHONE}...`);
        const sendRes = await axios.post(`${BASE_URL}/send-otp`, { phone: TEST_PHONE });
        console.log('Response:', sendRes.data);

        if (!sendRes.data.success) throw new Error('Send OTP failed');

        // 2. Verify OTP (Register/Login)
        console.log(`\n2. Verifying OTP ${TEST_OTP}...`);
        const verifyRes = await axios.post(`${BASE_URL}/verify-otp`, {
            phone: TEST_PHONE,
            code: TEST_OTP,
            name: 'Test User'
        });
        console.log('Response:', verifyRes.data);

        if (!verifyRes.data.success || !verifyRes.data.accessToken) throw new Error('Verify OTP failed');

        const token = verifyRes.data.accessToken;
        console.log('\nLogin Successful! Token received.');

        // 3. Test Profile (Protected Route)
        console.log('\n3. Testing Protected Route (Profile)...');
        const profileRes = await axios.get(`${BASE_URL}/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Profile Response:', profileRes.data);

        if (!profileRes.data.success) throw new Error('Profile fetch failed');

        console.log('\n--- Auth Flow Verified Successfully! ---');

    } catch (error) {
        console.error('\nTest Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testAuth();
