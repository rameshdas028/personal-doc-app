const OpenAI = require('openai');
const fs = require('fs');
const sharp = require('sharp');
const { getChatModel } = require('./llm');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');

const PROMPT = `You are a document scanner. Analyze the provided document content.

Respond ONLY in this exact JSON format:
{
  "is_informative": <true if this is a document/certificate/bill/ID/medical record/resume/official paper — false if it's a personal photo, selfie, group photo, random image with no document value>,
  "doc_type": "<known types: aadhar, pan, driving_license, passport, passport_photo, medical_slip — else invent snake_case like 'salary_slip', 'gas_bill', 'resume', 'insurance_policy'>",
  "category": "<one of: identity, bills, income, medical, vehicle, insurance, education, legal, other>",
  "group_name": "<specific entity name for grouping — e.g. 'HP Gas', 'TCS', 'Apollo Hospital', 'HDFC Bank', 'Aadhar' — extract from document, keep short>",
  "period": "<month+year if present e.g. 'Jan 2025', 'Mar 2025' — else null>",
  "expiry_date": "<the single most relevant expiry/deadline date in YYYY-MM-DD format — passport expiry, license renewal, insurance due, warranty end date (purchase date + warranty period), bill payment due date — else null>",
  "confident": <true or false>,
  "description": "<1-line summary e.g. 'HP Gas Bill for Feb 2025 — Ramesh Kumar'>",
  "extracted_text": "<ALL text: name, ID numbers, DOB, address, issuer, doctor, hospital, amounts, dates — everything>",
  "questions": [],
  "crop": <null if image is already tightly cropped to content — OR {"left": <0-100>, "top": <0-100>, "right": <0-100>, "bottom": <0-100>} percentage bounding box of ONLY the information/text/data portion — exclude: blank margins, decorative borders, logos, watermarks, background noise, hands, table surface, empty whitespace — keep: all text fields, numbers, photos embedded in document, stamps, signatures>
}

Rules:
- is_informative: false for selfies, personal photos, group photos, random images — these have no document value
- group_name: extract the REAL entity name from doc (company, bank, hospital, issuer) — this is used for grouping multiple docs together
- category must be one of the listed values
- extracted_text must be thorough — used for search
- For unknown docs: invent a descriptive snake_case doc_type — NEVER use 'other'
- If genuinely unreadable: confident: false, questions: ["What is this document?"]
- crop: detect the tight bounding box of ONLY the information/data/text portion — cut blank margins, decorative borders, empty whitespace, background, hands, table — preserve all readable content, embedded photos, stamps, signatures
- Respond with ONLY the JSON, no extra text`;

function parseResponse(text) {
  const clean = text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(clean);
  if (parsed.doc_type) parsed.doc_type = parsed.doc_type.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (!parsed.doc_type) parsed.doc_type = 'document';
  return parsed;
}

// Smart crop: sharp trim() removes blank margins automatically — no AI coordinates needed
async function smartCrop(filepath) {
  try {
    const meta = await sharp(filepath).metadata();
    const w = meta.width, h = meta.height;

    // Step 1: trim white/light background margins (threshold 30 = aggressive trim)
    // Step 2: sharpen for better readability
    const trimmed = await sharp(filepath)
      .trim({ threshold: 30 })
      .sharpen({ sigma: 0.8 })
      .toBuffer();

    // Only save if result is reasonably sized (not over-trimmed)
    const trimMeta = await sharp(trimmed).metadata();
    const minDim = Math.min(trimMeta.width, trimMeta.height);
    const origMin = Math.min(w, h);

    if (minDim > 80 && trimMeta.width > 100 && trimMeta.height > 100 && minDim > origMin * 0.2) {
      fs.writeFileSync(filepath, trimmed);
      console.log(`[SmartCrop] ${w}x${h} → ${trimMeta.width}x${trimMeta.height}`);
    } else {
      console.log('[SmartCrop] Trim result too small, skipping');
    }
  } catch (e) {
    console.warn('[SmartCrop] Failed:', e.message);
  }
}

async function analyzeImage(filepath, mimetype) {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
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

async function extractPdfText(filepath) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filepath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text.slice(0, 3000);
}

async function analyzePdf(filepath) {
  const text = await extractPdfText(filepath);

  const model = getChatModel();
  const result = await model.invoke([
    new SystemMessage(PROMPT),
    new HumanMessage(`Document text:\n${text}`)
  ]);
  return parseResponse(result.content);
}

async function analyzeFile(filepath, mimetype) {
  if (mimetype === 'application/pdf') return await analyzePdf(filepath);
  // Auto-crop blank margins before analysis for better OCR
  await smartCrop(filepath);
  return await analyzeImage(filepath, mimetype);
}

module.exports = { analyzeFile };
