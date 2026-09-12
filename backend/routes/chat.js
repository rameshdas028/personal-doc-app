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
The user may have spelling mistakes — correct them before analyzing.
Respond ONLY with this JSON:
{
  "wants_file": <true if user is asking for any document/file>,
  "search_query": "<semantic search query — correct any spelling mistakes, include person name if mentioned, doc type, purpose. e.g. 'ramesh resume CV' or 'aadhar card identity'>",
  "doc_type_hint": "<exact doc type if clearly mentioned e.g. resume, photo, passport, aadhar, pan, driving license — else null>",
  "person_name": "<person's name if mentioned — correct spelling mistakes e.g. 'megna'→'Meghna', 'ramsh'→'Ramesh' — else null>",
  "person_name_variants": ["<list of possible spelling variants of the name — e.g. ['Meghna','Megna','Mehna','Meg'] — empty array if no name>"],
  "confident": <true if you understand what they want, false if completely unclear>,
  "folder_query": "<category name if user is asking what's inside a folder/category — e.g. 'other', 'education', 'identity', 'medical', 'bills', 'vehicle', 'insurance', 'legal' — else null>",
  "asking_category": <true if user is asking which category/folder a document belongs to — e.g. 'yeh kaun si category mein hai', 'this belongs to which folder' — else false>
}
Respond with ONLY the JSON, no extra text.`),
    new HumanMessage(message)
  ]);

  try {
    const clean = result.content.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(clean);
  } catch {
    return { wants_file: true, search_query: message, doc_type_hint: null, person_name: null, person_name_variants: [], confident: true };
  }
}

router.post('/', authMiddleware, async (req, res) => {
  const { message, clarification, last_category, last_folder_docs } = req.body;
  const userId = req.userId;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const model = getChatModel();
    const queryToSearch = clarification ? `${message} ${clarification}` : message;

    const intent = await parseIntent(queryToSearch);

    // "pura dikhao" / "show document" with folder context
    const showDocWords = ['pura dikhao', 'pura document', 'show document', 'dikhao', 'open karo', 'show karo', 'dekhhna', 'dekhna'];
    if (last_folder_docs?.length && !intent.folder_query && showDocWords.some(w => queryToSearch.toLowerCase().includes(w))) {
      if (last_folder_docs.length === 1) {
        // Only 1 doc — directly return it
        const { getDocumentById } = require('../vectorStore');
        const doc = await getDocumentById(last_folder_docs[0].doc_id, userId);
        if (doc) {
          return res.json({
            reply: `Yeh raha: ${doc.ai_description || doc.doc_type}`,
            matched: true, doc_type: doc.doc_type,
            document: { ...doc, mimetype: doc.mimetype || 'application/octet-stream' },
            file_url: doc.file_url,
          });
        }
      } else {
        // Multiple docs — ask which one
        const names = last_folder_docs.map((d, i) => `${i + 1}. ${d.label}`).join('\n');
        return res.json({
          reply: null, needs_clarification: true,
          question: `Kaun sa document dikhana hai?\n${names}`,
        });
      }
    }

    // "is folder ke documents" — use last_category from context
    if (last_category && !intent.folder_query && !intent.asking_category) {
      const contextWords = ['is folder', 'isi folder', 'is mein', 'isme', 'is category', 'sab dikhao', 'all documents', 'saare documents', 'list karo', 'show me all', 'show all', 'sab do', 'sabhi do', 'sabhi dikhao'];
      if (contextWords.some(w => queryToSearch.toLowerCase().includes(w))) {
        intent.folder_query = last_category;
      }
    }

    // User asking which category a document belongs to
    if (intent.asking_category) {
      const results = await searchDocuments(queryToSearch, userId, 1);
      const doc = results[0];
      if (!doc) return res.json({ reply: 'Koi matching document nahi mila vault mein.', matched: false });
      const CAT_LABELS = { identity: 'Identity 🪪', bills: 'Bills & Utilities 🧾', income: 'Income 💰', medical: 'Medical 🏥', vehicle: 'Vehicle 🚗', insurance: 'Insurance 🛡️', education: 'Education 🎓', legal: 'Legal ⚖️', other: 'Other 📁' };
      const cat = doc.category || 'other';
      const label = doc.label || doc.doc_type;
      const group = doc.group_name || doc.doc_type;
      return res.json({
        reply: `**${label}** — **${CAT_LABELS[cat] || cat}** folder mein hai.${group !== label ? `\nGroup: **${group}**` : ''}`,
        last_category: cat,
        matched: false
      });
    }

    // Folder/category listing query
    if (intent.folder_query) {
      const allDocs = await getDocumentsByUser(userId);
      const folderDocs = allDocs.filter(d => (d.category || 'other').toLowerCase() === intent.folder_query.toLowerCase());
      if (!folderDocs.length) {
        return res.json({ reply: `"${intent.folder_query}" folder mein koi document nahi hai.`, matched: false });
      }
      const docList = folderDocs.map(d => `- ${d.label || d.doc_type}${d.period ? ` (${d.period})` : ''}`).join('\n');
      const result = await model.invoke([
        new SystemMessage(`You are a document vault assistant. Reply in same language as user. List the documents clearly. Use **bold** for document names.`),
        new HumanMessage(`User asked about "${intent.folder_query}" folder. These documents are in it:\n${docList}\n\nGive a clean summary list.`)
      ]);
      return res.json({
        reply: result.content,
        folder_used: intent.folder_query,
        folder_docs: folderDocs.map(d => ({ doc_id: d.doc_id, label: d.label || d.doc_type })),
        matched: false
      });
    }

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

      // 1. Person name match — strongest signal (with variants for spelling mistakes)
      if (intent.person_name && results.length) {
        const variants = [intent.person_name, ...(intent.person_name_variants || [])]
          .map(n => n.toLowerCase().trim()).filter(Boolean);
        const nameMatch = results.find(r => {
          const haystack = `${r.label} ${r.ai_description} ${r.extracted_text}`.toLowerCase();
          return variants.some(v => haystack.includes(v));
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
      // Check if there's a recently matched doc context in the query
      const allDocs = await getDocumentsByUser(userId);
      const recentDoc = allDocs.length ? allDocs[allDocs.length - 1] : null;

      // Search for relevant doc even for non-file questions (user may be asking about a doc)
      const contextResults = await searchDocuments(queryToSearch, userId, 1);
      const contextDoc = contextResults[0]?.score > 0.15 ? contextResults[0] : null;

      const docContext = contextDoc
        ? `\n\nDocument context from user's vault:\nType: ${contextDoc.doc_type}\nDescription: ${contextDoc.ai_description}\nFull extracted text: ${contextDoc.extracted_text}`
        : '';

      const result = await model.invoke([
        new SystemMessage(`You are a helpful personal document assistant. Reply in same language as user.
Rules:
- Answer ONLY from the document context provided below — do not guess or make up data
- Use **bold** for important values (amounts, dates, names, numbers)
- Use bullet points ONLY if there are actual multiple items to list — never use empty bullets
- Keep response short and clear — max 5 lines
- If answer is not in the document context, say so honestly${docContext}`),
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
