const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('./auth');
const { upsertDocument, removeDocument } = require('../vectorStore');
const { analyzeFile } = require('../aiAnalyzer');

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_ROOT, String(req.userId));
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP or PDF allowed'));
  }
});

function fileHash(filepath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
}

// Step 1: AI analyze — called right after file is selected, before user confirms
router.post('/analyze', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const analysis = await analyzeFile(req.file.path, req.file.mimetype);
    // Keep the temp file, return temp path so upload can reuse it
    res.json({
      success: true,
      temp_path: req.file.path,
      temp_filename: req.file.filename,
      mimetype: req.file.mimetype,
      original_name: req.file.originalname,
      ...analysis
    });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ error: 'AI analysis failed', detail: err.message });
  }
});

// Step 2: Confirm upload — after user answers any questions
router.post('/upload', authMiddleware, async (req, res) => {
  const { temp_path, temp_filename, mimetype, doc_type, label, extra_info, ai_description, extracted_text, force_update } = req.body;
  const userId = req.userId;

  if (!temp_path || !fs.existsSync(temp_path)) return res.status(400).json({ error: 'File not found, please re-upload' });
  if (!doc_type) return res.status(400).json({ error: 'doc_type is required' });

  const hash = fileHash(temp_path);

  const existingSameType = db.prepare(
    'SELECT * FROM documents WHERE user_id = ? AND doc_type = ? ORDER BY created_at DESC'
  ).all(userId, doc_type);

  const exactDuplicate = existingSameType.find(d => d.filehash === hash);
  if (exactDuplicate && force_update !== 'true') {
    return res.status(409).json({ error: 'duplicate', message: 'This exact file already exists.' });
  }

  if (existingSameType.length > 0 && !exactDuplicate && force_update !== 'true') {
    return res.status(409).json({ error: 'type_exists', message: `A ${doc_type} already exists.` });
  }

  if (force_update === 'true' && existingSameType.length > 0) {
    const old = existingSameType[0];
    try { fs.unlinkSync(old.filepath); } catch (e) {}
    db.prepare(`UPDATE documents SET label=?, extra_info=?, ai_description=?, extracted_text=?, filename=?, filepath=?, filehash=?, mimetype=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(label || old.label, extra_info || old.extra_info, ai_description || old.ai_description, extracted_text || old.extracted_text, temp_filename, temp_path, hash, mimetype, old.id);
    const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(old.id);
    upsertDocument(updated).catch(console.error);
    return res.json({ success: true, action: 'updated', document: updated });
  }

  const info = db.prepare(`INSERT INTO documents (user_id, doc_type, label, extra_info, ai_description, extracted_text, filename, filepath, filehash, mimetype) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(userId, doc_type, label || null, extra_info || null, ai_description || null, extracted_text || null, temp_filename, temp_path, hash, mimetype);

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid);
  upsertDocument(doc).catch(console.error);
  res.json({ success: true, action: 'created', document: doc });
});

// List all documents
router.get('/', authMiddleware, (req, res) => {
  const docs = db.prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json({ documents: docs });
});

// Delete a document
router.delete('/:id', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  try { fs.unlinkSync(doc.filepath); } catch (e) {}
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  removeDocument(doc.id);
  res.json({ success: true });
});

// Serve file securely
router.get('/file/:id', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', doc.mimetype);
  res.sendFile(doc.filepath);
});

module.exports = router;
