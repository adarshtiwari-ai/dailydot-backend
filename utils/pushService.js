const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

let expo = new Expo();

/**
 * Send a push notification to a specific user
 * @param {string} userId - The ID of the user to notify
 * @param {string} title - Notification title
 * @param {string} body - Notification body message
 * @param {object} data - Optional data payload for deep linking
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
    try {
        const user = await User.findById(userId).select('+pushToken');

        if (!user || !user.pushToken) {
            console.log(`Push notification skipped: No token found for user ${userId}`);
            return;
        }

        const token = user.pushToken;

        // Check that all your push tokens appear to be valid Expo push tokens
        if (!Expo.isExpoPushToken(token)) {
            console.error(`Push token ${token} is not a valid Expo push token`);
            return;
        }

        // Create the message
        const messages = [{
            to: token,
            sound: 'default',
            title: title,
            body: body,
            data: data,
        }];

        // Send the message
        let chunks = expo.chunkPushNotifications(messages);
        let tickets = [];

        for (let chunk of chunks) {
            try {
                let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error("Error sending push notification chunk:", error);
            }
        }

        console.log(`Notification sent to user ${userId}: ${title}`);
        return tickets;
    } catch (error) {
        console.error("Error in sendPushNotification utility:", error);
    }
};

module.exports = {
    sendPushNotification
};
