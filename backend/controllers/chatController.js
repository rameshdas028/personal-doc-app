const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { searchDocuments, getDocumentsByUser, getDocumentById } = require('../services/vectorStoreService');
const { getChatModel } = require('../services/llmService');

const CAT_LABELS = {
  identity: 'Identity 🪪', bills: 'Bills & Utilities 🧾', income: 'Income 💰',
  medical: 'Medical 🏥', vehicle: 'Vehicle 🚗', insurance: 'Insurance 🛡️',
  education: 'Education 🎓', legal: 'Legal ⚖️', other: 'Other 📁',
};

async function parseIntent(message, history = []) {
  const model = getChatModel();
  const historyContext = history.length
    ? `\nRecent conversation:\n${history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')}\n`
    : '';

  const result = await model.invoke([
    new SystemMessage(`You are a document vault assistant. Analyze the user's message using conversation history for context.
The user may have spelling mistakes — correct them before analyzing.${historyContext}
Respond ONLY with this JSON:
{
  "wants_file": <true if user wants a SINGLE specific document>,
  "wants_list": <true if user wants MULTIPLE documents as list/grid>,
  "categories": ["<category names mentioned>"],
  "doc_types": ["<specific doc types mentioned>"],
  "search_query": "<semantic search query>",
  "doc_type_hint": "<single doc type if clearly mentioned — else null>",
  "person_name": "<person name if mentioned — else null>",
  "person_name_variants": ["<spelling variants>"],
  "confident": <true if intent is clear>,
  "folder_query": "<category name if user asks folder contents — else null>",
  "asking_category": <true if user asks which folder a doc belongs to>
}
Respond with ONLY the JSON, no extra text.`),
    new HumanMessage(message),
  ]);

  try {
    const clean = result.content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(clean);
  } catch {
    return { wants_file: true, wants_list: false, categories: [], doc_types: [], search_query: message, doc_type_hint: null, person_name: null, person_name_variants: [], confident: true };
  }
}

function formatFolderDocs(docs) {
  return docs.map(d => ({ doc_id: d.doc_id, label: d.label || d.doc_type, doc_type: d.doc_type, mimetype: d.mimetype, file_url: d.file_url, category: d.category || 'other', period: d.period || '' }));
}

const sendMessage = async (req, res) => {
  const { message, clarification, last_category, last_folder_docs, history, workspace_id } = req.body;
  const userId = req.userId;
  const storeId = workspace_id || userId;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const model = getChatModel();
    const queryToSearch = clarification ? `${message} ${clarification}` : message;
    const intent = await parseIntent(queryToSearch, history || []);

    // ── WANTS LIST ────────────────────────────────────────────────────────
    if (intent.wants_list || (intent.categories?.length > 0 && !intent.wants_file)) {
      const allDocs = await getDocumentsByUser(storeId);
      let matchedDocs = allDocs;

      if (intent.categories?.length > 0) {
        matchedDocs = allDocs.filter(d => intent.categories.some(c => (d.category || 'other').toLowerCase().includes(c.toLowerCase())));
      }
      if (intent.doc_types?.length > 0) {
        const byType = allDocs.filter(d => intent.doc_types.some(t => (d.doc_type || '').toLowerCase().includes(t.toLowerCase()) || (d.label || '').toLowerCase().includes(t.toLowerCase())));
        const ids = new Set(matchedDocs.map(d => d.doc_id));
        byType.forEach(d => { if (!ids.has(d.doc_id)) matchedDocs.push(d); });
      }

      if (!matchedDocs.length) return res.json({ reply: 'Koi matching document nahi mila.', matched: false });

      const label = intent.categories?.length ? intent.categories.join(' + ') : intent.doc_types?.length ? intent.doc_types.join(' + ') : 'All';
      return res.json({ reply: `**${label}** — ${matchedDocs.length} document${matchedDocs.length > 1 ? 's' : ''} mile:`, folder_docs: formatFolderDocs(matchedDocs), folder_used: label, matched: false });
    }

    // ── SHOW DOC FROM FOLDER CONTEXT ──────────────────────────────────────
    const showDocWords = ['pura dikhao', 'show document', 'dikhao', 'open karo', 'dekhna'];
    if (last_folder_docs?.length && !intent.folder_query && showDocWords.some(w => queryToSearch.toLowerCase().includes(w))) {
      if (last_folder_docs.length === 1) {
        const doc = await getDocumentById(last_folder_docs[0].doc_id, userId);
        if (doc) return res.json({ reply: `Yeh raha: ${doc.ai_description || doc.doc_type}`, matched: true, doc_type: doc.doc_type, document: { ...doc, mimetype: doc.mimetype || 'application/octet-stream' }, file_url: doc.file_url });
      } else {
        return res.json({ reply: null, needs_clarification: true, question: `Kaun sa document dikhana hai?\n${last_folder_docs.map((d, i) => `${i + 1}. ${d.label}`).join('\n')}` });
      }
    }

    // ── FOLDER CONTEXT CARRY ──────────────────────────────────────────────
    if (last_category && !intent.folder_query && !intent.asking_category) {
      const contextWords = ['is folder', 'isi folder', 'is mein', 'isme', 'sab dikhao', 'all documents', 'saare documents', 'list karo'];
      if (contextWords.some(w => queryToSearch.toLowerCase().includes(w))) intent.folder_query = last_category;
    }

    // ── ASKING CATEGORY ───────────────────────────────────────────────────
    if (intent.asking_category) {
      const results = await searchDocuments(queryToSearch, storeId, 1);
      const doc = results[0];
      if (!doc) return res.json({ reply: 'Koi matching document nahi mila vault mein.', matched: false });
      const cat = doc.category || 'other';
      return res.json({ reply: `**${doc.label || doc.doc_type}** — **${CAT_LABELS[cat] || cat}** folder mein hai.`, last_category: cat, matched: false });
    }

    // ── FOLDER QUERY ──────────────────────────────────────────────────────
    if (intent.folder_query) {
      const allDocs = await getDocumentsByUser(storeId);
      const folderDocs = allDocs.filter(d => (d.category || 'other').toLowerCase() === intent.folder_query.toLowerCase());
      if (!folderDocs.length) return res.json({ reply: `"${intent.folder_query}" folder mein koi document nahi hai.`, matched: false });

      const docList = folderDocs.map(d => `- ${d.label || d.doc_type}${d.period ? ` (${d.period})` : ''}`).join('\n');
      const result = await model.invoke([
        new SystemMessage('You are a document vault assistant. Reply in same language as user. Use **bold** for document names.'),
        new HumanMessage(`User asked about "${intent.folder_query}" folder. Documents:\n${docList}\n\nGive a clean summary list.`),
      ]);
      return res.json({ reply: result.content, folder_used: intent.folder_query, folder_docs: formatFolderDocs(folderDocs), matched: false });
    }

    // ── NEEDS CLARIFICATION ───────────────────────────────────────────────
    if (!intent.confident && !clarification && intent.wants_file) {
      return res.json({ reply: null, needs_clarification: true, question: 'Kaunsa document chahiye? Thoda aur batao.' });
    }

    // ── SEMANTIC SEARCH ───────────────────────────────────────────────────
    let matchedDoc = null;
    if (intent.wants_file) {
      const results = await searchDocuments(intent.search_query, storeId, 5);

      if (intent.person_name && results.length) {
        const variants = [intent.person_name, ...(intent.person_name_variants || [])].map(n => n.toLowerCase().trim()).filter(Boolean);
        matchedDoc = results.find(r => variants.some(v => `${r.label} ${r.ai_description} ${r.extracted_text}`.toLowerCase().includes(v))) || null;
      }
      if (!matchedDoc && intent.doc_type_hint && results.length) {
        const hint = intent.doc_type_hint.toLowerCase();
        matchedDoc = results.find(r => r.doc_type?.toLowerCase().includes(hint) || r.label?.toLowerCase().includes(hint)) || null;
      }
      if (!matchedDoc && results.length) {
        const words = intent.search_query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        matchedDoc = results.find(r => words.some(w => `${r.label} ${r.ai_description} ${r.extracted_text}`.toLowerCase().includes(w))) || null;
      }
      if (!matchedDoc && results[0]?.score > 0.20) matchedDoc = results[0];
    }

    // ── GENERATE REPLY ────────────────────────────────────────────────────
    let reply;
    const historyMessages = (history || []).map(m => m.role === 'user' ? new HumanMessage(m.text) : new SystemMessage(m.text));

    if (!intent.wants_file) {
      const contextResults = await searchDocuments(queryToSearch, storeId, 3);
      const relevantDocs = contextResults.filter(d => d.score > 0.10);
      const docContext = relevantDocs.length
        ? relevantDocs.map((d, i) => `--- Doc ${i + 1}: ${d.label || d.doc_type} ---\nType: ${d.doc_type}\nDescription: ${d.ai_description || ''}\nText: ${d.extracted_text || ''}\nPeriod: ${d.period || ''}\nExpiry: ${d.expiry_date || ''}`).join('\n\n')
        : 'No relevant documents found.';

      const result = await model.invoke([
        new SystemMessage(`You are a smart personal document assistant.\n\nDOCUMENT VAULT CONTEXT:\n${docContext}\n\nRules:\n- Answer ONLY from document context — never guess\n- Reply in SAME language as user (Hindi/English/Hinglish)\n- Use **bold** for amounts, dates, names, ID numbers\n- If answer not in documents, say so clearly\n- Max 6 lines`),
        ...historyMessages,
        new HumanMessage(queryToSearch),
      ]);
      reply = result.content;
    } else if (matchedDoc) {
      const result = await model.invoke([
        new SystemMessage(`You are a personal document assistant. Reply in same language as user.\nDocument:\nType: ${matchedDoc.doc_type}\nLabel: ${matchedDoc.label || ''}\nDescription: ${matchedDoc.ai_description || ''}\nText: ${matchedDoc.extracted_text || ''}\nPeriod: ${matchedDoc.period || ''}\nExpiry: ${matchedDoc.expiry_date || ''}\n\nGive 1-2 line summary. Use **bold** for key values.`),
        new HumanMessage(queryToSearch),
      ]);
      reply = result.content;
    } else if (!clarification) {
      return res.json({ reply: null, needs_clarification: true, question: 'Iss document ke baare mein thoda aur batao — naam, date, ya koi detail?' });
    } else {
      reply = 'Aapke vault mein aisa koi document nahi mila. Pehle upload karein.';
    }

    if (matchedDoc) {
      return res.json({ reply, matched: true, doc_type: matchedDoc.doc_type, document: { ...matchedDoc, mimetype: matchedDoc.mimetype || 'application/octet-stream' }, file_url: matchedDoc.file_url });
    }

    res.json({ reply, matched: false });

  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'AI response failed', detail: err.message });
  }
};

module.exports = { sendMessage };
