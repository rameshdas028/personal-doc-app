const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/docvault';
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[MongoDB] Connected:', MONGO_URI);
  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
