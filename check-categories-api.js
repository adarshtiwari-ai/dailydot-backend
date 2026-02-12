const axios = require('axios');

async function checkCategories() {
    try {
        const response = await axios.get('http://localhost:3000/api/v1/categories');
        console.log('Status:', response.status);
        if (response.data.categories && response.data.categories.length > 0) {
            console.log('First Category Sample:', JSON.stringify(response.data.categories[0], null, 2));

            const firstCat = response.data.categories[0];
            if (firstCat.id) {
                console.log('SUCCESS: "id" field is present.');
            } else {
                console.log('FAILURE: "id" field is MISSING.');
            }
        } else {
            console.log('No categories found.');
        }
    } catch (error) {
        console.error('Error fetching categories:', error.message);
    }
}

checkCategories();
