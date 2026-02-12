const axios = require('axios');

async function testDelete() {
    const categoryId = '68ba5d4c53cce658b5de6f7e'; // ID from user logs
    const adminEmail = 'admin@dailydot.com';
    const adminPass = 'Admin123';
    const baseURL = 'http://localhost:3000/api/v1';

    try {
        // 1. Login to get token
        console.log('Logging in...');
        const loginRes = await axios.post(`${baseURL}/auth/login`, {
            email: adminEmail,
            password: adminPass
        });
        const token = loginRes.data.token;
        console.log('Got token:', token ? 'Yes' : 'No');

        // 2. Try Delete
        console.log(`Attempting to delete category ${categoryId}...`);
        const deleteRes = await axios.delete(`${baseURL}/categories/${categoryId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Delete Status:', deleteRes.status);
        console.log('Delete Response:', deleteRes.data);

    } catch (error) {
        if (error.response) {
            console.error('FAILED:', error.response.status, error.response.data);
        } else {
            console.error('ERROR:', error.message);
        }
    }
}

testDelete();
