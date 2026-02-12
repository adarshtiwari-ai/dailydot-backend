const mongoose = require('mongoose');
require('dotenv').config();

// If dotenv doesn't work (e.g. .env is in parent), hardcode URI from other files
// But since verify-decor.js worked, dotenv likely works or uri is passed differently.
// Let's rely on dotenv first.

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        // List indexes
        const indexes = await collection.indexes();
        console.log('Existing Indexes:', indexes);

        // Find email index
        const emailIndex = indexes.find(idx => idx.key.email === 1);
        if (emailIndex) {
            console.log(`Found email index: ${emailIndex.name}. Dropping...`);
            await collection.dropIndex(emailIndex.name);
            console.log('✅ Index dropped. Mongoose will recreate it as sparse on next app/script run.');
        } else {
            console.log('ℹ️ Email index not found (or already dropped).');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
