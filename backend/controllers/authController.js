const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function signToken(userId, phone) {
  return jwt.sign({ userId, phone }, JWT_SECRET, { expiresIn: '30d' });
}

const signup = async (req, res) => {
  const { firstName, lastName, phone, password } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name required' });
  if (!phone || phone.length < 10) return res.status(400).json({ error: 'Valid phone number required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = await User.findOne({ phone });
  if (exists) return res.status(400).json({ error: 'Phone number already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ firstName, lastName, phone, password: hashed });
  const token = signToken(user._id.toString(), user.phone);

  res.json({ success: true, token, user: { id: user._id.toString(), phone: user.phone, firstName: user.firstName, lastName: user.lastName } });
};

const login = async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

  const user = await User.findOne({ phone });
  if (!user) return res.status(400).json({ error: 'Phone number not registered' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Incorrect password' });

  const token = signToken(user._id.toString(), user.phone);
  res.json({ success: true, token, user: { id: user._id.toString(), phone: user.phone, firstName: user.firstName, lastName: user.lastName } });
};

const forgotPassword = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const user = await User.findOne({ phone });
  if (!user) return res.status(400).json({ error: 'Phone number not registered' });

  const otp = generateOtp();
  await User.updateOne({ phone }, { resetOtp: otp, resetOtpExp: new Date(Date.now() + 5 * 60 * 1000) });

  console.log(`[DEV] Reset OTP for ${phone}: ${otp}`);
  res.json({ success: true, message: 'OTP sent', dev_otp: otp });
};

const resetPassword = async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  if (!phone || !otp || !newPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const user = await User.findOne({ phone });
  if (!user) return res.status(400).json({ error: 'Phone number not registered' });
  if (user.resetOtp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });
  if (!user.resetOtpExp || new Date() > user.resetOtpExp) return res.status(400).json({ error: 'OTP expired' });

  const hashed = await bcrypt.hash(newPassword, 10);
  await User.updateOne({ phone }, { password: hashed, resetOtp: null, resetOtpExp: null });
  res.json({ success: true, message: 'Password reset successful' });
};

module.exports = { signup, login, forgotPassword, resetPassword };
