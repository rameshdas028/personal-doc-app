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
    new SystemMessage(`You are a document vault assistant. Analyze the user's message using conversation history.
The user may have spelling mistakes — correct them before analyzing.${historyContext}
Respond ONLY with this JSON:
{
  "wantsFile": <true if user wants a SINGLE specific document>,
  "wantsList": <true if user wants MULTIPLE documents as list/grid>,
  "categories": ["<category names mentioned>"],
  "docTypes": ["<specific doc types mentioned>"],
  "searchQuery": "<semantic search query>",
  "docTypeHint": "<single doc type if clearly mentioned — else null>",
  "personName": "<person name if mentioned — else null>",
  "personNameVariants": ["<spelling variants>"],
  "confident": <true if intent is clear>,
  "folderQuery": "<category name if user asks folder contents — else null>",
  "askingCategory": <true if user asks which folder a doc belongs to>
}
Respond with ONLY the JSON, no extra text.`),
    new HumanMessage(message),
  ]);

  try {
    const clean = result.content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(clean);
  } catch {
    return { wantsFile: true, wantsList: false, categories: [], docTypes: [], searchQuery: message, docTypeHint: null, personName: null, personNameVariants: [], confident: true };
  }
}

function formatFolderDocs(docs) {
  return docs.map(d => ({
    docId: d.docId, label: d.label || d.docType, docType: d.docType,
    mimetype: d.mimetype, fileUrl: d.fileUrl, category: d.category || 'other', period: d.period || '',
  }));
}

const sendMessage = async (req, res) => {
  const { message, clarification, lastCategory, lastFolderDocs, history, workspaceId } = req.body;
  const userId = req.userId;
  const storeId = workspaceId || userId;
  if (!message) return res.status(400).json({ error: 'message is required' });

  try {
    const model = getChatModel();
    const queryToSearch = clarification ? `${message} ${clarification}` : message;
    const intent = await parseIntent(queryToSearch, history || []);

    // ── WANTS LIST ────────────────────────────────────────────────────────
    if (intent.wantsList || (intent.categories?.length > 0 && !intent.wantsFile)) {
      const allDocs = await getDocumentsByUser(storeId);
      let matchedDocs = allDocs;

      if (intent.categories?.length > 0) {
        matchedDocs = allDocs.filter(d => intent.categories.some(c => (d.category || 'other').toLowerCase().includes(c.toLowerCase())));
      }
      if (intent.docTypes?.length > 0) {
        const byType = allDocs.filter(d => intent.docTypes.some(t =>
          (d.docType || '').toLowerCase().includes(t.toLowerCase()) ||
          (d.label || '').toLowerCase().includes(t.toLowerCase())
        ));
        const ids = new Set(matchedDocs.map(d => d.docId));
        byType.forEach(d => { if (!ids.has(d.docId)) matchedDocs.push(d); });
      }

      if (!matchedDocs.length) return res.json({ reply: 'Koi matching document nahi mila.', matched: false });

      const label = intent.categories?.length ? intent.categories.join(' + ') : intent.docTypes?.length ? intent.docTypes.join(' + ') : 'All';
      return res.json({ reply: `**${label}** — ${matchedDocs.length} document${matchedDocs.length > 1 ? 's' : ''} mile:`, folderDocs: formatFolderDocs(matchedDocs), folderUsed: label, matched: false });
    }

    // ── SHOW DOC FROM FOLDER CONTEXT ──────────────────────────────────────
    const showDocWords = ['pura dikhao', 'show document', 'dikhao', 'open karo', 'dekhna'];
    if (lastFolderDocs?.length && !intent.folderQuery && showDocWords.some(w => queryToSearch.toLowerCase().includes(w))) {
      if (lastFolderDocs.length === 1) {
        const doc = await getDocumentById(lastFolderDocs[0].docId, userId);
        if (doc) return res.json({ reply: `Yeh raha: ${doc.aiDescription || doc.docType}`, matched: true, docType: doc.docType, document: { ...doc, mimetype: doc.mimetype || 'application/octet-stream' }, fileUrl: doc.fileUrl });
      } else {
        return res.json({ reply: null, needsClarification: true, question: `Kaun sa document dikhana hai?\n${lastFolderDocs.map((d, i) => `${i + 1}. ${d.label}`).join('\n')}` });
      }
    }

    // ── FOLDER CONTEXT CARRY ──────────────────────────────────────────────
    if (lastCategory && !intent.folderQuery && !intent.askingCategory) {
      const contextWords = ['is folder', 'isi folder', 'is mein', 'isme', 'sab dikhao', 'all documents', 'saare documents', 'list karo'];
      if (contextWords.some(w => queryToSearch.toLowerCase().includes(w))) intent.folderQuery = lastCategory;
    }

    // ── ASKING CATEGORY ───────────────────────────────────────────────────
    if (intent.askingCategory) {
      const results = await searchDocuments(queryToSearch, storeId, 1);
      const doc = results[0];
      if (!doc) return res.json({ reply: 'Koi matching document nahi mila vault mein.', matched: false });
      const cat = doc.category || 'other';
      return res.json({ reply: `**${doc.label || doc.docType}** — **${CAT_LABELS[cat] || cat}** folder mein hai.`, lastCategory: cat, matched: false });
    }

    // ── FOLDER QUERY ──────────────────────────────────────────────────────
    if (intent.folderQuery) {
      const allDocs = await getDocumentsByUser(storeId);
      const folderDocs = allDocs.filter(d => (d.category || 'other').toLowerCase() === intent.folderQuery.toLowerCase());
      if (!folderDocs.length) return res.json({ reply: `"${intent.folderQuery}" folder mein koi document nahi hai.`, matched: false });

      const docList = folderDocs.map(d => `- ${d.label || d.docType}${d.period ? ` (${d.period})` : ''}`).join('\n');
      const result = await model.invoke([
        new SystemMessage('You are a document vault assistant. Reply in same language as user. Use **bold** for document names.'),
        new HumanMessage(`User asked about "${intent.folderQuery}" folder. Documents:\n${docList}\n\nGive a clean summary list.`),
      ]);
      return res.json({ reply: result.content, folderUsed: intent.folderQuery, folderDocs: formatFolderDocs(folderDocs), matched: false });
    }

    // ── NEEDS CLARIFICATION ───────────────────────────────────────────────
    if (!intent.confident && !clarification && intent.wantsFile) {
      return res.json({ reply: null, needsClarification: true, question: 'Kaunsa document chahiye? Thoda aur batao.' });
    }

    // ── SEMANTIC SEARCH ───────────────────────────────────────────────────
    let matchedDoc = null;
    if (intent.wantsFile) {
      const results = await searchDocuments(intent.searchQuery, storeId, 5);

      if (intent.personName && results.length) {
        const variants = [intent.personName, ...(intent.personNameVariants || [])].map(n => n.toLowerCase().trim()).filter(Boolean);
        matchedDoc = results.find(r => variants.some(v => `${r.label} ${r.aiDescription} ${r.extractedText}`.toLowerCase().includes(v))) || null;
      }
      if (!matchedDoc && intent.docTypeHint && results.length) {
        const hint = intent.docTypeHint.toLowerCase();
        matchedDoc = results.find(r => r.docType?.toLowerCase().includes(hint) || r.label?.toLowerCase().includes(hint)) || null;
      }
      if (!matchedDoc && results.length) {
        const words = intent.searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        matchedDoc = results.find(r => words.some(w => `${r.label} ${r.aiDescription} ${r.extractedText}`.toLowerCase().includes(w))) || null;
      }
      if (!matchedDoc && results[0]?.score > 0.20) matchedDoc = results[0];
    }

    // ── GENERATE REPLY ────────────────────────────────────────────────────
    let reply;
    const historyMessages = (history || []).map(m => m.role === 'user' ? new HumanMessage(m.text) : new SystemMessage(m.text));

    if (!intent.wantsFile) {
      const contextResults = await searchDocuments(queryToSearch, storeId, 3);
      const relevantDocs = contextResults.filter(d => d.score > 0.10);
      const docContext = relevantDocs.length
        ? relevantDocs.map((d, i) => `--- Doc ${i + 1}: ${d.label || d.docType} ---\nType: ${d.docType}\nDescription: ${d.aiDescription || ''}\nText: ${d.extractedText || ''}\nPeriod: ${d.period || ''}\nExpiry: ${d.expiryDate || ''}`).join('\n\n')
        : 'No relevant documents found.';

      const result = await model.invoke([
        new SystemMessage(`You are a smart personal document assistant.\n\nDOCUMENT VAULT CONTEXT:\n${docContext}\n\nRules:\n- Answer ONLY from document context — never guess\n- Reply in SAME language as user (Hindi/English/Hinglish)\n- Use **bold** for amounts, dates, names, ID numbers\n- If answer not in documents, say so clearly\n- Max 6 lines`),
        ...historyMessages,
        new HumanMessage(queryToSearch),
      ]);
      reply = result.content;
    } else if (matchedDoc) {
      const result = await model.invoke([
        new SystemMessage(`You are a personal document assistant. Reply in same language as user.\nDocument:\nType: ${matchedDoc.docType}\nLabel: ${matchedDoc.label || ''}\nDescription: ${matchedDoc.aiDescription || ''}\nText: ${matchedDoc.extractedText || ''}\nPeriod: ${matchedDoc.period || ''}\nExpiry: ${matchedDoc.expiryDate || ''}\n\nGive 1-2 line summary. Use **bold** for key values.`),
        new HumanMessage(queryToSearch),
      ]);
      reply = result.content;
    } else if (!clarification) {
      return res.json({ reply: null, needsClarification: true, question: 'Iss document ke baare mein thoda aur batao — naam, date, ya koi detail?' });
    } else {
      reply = 'Aapke vault mein aisa koi document nahi mila. Pehle upload karein.';
    }

    if (matchedDoc) {
      return res.json({ reply, matched: true, docType: matchedDoc.docType, document: { ...matchedDoc, mimetype: matchedDoc.mimetype || 'application/octet-stream' }, fileUrl: matchedDoc.fileUrl });
    }

    res.json({ reply, matched: false });

  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: 'AI response failed', detail: err.message });
  }
};

module.exports = { sendMessage };
