require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoute = require('./routes/authRoute');
const documentRoute = require('./routes/documentRoute');
const chatRoute = require('./routes/chatRoute');
const workspaceRoute = require('./routes/workspaceRoute');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect DB
connectDB();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001', credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth',       authRoute);
app.use('/api/documents',  documentRoute);
app.use('/api/chat',       chatRoute);
app.use('/api/workspaces', workspaceRoute);

// Error handler
app.use(errorHandler);

process.on('uncaughtException',  err => console.error('[uncaughtException]', err.message));
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err?.message || err));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
