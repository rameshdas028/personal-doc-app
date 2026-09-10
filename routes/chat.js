const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db');
const { authMiddleware } = require('./auth');
const { searchDocuments } = require('../vectorStore');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/', authMiddleware, async (req, res) => {
  const { message } = req.body;
  const userId = req.userId;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    // Step 1: Vector search — find most relevant document
    const results = await searchDocuments(message, userId, 3);
    const topMatch = results[0];

    // Step 2: Build context for Gemini
    const allDocs = db.prepare('SELECT doc_type, label, extra_info, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const docList = allDocs.length
      ? allDocs.map(d => `- ${d.doc_type}${d.label ? ' (' + d.label + ')' : ''}${d.extra_info ? ': ' + d.extra_info : ''}`).join('\n')
      : 'Koi document upload nahi hua abhi tak.';

    const matchedDoc = topMatch && topMatch.score > 0.5
      ? db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(topMatch.doc_id, userId)
      : null;

    const systemPrompt = `You are a personal document assistant. The user has uploaded these documents:
${docList}

${matchedDoc ? `Most relevant document found: ${matchedDoc.doc_type}${matchedDoc.label ? ' (' + matchedDoc.label + ')' : ''} (similarity: ${topMatch.score.toFixed(2)})` : 'No relevant document found for this query.'}

Rules:
- IMPORTANT: Always reply in the SAME language the user writes in. If they write in English, reply in English. If Hindi, reply in Hindi. If Hinglish, reply in Hinglish. Mirror their language exactly.
- If the user is asking for a document and it is available, say you are showing it to them
- If the document is not uploaded yet, tell them to upload it
- Keep replies short and helpful (1-2 lines max)
- Never mention similarity scores to the user`;

    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.6-flash' });
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `User: ${message}` }
    ]);
    const reply = result.response.text();

    if (matchedDoc) {
      return res.json({
        reply,
        matched: true,
        doc_type: matchedDoc.doc_type,
        document: matchedDoc,
        file_url: `/api/documents/file/${matchedDoc.id}`
      });
    }

    res.json({ reply, matched: false });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'AI response failed', detail: err.message });
  }
});

module.exports = router;
