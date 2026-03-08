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

        const Setting = require('../models/Setting');
        let settings = await Setting.findOne();
        if (!settings) settings = await Setting.create({});

        const provider = settings.system?.activeMapProvider || 'ola';

        let addressLine1 = 'Unknown Location';
        let city = '';
        let state = '';
        let pincode = '';
        let nickname = 'Current Location';

        if (provider === 'ola') {
            const OLA_API_KEY = process.env.OLA_MAPS_API_KEY;
            if (!OLA_API_KEY) {
                console.error("Server missing OLA_MAPS_API_KEY");
                return res.status(500).json({ success: false, message: 'Server configuration error' });
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

            if (response.data?.status === 'ok' && response.data?.results?.length > 0) {
                const firstResult = response.data.results[0];
                const components = firstResult.address_components || [];

                const getComponent = (typesToFind) => {
                    const comp = components.find(c => c.types.some(t => typesToFind.includes(t)));
                    return comp ? comp.long_name : '';
                };

                city = getComponent(['locality', 'administrative_area_level_3']);
                state = getComponent(['administrative_area_level_1']);
                pincode = getComponent(['postal_code']);

                const placeName = firstResult.name || getComponent(['sublocality_level_3', 'premise', 'point_of_interest']);
                const neighborhood = getComponent(['sublocality', 'neighborhood']);

                addressLine1 = [placeName, neighborhood]
                    .filter(Boolean)
                    .join(', ') || (firstResult.formatted_address ? firstResult.formatted_address.split(',')[0] : 'Unknown Location');
                nickname = 'Home';
            } else {
                throw new Error("No results found from Ola Maps Geocoding API");
            }
        } else if (provider === 'google') {
            const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
            if (!GOOGLE_API_KEY) {
                console.error("Server missing GOOGLE_MAPS_API_KEY");
                return res.status(500).json({ success: false, message: 'Server configuration error' });
            }

            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
            console.log("CALLING GOOGLE MAPS WITH URL (KEY HIDDEN)");

            const googleResponse = await axios.get(url, { timeout: 5000 });
            console.log("GOOGLE RAW JSON:", JSON.stringify(googleResponse.data, null, 2));

            if (googleResponse.data.status !== 'OK') {
                throw new Error('Google API returned: ' + googleResponse.data.status);
            }

            if (googleResponse.data.results && googleResponse.data.results.length > 0) {
                const firstResult = googleResponse.data.results[0];
                const components = firstResult.address_components || [];

                const getGComponent = (typesToFind) => {
                    const comp = components.find(c => c.types.some(t => typesToFind.includes(t)));
                    return comp ? comp.long_name : '';
                };

                city = getGComponent(['locality', 'administrative_area_level_3']);
                state = getGComponent(['administrative_area_level_1']);
                pincode = getGComponent(['postal_code']);

                // Build Address Line 1: Strip out ugly Plus Codes (containing '+')
                addressLine1 = getGComponent(['premise', 'route', 'sublocality', 'neighborhood']);
                if (!addressLine1) {
                    const addressParts = firstResult.formatted_address.split(',').map(p => p.trim());
                    // Find the first part of the address that doesn't look like a Plus Code
                    addressLine1 = addressParts.find(p => !p.includes('+')) || city || 'Unknown Location';
                }
                nickname = 'Home';
            } else {
                throw new Error("No results found from Google Maps Geocoding API");
            }
        } else {
            throw new Error("Invalid Map Provider logic flag");
        }

        // UNIFIED RETURN STATEMENT
        return res.status(200).json({
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            addressLine1,
            city,
            state,
            pincode,
            nickname
        });

    } catch (error) {
        console.error("[LocationController] Reverse Geocode Failed:", error.message);

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
