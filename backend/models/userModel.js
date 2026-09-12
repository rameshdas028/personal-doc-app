const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName:   { type: String, required: true, trim: true },
  lastName:    { type: String, required: true, trim: true },
  phone:       { type: String, unique: true, required: true },
  password:    { type: String, required: true },
  resetOtp:    { type: String },
  resetOtpExp: { type: Date },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
