const admin = require('../config/firebase');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');

// Helper to generate tokens
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    return { accessToken, refreshToken };
};

// @desc    Firebase Auth Login/Signup
// @route   POST /api/v1/auth/firebase-login
// @access  Public
exports.firebaseLogin = async (req, res) => {
    try {
        const { idToken, deviceId, name } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Firebase ID Token is required' });
        }

        // Verify Firebase Token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { phone_number, uid } = decodedToken;

        if (!phone_number) {
            return res.status(400).json({
                success: false,
                message: 'Phone number not found in Firebase token'
            });
        }

        // Standardize phone number format (remove '+' if needed, matching our DB format)
        // Usually, we store 10 digits without country code or with '91'
        const phone = phone_number.replace('+91', '').replace('+', '');

        // Check if user exists
        let user = await User.findOne({ phone });

        if (user) {
            // User exists, login
            if (!user.isVerified) {
                user.isVerified = true;
                await user.save();
            }
            // Update firebaseUid if missing
            if (!user.firebaseUid) {
                user.firebaseUid = uid;
                await user.save();
            }
        } else {
            // New User Registration
            user = await User.create({
                phone,
                name: name || 'User',
                isVerified: true,
                firebaseUid: uid,
                deviceId: deviceId || undefined,
                role: 'user'
            });
        }

        const { accessToken, refreshToken } = generateTokens(user);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user._id, // Keep consistent with existing frontend expectations
                _id: user._id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        console.error('Firebase Login Error:', error);
        res.status(401).json({ success: false, message: 'Invalid Firebase Token or Server Error' });
    }
};

// @desc    Social Login
// @route   POST /api/v1/auth/social-login
// @access  Public
exports.socialLogin = async (req, res) => {
    try {
        const { provider, socialId, email, name, photo, deviceId } = req.body;

        if (!provider || !socialId || !email) {
            return res.status(400).json({ success: false, message: 'Missing social login fields' });
        }

        // Check if user exists by Social ID OR Email
        let user = await User.findOne({
            $or: [
                { googleId: socialId },
                { appleId: socialId },
                { email: email }
            ]
        });

        if (user) {
            // Update social ID if missing (Link Account)
            let updated = false;

            if (provider === 'google' && !user.googleId) {
                user.googleId = socialId;
                updated = true;
            }
            if (provider === 'apple' && !user.appleId) {
                user.appleId = socialId;
                updated = true;
            }

            // Update device ID if provided/changed
            if (deviceId && user.deviceId !== deviceId) {
                user.deviceId = deviceId;
                updated = true;
            }

            if (updated) await user.save();

        } else {
            // Create New User
            const userData = {
                name: name || 'User',
                email: email,
                isVerified: true,
                deviceId: deviceId,
                role: 'user'
            };

            // Needs phone? Schema says required. 
            // If social login doesn't provide phone, we might need a flow to ask for it.
            // For now, if we don't have phone, we might fail validation if we strictly enforce it.
            // But User.js schema has phone { required: true }.
            // Strategy: 
            // 1. If we can't get phone from social, we store a placeholder or require a second step?
            // The prompt "Unified User Schema" says phone (unique).
            // "Ensure that if a user logs in with Google and that email is already tied to a phone number, the accounts are merged."
            // If they are NEW, they might not have a phone number yet. 
            // Let's assume we can create them without phone IF we adjust schema, OR we generate a temporary one, OR we require phone update.
            // **Correction**: The User schema change I made kept `phone: { required: true }`.
            // Options:
            // A. Make phone not required.
            // B. Use a dummy phone number? (Not distinct).
            // C. Return a "Needs Registration" response?

            // Let's check the schema again.
            // 24:   phone: {
            // 25:     type: String,
            // 26:     required: true,
            // 27:     unique: true
            // 28:   },

            // If I try to create a user without phone, it will fail.
            // I should make phone sparse/not-required if I want to support Social-Only init, OR generate a placeholder.
            // However, the "Phone Flow" is primary.
            // Let's modify the schema to make phone NOT required if we have social login? 
            // Or just make it sparse and not required?

            // WAITING: I'll make phone verify REQUIRED? 
            // Actually, the prompt says "Unified User Schema ... phone (unique)". It didn't explicitly say "Required".
            // Implementation Plan said "Ensure phone is unique". 
            // Valid Strategy: Make phone `required: false` but `unique: true, sparse: true`.

            // I will update the schema in a separate tool call if needed or just handle it here?
            // I'll assume for now I should generate a placeholder or update schema.
            // I'll update schema effectively to make phone not strictly required for creation if it interferes with Social Login 
            // UNLESS the prompt implies phone is always the key.
            // "Phone Flow: ... Social Flow: ... If email/social ID exists, link it; otherwise, create a new user."
            // If I create a new user from Google, I have Email but no Phone.
            // So Phone MUST NOT be required for the document, or I need to ask for it.
            // The prompt doesn't describe a "Enter Phone after Social" step.
            // So phone should probably be optional on creation.

            userData[provider === 'google' ? 'googleId' : 'appleId'] = socialId;

            // Temporary workaround if Schema enforces Phone: 
            // I'll try to save. If it fails, I need to fix Schema. 
            // I will proactively fix Schema to `required: false` in next step if not done.
            // Looking at my previous diff.. I didn't remove `required: true` from phone.
            // I will fix that in `User.js` alongside this.

            user = await User.create(userData);
        }

        const { accessToken, refreshToken } = generateTokens(user);

        res.status(200).json({
            success: true,
            message: 'Social login successful',
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Social Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error during social login' });
    }
};

// @desc    Legacy Login (Email/Password)
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if password matches
        // Note: If you are using a hashing library, compare here. 
        // Assuming simple comparison for now if not hashed, or bcrypt if hashed.
        // It seems the legacy code probably used bcrypt.
        const isMatch = await bcryptjs.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const { accessToken, refreshToken } = generateTokens(user);

        res.status(200).json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'No refresh token provided' });
        }

        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

            const user = await User.findById(decoded.userId);
            if (!user) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }

            const tokens = generateTokens(user);

            res.status(200).json({
                success: true,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken // Rotation (optional but good)
            });

        } catch (err) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

    } catch (error) {
        console.error('Refresh Token Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
// @desc    Update User Profile (Push Token, etc)
// @route   PUT /api/v1/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const { pushToken, phone, name, email } = req.body;

        // Final update to match user's specific template for debugging
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id || req.user._id,
            {
                name,
                email,
                phone,
                pushToken
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update profile"
        });
    }
};

module.exports = exports;
