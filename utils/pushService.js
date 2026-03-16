const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

let expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

/**
 * Send a push notification to a specific user or array of users
 * @param {string|string[]} userIds - Single user ID or array of user IDs
 * @param {string} title - Notification title
 * @param {string} body - Notification body message
 * @param {object} data - Optional data payload for deep linking
 */
const sendPushNotification = async (userIds, title, body, data = {}) => {
    try {
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        // Fetch users and their tokens
        const users = await User.find({ _id: { $in: ids } }).select('+pushToken');

        // Extract unique valid tokens
        const uniqueTokens = [...new Set(
            users
                .map(u => u.pushToken)
                .filter(token => token && Expo.isExpoPushToken(token))
        )];

        if (uniqueTokens.length === 0) return [];

        const messages = uniqueTokens.map(token => ({
            to: token,
            sound: 'default',
            title: title,
            body: body,
            data: data,
        }));

        // Map tokens to user IDs for pruning (using the first user found for that token)
        const tokenToUserMap = {};
        for (const user of users) {
            if (user.pushToken && !tokenToUserMap[user.pushToken]) {
                tokenToUserMap[user.pushToken] = user._id;
            }
        }

        if (messages.length === 0) return [];

        // Chunk messages to according to Expo guidelines
        let chunks = expo.chunkPushNotifications(messages);
        let tickets = [];

        // Send chunks
        for (let chunk of chunks) {
            try {
                let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error("Error sending push notification chunk:", error);
            }
        }

        // --- PRUNING LOGIC (Non-blocking) ---
        // Inspect results for "DeviceNotRegistered"
        (async () => {
            try {
                for (let i = 0; i < tickets.length; i++) {
                    const ticket = tickets[i];
                    const originalMessage = messages[i];

                    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                        const userId = tokenToUserMap[originalMessage.to];
                        console.log(`[Push Pruning] Pruning stale token for user ${userId}`);
                        await User.findByIdAndUpdate(userId, { pushToken: '' });
                    }
                }
            } catch (pruneError) {
                console.error("[Push Pruning] Error during background pruning:", pruneError);
            }
        })();

        return tickets;
    } catch (error) {
        console.error("Error in sendPushNotification utility:", error);
        return [];
    }
};

module.exports = {
    sendPushNotification
};
