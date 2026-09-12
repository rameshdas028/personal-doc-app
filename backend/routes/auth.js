const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../db');


const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

const otpStore = {};
function generateOtp() { return String(Math.floor(1000 + Math.random() * 9000)); }

// ── SIGNUP ──────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { firstName, lastName, phone, password } = req.body;
  if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name required' });
  if (!phone || phone.length < 10) return res.status(400).json({ error: 'Valid phone number required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const exists = await User.findOne({ phone });
  if (exists) return res.status(400).json({ error: 'Phone number already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ firstName, lastName, phone, password: hashed });

  const token = jwt.sign({ userId: user._id.toString(), phone: user.phone }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token, user: { id: user._id.toString(), phone: user.phone, firstName: user.firstName, lastName: user.lastName } });
});

// ── LOGIN ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

  const user = await User.findOne({ phone });
  if (!user) return res.status(400).json({ error: 'Phone number not registered' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Incorrect password' });

  const token = jwt.sign({ userId: user._id.toString(), phone: user.phone }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token, user: { id: user._id.toString(), phone: user.phone, firstName: user.firstName, lastName: user.lastName } });
});

// ── FORGOT PASSWORD — send OTP ──────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const user = await User.findOne({ phone });
  if (!user) return res.status(400).json({ error: 'Phone number not registered' });

  const otp = generateOtp();
  await User.updateOne({ phone }, { resetOtp: otp, resetOtpExp: new Date(Date.now() + 5 * 60 * 1000) });

  console.log(`[DEV MODE] Reset OTP for ${phone}: ${otp}`);
  res.json({ success: true, message: 'OTP sent', dev_otp: otp });
});

// ── RESET PASSWORD — verify OTP + set new password ─────
router.post('/reset-password', async (req, res) => {
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
});

// ── AUTH MIDDLEWARE ─────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { router, authMiddleware };
