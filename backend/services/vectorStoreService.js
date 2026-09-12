const { ChromaClient } = require('chromadb');
const { getEmbeddingModel } = require('./llmService');

const client = new ChromaClient({
  host: process.env.CHROMA_HOST || 'localhost',
  port: parseInt(process.env.CHROMA_PORT || '8000'),
  ssl: false,
});

const collectionCache = {};

async function getCollection(storeId) {
  const name = `user_${storeId}`;
  if (!collectionCache[name]) {
    collectionCache[name] = await client.getOrCreateCollection({ name, embeddingFunction: null });
  }
  return collectionCache[name];
}

async function getEmbedding(text) {
  const model = await getEmbeddingModel();
  return model.embedQuery(text);
}

async function upsertDocument(doc, storeId) {
  storeId = storeId || doc.user_id;
  const text = [doc.doc_type.replace(/_/g, ' '), doc.label, doc.purpose, doc.ai_description, doc.extracted_text, doc.extra_info]
    .filter(Boolean).join(' | ').trim();

  const embedding = await getEmbedding(text);
  const col = await getCollection(storeId);

  await col.upsert({
    ids: [`doc_${doc.id}`],
    embeddings: [embedding],
    documents: [text],
    metadatas: [{
      doc_id: String(doc.id),
      user_id: String(doc.user_id),
      doc_type: doc.doc_type,
      category: doc.category || 'other',
      group_name: doc.group_name || '',
      period: doc.period || '',
      expiry_date: doc.expiry_date || '',
      is_favourite: doc.is_favourite ? 'true' : 'false',
      label: doc.label || '',
      purpose: doc.purpose || '',
      ai_description: doc.ai_description || '',
      extracted_text: (doc.extracted_text || '').slice(0, 2000),
      filename: doc.filename || '',
      filepath: doc.filepath || '',
      filehash: doc.filehash || '',
      mimetype: doc.mimetype || '',
      file_url: `/api/documents/file/${doc.id}`,
      created_at: doc.created_at || new Date().toISOString(),
    }],
  });
  console.log(`[VectorStore] Indexed doc ${doc.id} (${doc.doc_type})`);
}

async function removeDocument(docId, storeId) {
  try {
    const col = await getCollection(storeId);
    await col.delete({ ids: [`doc_${docId}`] });
  } catch (e) {
    console.warn(`[VectorStore] Remove failed for doc ${docId}:`, e.message);
  }
}

async function getDocumentById(docId, storeId) {
  const col = await getCollection(storeId);
  const result = await col.get({ ids: [`doc_${docId}`], include: ['metadatas'] });
  return result.ids.length ? result.metadatas[0] : null;
}

async function getDocumentsByUser(storeId) {
  const col = await getCollection(storeId);
  const result = await col.get({ include: ['metadatas'] });
  return result.metadatas || [];
}

async function getDocumentByHash(filehash, storeId) {
  const col = await getCollection(storeId);
  const result = await col.get({ include: ['metadatas'] });
  if (!result.ids.length) return null;
  const idx = result.metadatas.findIndex(m => m.filehash === filehash);
  return idx === -1 ? null : { chroma_id: result.ids[idx], ...result.metadatas[idx] };
}

async function getDocumentsByType(docType, storeId) {
  const col = await getCollection(storeId);
  const result = await col.get({ include: ['metadatas'] });
  return result.ids.map((id, i) => ({ chroma_id: id, ...result.metadatas[i] })).filter(d => d.doc_type === docType);
}

async function searchDocuments(query, storeId, topK = 3) {
  const col = await getCollection(storeId);
  const queryEmbedding = await getEmbedding(query);
  const results = await col.query({ queryEmbeddings: [queryEmbedding], nResults: topK, include: ['metadatas', 'documents', 'distances'] });
  if (!results.ids[0]?.length) return [];
  return results.ids[0].map((id, i) => ({
    chroma_id: id,
    ...results.metadatas[0][i],
    doc_id: parseInt(results.metadatas[0][i].doc_id),
    score: 1 - (results.distances[0][i] / 2),
  }));
}

module.exports = { upsertDocument, removeDocument, searchDocuments, getDocumentById, getDocumentsByUser, getDocumentByHash, getDocumentsByType };
