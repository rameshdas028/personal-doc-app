require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { router: authRouter } = require('./routes/auth');
const documentsRouter = require('./routes/documents');
const chatRouter = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat', chatRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
