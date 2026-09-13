const OpenAI = require('openai');
const fs = require('fs');
const sharp = require('sharp');
const { getChatModel } = require('./llmService');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

const PROMPT = `You are a document scanner. Analyze the provided document content.

Respond ONLY in this exact JSON format:
{
  "isInformative": <true if this is a document/certificate/bill/ID/medical record/resume/official paper — false if personal photo/selfie/random image>,
  "docType": "<known types: aadhar, pan, drivingLicense, passport, passportPhoto, medicalSlip — else camelCase like 'salarySlip', 'gasBill', 'resume', 'insurancePolicy'>",
  "category": "<one of: identity, bills, income, medical, vehicle, insurance, education, legal, other>",
  "groupName": "<entity name for grouping — e.g. 'HP Gas', 'TCS', 'Apollo Hospital', 'HDFC Bank' — extract from document>",
  "period": "<month+year if present e.g. 'Jan 2025' — else null>",
  "expiryDate": "<most relevant expiry date in YYYY-MM-DD format — else null>",
  "confident": <true or false>,
  "description": "<1-line summary e.g. 'HP Gas Bill for Feb 2025 — Ramesh Kumar'>",
  "extractedText": "<ALL text: name, ID numbers, DOB, address, issuer, amounts, dates — everything>",
  "questions": []
}

Rules:
- isInformative: false for selfies, personal photos, group photos, random images
- groupName: extract the REAL entity name from doc
- category must be one of the listed values
- extractedText must be thorough — used for search
- For unknown docs: invent a descriptive camelCase docType — NEVER use 'other'
- Respond with ONLY the JSON, no extra text`;

function parseResponse(text) {
  const clean = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(clean);
  if (parsed.docType) parsed.docType = parsed.docType.replace(/[^a-zA-Z0-9]/g, '');
  if (!parsed.docType) parsed.docType = 'document';
  return parsed;
}

async function smartCrop(filepath) {
  try {
    const meta = await sharp(filepath).metadata();
    const trimmed = await sharp(filepath).trim({ threshold: 30 }).sharpen({ sigma: 0.8 }).toBuffer();
    const trimMeta = await sharp(trimmed).metadata();
    const origMin = Math.min(meta.width, meta.height);
    const trimMin = Math.min(trimMeta.width, trimMeta.height);
    if (trimMin > 80 && trimMeta.width > 100 && trimMeta.height > 100 && trimMin > origMin * 0.2) {
      fs.writeFileSync(filepath, trimmed);
      console.log(`[SmartCrop] ${meta.width}x${meta.height} → ${trimMeta.width}x${trimMeta.height}`);
    }
  } catch (e) {
    console.warn('[SmartCrop] Failed:', e.message);
  }
}

async function analyzeImage(filepath, mimetype) {
  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
  const base64 = fs.readFileSync(filepath).toString('base64');
  const result = await client.chat.completions.create({
    model: process.env.VISION_MODEL_OPENROUTER || 'dots-studio/dots-3-note-preview:free',
    messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:${mimetype};base64,${base64}` } },
      { type: 'text', text: PROMPT }
    ]}]
  });
  return parseResponse(result.choices[0].message.content);
}

async function analyzePdf(filepath) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filepath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  const model = getChatModel();
  const result = await model.invoke([new SystemMessage(PROMPT), new HumanMessage(`Document text:\n${text.slice(0, 3000)}`)]);
  return parseResponse(result.content);
}

async function analyzeFile(filepath, mimetype) {
  if (mimetype === 'application/pdf') return await analyzePdf(filepath);
  await smartCrop(filepath);
  return await analyzeImage(filepath, mimetype);
}

module.exports = { analyzeFile };
