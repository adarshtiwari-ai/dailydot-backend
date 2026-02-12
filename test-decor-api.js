const axios = require('axios');

const testDecorAPI = async () => {
    try {
        const url = 'http://192.168.29.116:3000/api/v1/services?section=decor';
        console.log(`Fetching ${url}...`);
        const response = await axios.get(url);
        console.log('Status:', response.status);
        console.log('Decor Services Found:', response.data.services.length);
        if (response.data.services.length > 0) {
            console.log('Service Name:', response.data.services[0].name);
            console.log('Service Section:', response.data.services[0].section);
        } else {
            console.log('No services found with section=decor');
        }
    } catch (error) {
        console.error('Error fetching API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
};

testDecorAPI();
