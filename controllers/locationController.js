const axios = require('axios');

const standardizeAddress = (data, provider, lat, lng) => {
    const results = data.results || [];
    if (results.length === 0) {
        return {
            latitude: lat,
            longitude: lng,
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
        city = getComponent(components, 'locality') || getComponent(components, 'district');
        state = getComponent(components, 'administrative_area_level_1') || getComponent(components, 'state');

        const premise = getComponent(components, 'premise');
        const route = getComponent(components, 'route');
        const sublocality = getComponent(components, 'sublocality');

        const stitchedAddress = [premise, route, sublocality]
            .filter(Boolean)
            .filter(part => part !== "NA" && !part.includes('+'))
            .join(', ');

        addressLine1 = firstResult.formatted_address || stitchedAddress;
    }

    // Safety fallback
    if (!addressLine1.trim()) {
        addressLine1 = firstResult.formatted_address || 'Unknown Location';
    }

    return {
        latitude: lat,
        longitude: lng,
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
        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
        }

        const OLA_API_KEY = process.env.OLA_MAPS_API_KEY;
        if (!OLA_API_KEY) {
            return res.status(500).json({ success: false, message: 'Server missing OLA_MAPS_API_KEY' });
        }

        const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${OLA_API_KEY}`;
        const response = await axios.get(url, { timeout: 5000 });

        // Return exactly the expected 7 parameter object
        if (response.data?.results?.length > 0) {
            const standardized = standardizeAddress(response.data, 'ola', lat, lng);
            return res.status(200).json(standardized);
        }

        throw new Error("No results found from Ola API");
    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.error("OLA API AUTH ERROR - Check Dashboard/Key");
        }
        console.error("[LocationController] Ola Reverse Geocode Failed:", error.message);

        // Fallback or error return
        return res.status(200).json({
            latitude: req.query.lat,
            longitude: req.query.lng,
            addressLine1: 'Unknown Location',
            city: '',
            state: '',
            pincode: '',
            nickname: 'Current Location'
        });
    }
};
