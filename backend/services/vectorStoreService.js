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
  storeId = storeId || doc.userId;
  const text = [doc.docType, doc.label, doc.purpose, doc.aiDescription, doc.extractedText, doc.extraInfo]
    .filter(Boolean).join(' | ').trim();

  const embedding = await getEmbedding(text);
  const col = await getCollection(storeId);

  await col.upsert({
    ids: [`doc_${doc.id}`],
    embeddings: [embedding],
    documents: [text],
    metadatas: [{
      docId:         String(doc.id),
      userId:        String(doc.userId),
      docType:       doc.docType || '',
      category:      doc.category || 'other',
      groupName:     doc.groupName || '',
      period:        doc.period || '',
      expiryDate:    doc.expiryDate || '',
      isFavourite:   doc.isFavourite ? 'true' : 'false',
      label:         doc.label || '',
      purpose:       doc.purpose || '',
      aiDescription: doc.aiDescription || '',
      extractedText: (doc.extractedText || '').slice(0, 2000),
      filename:      doc.filename || '',
      filepath:      doc.filepath || '',
      filehash:      doc.filehash || '',
      mimetype:      doc.mimetype || '',
      fileUrl:       `/api/documents/file/${doc.id}`,
      createdAt:     doc.createdAt || new Date().toISOString(),
      workspaceId:   doc.workspaceId || '',
    }],
  });
  console.log(`[VectorStore] Indexed doc ${doc.id} (${doc.docType})`);
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
  return idx === -1 ? null : { chromaId: result.ids[idx], ...result.metadatas[idx] };
}

async function getDocumentsByType(docType, storeId) {
  const col = await getCollection(storeId);
  const result = await col.get({ include: ['metadatas'] });
  return result.ids.map((id, i) => ({ chromaId: id, ...result.metadatas[i] })).filter(d => d.docType === docType);
}

async function searchDocuments(query, storeId, topK = 3) {
  const col = await getCollection(storeId);
  const queryEmbedding = await getEmbedding(query);
  const results = await col.query({ queryEmbeddings: [queryEmbedding], nResults: topK, include: ['metadatas', 'documents', 'distances'] });
  if (!results.ids[0]?.length) return [];
  return results.ids[0].map((id, i) => ({
    chromaId: id,
    ...results.metadatas[0][i],
    docId: parseInt(results.metadatas[0][i].docId),
    score: 1 - (results.distances[0][i] / 2),
  }));
}

module.exports = { upsertDocument, removeDocument, searchDocuments, getDocumentById, getDocumentsByUser, getDocumentByHash, getDocumentsByType };
