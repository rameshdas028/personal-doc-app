const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const VECTOR_STORE_PATH = path.join(__dirname, 'vector_store.json');

// Load persisted vectors from disk
let vectorStore = [];
if (fs.existsSync(VECTOR_STORE_PATH)) {
  try { vectorStore = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, 'utf8')); } catch (e) {}
}

function saveStore() {
  fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(vectorStore));
}

async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-2' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Add or update a document's embedding
async function upsertDocument(doc) {
  const text = `${doc.doc_type} ${doc.label || ''} ${doc.ai_description || ''} ${doc.extracted_text || ''} ${doc.extra_info || ''}`.trim();
  const embedding = await getEmbedding(text);

  const existing = vectorStore.findIndex(v => v.doc_id === doc.id && v.user_id === doc.user_id);
  const entry = { doc_id: doc.id, user_id: doc.user_id, doc_type: doc.doc_type, text, embedding };

  if (existing >= 0) vectorStore[existing] = entry;
  else vectorStore.push(entry);

  saveStore();
}

// Remove a document's embedding
function removeDocument(docId) {
  vectorStore = vectorStore.filter(v => v.doc_id !== docId);
  saveStore();
}

// Search top-k similar documents for a user
async function searchDocuments(query, userId, topK = 3) {
  const queryEmbedding = await getEmbedding(query);
  const userDocs = vectorStore.filter(v => v.user_id === userId);

  return userDocs
    .map(v => ({ ...v, score: cosineSimilarity(queryEmbedding, v.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = { upsertDocument, removeDocument, searchDocuments };
