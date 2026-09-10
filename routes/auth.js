const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';

// In-memory OTP store: { phone: { otp, expiresAt } }
const otpStore = {};

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit OTP
}

// STEP 1: Send OTP
router.post('/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }

  const otp = generateOtp();
  otpStore[phone] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 }; // 5 min expiry

  // ---------------------------------------------------------------
  // PRODUCTION NOTE: Replace this console.log with a real SMS API call
  // e.g. Twilio, MSG91, Fast2SMS (India), TextLocal, etc.
  // Example (Twilio-style pseudocode):
  //   await smsClient.messages.create({ to: phone, body: `Your OTP is ${otp}` });
  // ---------------------------------------------------------------
  console.log(`[DEV MODE] OTP for ${phone}: ${otp}`);

  res.json({
    success: true,
    message: 'OTP sent successfully',
    // Only returned here for local testing since there is no real SMS gateway wired up.
    // REMOVE this field once a real SMS provider is connected.
    dev_otp: otp
  });
});

// STEP 2: Verify OTP and issue session token
router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore[phone];

  if (!record) {
    return res.status(400).json({ error: 'No OTP requested for this number' });
  }
  if (Date.now() > record.expiresAt) {
    delete otpStore[phone];
    return res.status(400).json({ error: 'OTP expired, please request again' });
  }
  if (record.otp !== otp) {
    return res.status(400).json({ error: 'Incorrect OTP' });
  }

  delete otpStore[phone];

  // Find or create user
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const info = db.prepare('INSERT INTO users (phone) VALUES (?)').run(phone);
    user = { id: info.lastInsertRowid, phone };
  }

  const token = jwt.sign({ userId: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token, user: { id: user.id, phone: user.phone } });
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { router, authMiddleware };
