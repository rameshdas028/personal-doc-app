require('dotenv').config();
const { ChromaClient } = require('chromadb');
const { getEmbeddingModel } = require('./llm');

const client = new ChromaClient({
  host: process.env.CHROMA_HOST || 'localhost',
  port: parseInt(process.env.CHROMA_PORT || '8000'),
  ssl: false,
});

async function reindex() {
  console.log('[Reindex] Starting with OpenAI embeddings...');
  const embedModel = await getEmbeddingModel();

  const collections = await client.listCollections();
  console.log(`[Reindex] Found ${collections.length} collections:`, collections.map(c => c.name));

  for (const col of collections) {
    const collection = await client.getCollection({ name: col.name, embeddingFunction: null });
    const all = await collection.get({ include: ['metadatas', 'documents'] });

    if (!all.ids.length) { console.log(`[Reindex] ${col.name}: empty, skip`); continue; }

    console.log(`[Reindex] ${col.name}: re-indexing ${all.ids.length} docs...`);

    // Embed all documents in batch
    const embeddings = await embedModel.embedDocuments(all.documents);

    await collection.upsert({
      ids: all.ids,
      embeddings,
      documents: all.documents,
      metadatas: all.metadatas,
    });

    console.log(`[Reindex] ${col.name}: done ✅`);
  }

  console.log('[Reindex] All done! OpenAI embeddings active.');
  process.exit(0);
}

reindex().catch(err => { console.error('[Reindex] Failed:', err.message); process.exit(1); });
