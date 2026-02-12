const axios = require('axios');

const testAPI = async () => {
    try {
        const url = 'http://192.168.29.116:3000/api/v1/categories';
        console.log(`Fetching ${url}...`);
        const response = await axios.get(url);
        console.log('Status:', response.status);
        console.log('Categories count:', response.data.categories.length);
        if (response.data.categories.length > 0) {
            console.log('Sample Category:', response.data.categories[0].name);
        }
    } catch (error) {
        console.error('Error fetching API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
};

testAPI();
