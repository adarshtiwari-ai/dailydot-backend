const axios = require('axios');

const standardizeAddress = (data, provider, lat, lng) => {
    const results = data.results || [];
    if (results.length === 0) {
        return {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            addressLine1: 'Unknown Location',
            city: '',
            state: '',
            pincode: '',
            nickname: 'Current Location'
        };
    }

    const firstResult = results[0];
    let addressLine1 = '';
    let city = '';
    let state = '';
    let pincode = '';

    const getComponent = (components, type) => components.find(c => c.types && c.types.includes(type))?.long_name || '';

    if (provider === 'ola') {
        const components = firstResult.address_components || [];

        pincode = getComponent(components, 'postal_code');
        city = getComponent(components, 'locality') || getComponent(components, 'administrative_area_level_3');
        state = getComponent(components, 'administrative_area_level_1');

        addressLine1 = firstResult.name || (firstResult.formatted_address ? firstResult.formatted_address.split(',')[0] : '');
    }

    // Safety fallback
    if (!addressLine1.trim()) {
        addressLine1 = firstResult.formatted_address || 'Unknown Location';
    }

    return {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        addressLine1: addressLine1,
        city: city,
        state: state,
        pincode: pincode,
        nickname: firstResult.name || 'Current Location'
    };
};

exports.reverseGeocode = async (req, res) => {
    try {
        const { lat, lng } = req.query;
        console.log("BACKEND RECEIVED COORDS:", lat, lng);
        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
        }

        const OLA_API_KEY = process.env.OLA_MAPS_API_KEY;
        if (!OLA_API_KEY) {
            return res.status(500).json({ success: false, message: 'Server missing OLA_MAPS_API_KEY' });
        }

        const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${OLA_API_KEY}`;
        console.log("CALLING OLA WITH URL:", url.replace(OLA_API_KEY, 'HIDDEN_KEY'));

        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'Origin': 'https://dailydot-api.onrender.com',
                'Referer': 'https://dailydot-api.onrender.com/'
            }
        });
        console.log("OLA RAW JSON:", JSON.stringify(response.data, null, 2));

        // Return exactly the expected 7 parameter object
        if (response.data?.results?.length > 0) {
            const standardized = standardizeAddress(response.data, 'ola', lat, lng);
            return res.status(200).json(standardized);
        }

        throw new Error("No results found from Ola API");
    } catch (error) {
        console.log("OLA API ERROR:", error.response?.status, error.response?.data);
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.error("OLA API AUTH ERROR - Check Dashboard/Key");
        }
        console.error("[LocationController] Ola Reverse Geocode Failed:", error.message);

        // Fallback or error return
        return res.status(200).json({
            latitude: parseFloat(req.query.lat),
            longitude: parseFloat(req.query.lng),
            addressLine1: 'Unknown Location',
            city: '',
            state: '',
            pincode: '',
            nickname: 'Current Location'
        });
    }
};
