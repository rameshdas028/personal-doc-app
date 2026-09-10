const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/docvault';

mongoose.connect(MONGO_URI)
  .then(() => console.log('[MongoDB] Connected:', MONGO_URI))
  .catch(err => console.error('[MongoDB] Connection failed:', err.message));

const UserSchema = new mongoose.Schema({
  firstName:   { type: String, required: true, trim: true },
  lastName:    { type: String, required: true, trim: true },
  phone:       { type: String, unique: true, required: true },
  password:    { type: String, required: true },
  resetOtp:    { type: String },
  resetOtpExp: { type: Date },
  created_at:  { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);

module.exports = { User };
