const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('./auth');
const { upsertDocument, removeDocument, getDocumentsByUser, getDocumentByHash, getDocumentsByType, getDocumentById } = require('../vectorStore');
const { WorkspaceMember } = require('../db');
const { analyzeFile } = require('../aiAnalyzer');

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

let nextId = Date.now(); // simple unique ID without SQLite
function generateId() { return ++nextId; }

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

// Step 1: Upload + AI scan
router.post('/analyze', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let analysis = { doc_type: 'document', confident: false, description: '', extracted_text: '', questions: [], ai_failed: true };

  try {
    analysis = await analyzeFile(req.file.path, req.file.mimetype);
  } catch (err) {
    console.warn('[Analyze] AI failed:', err.message);
  }

  // Reject non-informative images
  if (analysis.is_informative === false) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(422).json({ error: 'This image has no document value. Only upload documents, bills, IDs, certificates, or official papers.' });
  }

  res.json({
    success: true,
    temp_path: req.file.path,
    temp_filename: req.file.filename,
    mimetype: req.file.mimetype,
    original_name: req.file.originalname,
    needs_purpose: true,
    ...analysis,
  });
});

// List expiring documents (within N days)
router.get('/expiring', authMiddleware, async (req, res) => {
  const days = parseInt(req.query.days || '30');
  const docs = await getDocumentsByUser(req.userId);
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const expiring = docs.filter(d => {
    if (!d.expiry_date) return false;
    const exp = new Date(d.expiry_date);
    return !isNaN(exp.getTime()) && exp >= now && exp <= cutoff;
  }).map(d => ({
    ...d,
    days_left: Math.ceil((new Date(d.expiry_date) - now) / (1000 * 60 * 60 * 24)),
  }));
  res.json({ expiring });
});

// Step 2: Confirm upload with purpose
router.post('/upload', authMiddleware, async (req, res) => {
  const { temp_path, temp_filename, mimetype, doc_type, label, purpose, extra_info, ai_description, extracted_text, category, group_name, period, expiry_date, workspace_id } = req.body;
  const userId = req.userId;

  // If workspace_id given, verify membership
  if (workspace_id) {
    const mem = await WorkspaceMember.findOne({ workspace_id, user_id: userId, status: 'active' });
    if (!mem) return res.status(403).json({ error: 'Not a member of this workspace' });
  }

  if (!temp_path || !fs.existsSync(temp_path)) return res.status(400).json({ error: 'File not found, please re-upload' });
  if (!doc_type) return res.status(400).json({ error: 'doc_type is required' });

  const hash = fileHash(temp_path);

  // Scope: workspace docs use workspace collection, personal use userId
  const storeId = workspace_id || userId;

  // Check exact duplicate by hash
  const exactDuplicate = await getDocumentByHash(hash, storeId);
  if (exactDuplicate) {
    return res.json({ success: true, action: 'unchanged', document: exactDuplicate });
  }

  // Check same doc_type AND group_name — auto replace only if truly same document
  const sameType = await getDocumentsByType(doc_type, storeId);
  const sameGroup = sameType.filter(d => (d.group_name || '') === (group_name || ''));
  if (sameGroup.length > 0) {
    const old = sameGroup[0];
    try { fs.unlinkSync(old.filepath); } catch (e) {}
    await removeDocument(old.doc_id, storeId);

    const doc = {
      id: parseInt(old.doc_id),
      user_id: userId,
      workspace_id: workspace_id || '',
      doc_type,
      category: category || old.category || 'other',
      group_name: group_name || old.group_name || '',
      period: period || old.period || '',
      expiry_date: expiry_date || old.expiry_date || '',
      is_favourite: old.is_favourite === 'true',
      label: label || old.label || '',
      purpose: purpose || old.purpose || '',
      extra_info: extra_info || '',
      ai_description: ai_description || old.ai_description || '',
      extracted_text: extracted_text || old.extracted_text || '',
      filename: temp_filename,
      filepath: temp_path,
      filehash: hash,
      mimetype,
      created_at: old.created_at,
    };
    await upsertDocument(doc, storeId);
    return res.json({ success: true, action: 'updated', document: doc });
  }
  // New document
  const id = generateId();
  const doc = {
    id,
    user_id: userId,
    workspace_id: workspace_id || '',
    doc_type,
    category: category || 'other',
    group_name: group_name || '',
    period: period || '',
    expiry_date: expiry_date || '',
    is_favourite: false,
    label: label || '',
    purpose: purpose || '',
    extra_info: extra_info || '',
    ai_description: ai_description || '',
    extracted_text: extracted_text || '',
    filename: temp_filename,
    filepath: temp_path,
    filehash: hash,
    mimetype,
    created_at: new Date().toISOString(),
  };
  await upsertDocument(doc, storeId);
  res.json({ success: true, action: 'created', document: doc });
});

// List all documents (personal or workspace)
router.get('/', authMiddleware, async (req, res) => {
  const { workspace_id } = req.query;
  if (workspace_id) {
    const mem = await WorkspaceMember.findOne({ workspace_id, user_id: req.userId, status: 'active' });
    if (!mem) return res.status(403).json({ error: 'Not a member' });
    const docs = await getDocumentsByUser(workspace_id);
    return res.json({ documents: docs });
  }
  const docs = await getDocumentsByUser(req.userId);
  res.json({ documents: docs });
});

// Toggle favourite
router.patch('/:id/favourite', authMiddleware, async (req, res) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const newVal = doc.is_favourite !== 'true';
  await upsertDocument({ ...doc, id: doc.doc_id, user_id: req.userId, is_favourite: newVal, extracted_text: doc.extracted_text || '' });
  res.json({ success: true, is_favourite: newVal });
});

// Delete a document
router.delete('/:id', authMiddleware, async (req, res) => {
  const doc = await getDocumentById(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  try { fs.unlinkSync(doc.filepath); } catch (e) {}
  await removeDocument(doc.doc_id, req.userId);
  res.json({ success: true });
});

// Serve file securely — token via header OR query param (for img/iframe src)
router.get('/file/:id', async (req, res) => {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  let userId;
  try { userId = jwt.verify(token, JWT_SECRET).userId; } catch { return res.status(401).json({ error: 'Invalid token' }); }

  // Try personal first, then all workspaces user belongs to
  let doc = await getDocumentById(req.params.id, userId);
  if (!doc) {
    const memberships = await WorkspaceMember.find({ user_id: userId, status: 'active' });
    for (const m of memberships) {
      doc = await getDocumentById(req.params.id, m.workspace_id);
      if (doc) break;
    }
  }
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (!fs.existsSync(doc.filepath)) return res.status(404).json({ error: 'File not found on disk' });
  res.setHeader('Content-Type', doc.mimetype);
  res.sendFile(path.resolve(doc.filepath));
});

module.exports = router;
