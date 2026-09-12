require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { router: authRouter } = require('./routes/auth');
const documentsRouter = require('./routes/documents');
const chatRouter = require('./routes/chat');
const workspacesRouter = require('./routes/workspaces');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/workspaces', workspacesRouter);

// Global error handler — never crash the server
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

process.on('uncaughtException', err => console.error('[uncaughtException]', err.message));
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err?.message || err));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
