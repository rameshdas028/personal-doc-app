const { ChatGroq } = require('@langchain/groq');
const { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

function getChatModel() {
  const provider = process.env.CHAT_PROVIDER || 'groq';
  const model = process.env.CHAT_MODEL || 'llama3-70b-8192';
  if (provider === 'groq') return new ChatGroq({ apiKey: process.env.GROQ_API_KEY, model });
  if (provider === 'gemini') return new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model });
  throw new Error(`Unknown CHAT_PROVIDER: ${provider}`);
}

async function getEmbeddingModel() {
  const model = process.env.EMBED_MODEL || 'gemini-embedding-001';
  const embedder = new GoogleGenerativeAIEmbeddings({ apiKey: process.env.GEMINI_API_KEY, model });
  return {
    embedQuery: (text) => embedder.embedQuery(text),
    embedDocuments: (texts) => embedder.embedDocuments(texts),
  };
}

module.exports = { getChatModel, getEmbeddingModel };
