const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const DOC_TYPES = ['aadhar', 'pan', 'driving_license', 'passport', 'passport_photo', 'medical_slip', 'other'];

async function analyzeFile(filepath, mimetype) {
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });

  const base64 = fs.readFileSync(filepath).toString('base64');

  const prompt = `You are a document scanner. Extract ALL readable information from this file.

Respond ONLY in this exact JSON format:
{
  "doc_type": "<one of: aadhar, pan, driving_license, passport, passport_photo, medical_slip, other>",
  "confident": <true or false>,
  "description": "<1-line summary e.g. 'Aadhar card of Rahul Kumar, DOB 12/05/1990'>",
  "extracted_text": "<ALL text visible in the document: name, ID numbers, DOB, address, issuer, doctor, hospital, medicines, vehicle class, expiry — everything>",
  "questions": []
}

Rules:
- extracted_text must be thorough — this is used for search. Include every readable field.
- Aadhar: name, 12-digit number, DOB, address, gender
- PAN: name, PAN number, DOB, father's name
- Driving License: name, DL number, DOB, vehicle classes, validity, address
- Passport: name, passport number, nationality, DOB, expiry, place of issue
- Medical slip: patient name, doctor name, hospital, date, medicines/tests
- Personal photo (portrait, no document text): extracted_text: "personal photo", questions: ["Who is this person? (enter their name)"]
- If genuinely unreadable: confident: false, questions: ["What is this document?"]
- NEVER ask what type it is if you can clearly see it
- Respond with ONLY the JSON, no extra text`;

  const result = await model.generateContent([
    { inlineData: { mimeType: mimetype === 'application/pdf' ? 'application/pdf' : mimetype, data: base64 } },
    { text: prompt }
  ]);

  const clean = result.response.text().trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(clean);
    if (!DOC_TYPES.includes(parsed.doc_type)) parsed.doc_type = 'other';
    return parsed;
  } catch (e) {
    return { doc_type: 'other', confident: false, description: '', extracted_text: '', questions: ['What is this document?'] };
  }
}

module.exports = { analyzeFile };
