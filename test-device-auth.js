const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'http://localhost:3000/api/v1/auth';

async function testDeviceAuth() {
    try {
        const deviceId = uuidv4();
        const deviceId2 = uuidv4();
        console.log(`Testing with Device ID: ${deviceId}`);

        // 1. Device Login (Should be Guest)
        console.log('\n--- 1. Testing Device Login (New Device) ---');
        let res = await axios.post(`${SERVER_URL}/device-login`, { deviceId });
        if (res.data.isGuest) {
            console.log('✅ Success: Identified as Guest');
        } else {
            console.error('❌ Failed: Should be guest', res.data);
        }

        // 2. Register Device
        console.log('\n--- 2. Testing Register Device ---');
        const userData = {
            name: 'Device User',
            phone: '9999999999',
            address: '123 Test St',
            deviceId
        };
        // Use a random phone to avoid unique constraint collisions in repeated tests
        userData.phone = Math.floor(1000000000 + Math.random() * 9000000000).toString();

        res = await axios.post(`${SERVER_URL}/register-device`, userData);
        if (res.data.token && res.data.user) {
            console.log('✅ Success: User registered');
            console.log('User:', res.data.user);
        } else {
            console.error('❌ Failed: Registration failed', res.data);
        }

        // 3. Device Login (Should be User)
        console.log('\n--- 3. Testing Device Login (Registered Device) ---');
        res = await axios.post(`${SERVER_URL}/device-login`, { deviceId });
        if (res.data.token && !res.data.isGuest) {
            console.log('✅ Success: Auto-logged in');
        } else {
            console.error('❌ Failed: Auto-login failed', res.data);
        }

        // 4. Register Second Device (Test Sparse Index)
        console.log('\n--- 4. Testing Second Device (Sparse Index Check) ---');
        const userData2 = {
            name: 'Device User 2',
            phone: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
            address: '456 Test St',
            deviceId: deviceId2
        };
        res = await axios.post(`${SERVER_URL}/register-device`, userData2);
        if (res.data.token) {
            console.log('✅ Success: Second user registered (Sparse index works)');
        } else {
            console.error('❌ Failed: Second user registration failed', res.data);
        }

    } catch (error) {
        console.error('Test Failed:', error.response ? error.response.data : error.message);
    }
}

testDeviceAuth();
