const { ChatGroq } = require('@langchain/groq');
const { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const OpenAI = require('openai');

function getChatModel() {
  const provider = process.env.CHAT_PROVIDER || 'groq';
  const model = process.env.CHAT_MODEL || 'groq/compound-mini';
  if (provider === 'groq') return new ChatGroq({ apiKey: process.env.GROQ_API_KEY, model });
  if (provider === 'gemini') return new ChatGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY, model });
  throw new Error(`Unknown CHAT_PROVIDER: ${provider}`);
}

let _openai = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

async function getEmbeddingModel() {
  const provider = process.env.EMBED_PROVIDER || 'gemini';
  const model = process.env.EMBED_MODEL || 'text-embedding-004';

  if (provider === 'gemini') {
    const embedder = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model,
    });
    return {
      embedQuery: (text) => embedder.embedQuery(text),
      embedDocuments: (texts) => embedder.embedDocuments(texts),
    };
  }

  // OpenAI fallback
  return {
    embedQuery: async (text) => {
      const res = await getOpenAI().embeddings.create({ model, input: text });
      return res.data[0].embedding;
    },
    embedDocuments: async (texts) => {
      const res = await getOpenAI().embeddings.create({ model, input: texts });
      return res.data.map(d => d.embedding);
    }
  };
}

module.exports = { getChatModel, getEmbeddingModel };
