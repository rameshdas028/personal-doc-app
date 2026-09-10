const express = require('express');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { authMiddleware } = require('./auth');
const { searchDocuments, getDocumentsByUser } = require('../vectorStore');
const { getChatModel } = require('../llm');

const router = express.Router();

async function parseIntent(message) {
  const model = getChatModel();
  const result = await model.invoke([
    new SystemMessage(`You are a document vault assistant. Analyze the user's message.
Respond ONLY with this JSON:
{
  "wants_file": <true if user is asking for any document/file>,
  "search_query": "<semantic search query — include person name if mentioned, doc type, purpose. e.g. 'ramesh resume CV' or 'aadhar card identity'>",
  "doc_type_hint": "<exact doc type if clearly mentioned e.g. resume, photo, passport, aadhar, pan, driving license — else null>",
  "person_name": "<person's name if mentioned in query, else null>",
  "confident": <true if you understand what they want, false if completely unclear>
}
Respond with ONLY the JSON, no extra text.`),
    new HumanMessage(message)
  ]);

  try {
    const clean = result.content.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(clean);
  } catch {
    return { wants_file: true, search_query: message, doc_type_hint: null, confident: true };
  }
}

router.post('/', authMiddleware, async (req, res) => {
  const { message, clarification } = req.body;
  const userId = req.userId;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const model = getChatModel();
    const queryToSearch = clarification ? `${message} ${clarification}` : message;

    const intent = await parseIntent(queryToSearch);

    if (!intent.confident && !clarification && intent.wants_file) {
      return res.json({
        reply: null,
        needs_clarification: true,
        question: 'Kaunsa document chahiye? Thoda aur batao.'
      });
    }

    // Search ChromaDB — result is source of truth
    let matchedDoc = null;
    if (intent.wants_file) {
      const results = await searchDocuments(intent.search_query, userId, 5);

      // 1. Person name match — strongest signal
      if (intent.person_name && results.length) {
        const name = intent.person_name.toLowerCase();
        const nameMatch = results.find(r => {
          const haystack = `${r.label} ${r.ai_description} ${r.extracted_text}`.toLowerCase();
          return haystack.includes(name);
        });
        if (nameMatch) { matchedDoc = nameMatch; }
      }

      // 2. doc_type_hint match in type/label/description
      if (!matchedDoc && intent.doc_type_hint && results.length) {
        const hint = intent.doc_type_hint.toLowerCase();
        const typeMatch = results.find(r => {
          const inType = r.doc_type?.toLowerCase().includes(hint);
          const inLabel = r.label?.toLowerCase().includes(hint);
          const inDesc = r.ai_description?.toLowerCase().includes(hint);
          return inType || inLabel || inDesc;
        });
        if (typeMatch) { matchedDoc = typeMatch; }
      }

      // 3. Keyword match from search_query words
      if (!matchedDoc && results.length) {
        const words = intent.search_query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const nameMatch = results.find(r => {
          const haystack = `${r.label} ${r.ai_description} ${r.extracted_text}`.toLowerCase();
          return words.some(w => haystack.includes(w));
        });
        if (nameMatch) { matchedDoc = nameMatch; }
      }

      // 4. Fallback to top score
      if (!matchedDoc) {
        const topMatch = results[0];
        if (topMatch && topMatch.score > 0.20) matchedDoc = topMatch;
      }
    }

    let reply;
    if (!intent.wants_file) {
      const result = await model.invoke([
        new SystemMessage('You are a helpful personal document assistant. Reply in same language as user. 1-2 lines max.'),
        new HumanMessage(queryToSearch)
      ]);
      reply = result.content;
    } else if (matchedDoc) {
      reply = `Yeh raha: ${matchedDoc.ai_description || matchedDoc.doc_type}`;
    } else if (!clarification) {
      return res.json({
        reply: null,
        needs_clarification: true,
        question: 'Iss document ke baare mein thoda aur batao — jaise naam, date, ya koi aur detail? Main dobara dhundta hoon.'
      });
    } else {
      reply = 'Aapke vault mein aisa koi document nahi mila. Agar hai toh pehle upload karein.';
    }

    if (matchedDoc) {
      console.log('[Chat] matchedDoc:', JSON.stringify(matchedDoc, null, 2));
      return res.json({
        reply,
        matched: true,
        doc_type: matchedDoc.doc_type,
        document: {
          ...matchedDoc,
          mimetype: matchedDoc.mimetype || 'application/octet-stream',
        },
        file_url: matchedDoc.file_url,
      });
    }

    res.json({ reply, matched: false });

  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'AI response failed', detail: err.message });
  }
});

module.exports = router;
