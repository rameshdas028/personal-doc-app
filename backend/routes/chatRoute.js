const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { sendMessage } = require('../controllers/chatController');

const router = express.Router();

router.post('/', authMiddleware, sendMessage);

module.exports = router;
