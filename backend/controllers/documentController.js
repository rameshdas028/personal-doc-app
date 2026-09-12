const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { upsertDocument, removeDocument, getDocumentsByUser, getDocumentByHash, getDocumentsByType, getDocumentById } = require('../services/vectorStoreService');
const { WorkspaceMember } = require('../models/workspaceModel');
const { analyzeFile } = require('../services/aiAnalyzerService');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
let nextId = Date.now();
const generateId = () => ++nextId;

function fileHash(filepath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
}

async function findDocAcrossStores(docId, userId) {
  let doc = await getDocumentById(docId, userId);
  let storeId = userId;
  if (!doc) {
    const memberships = await WorkspaceMember.find({ userId, status: 'active' });
    for (const m of memberships) {
      doc = await getDocumentById(docId, m.workspaceId);
      if (doc) { storeId = m.workspaceId; break; }
    }
  }
  return { doc, storeId };
}

const analyzeDocument = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let analysis = { doc_type: 'document', confident: false, description: '', extracted_text: '', questions: [], ai_failed: true };
  try {
    analysis = await analyzeFile(req.file.path, req.file.mimetype);
  } catch (err) {
    console.warn('[Analyze] AI failed:', err.message);
  }

  if (analysis.is_informative === false) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(422).json({ error: 'This image has no document value. Only upload documents, bills, IDs, certificates, or official papers.' });
  }

  res.json({ success: true, temp_path: req.file.path, temp_filename: req.file.filename, mimetype: req.file.mimetype, original_name: req.file.originalname, needs_purpose: true, ...analysis });
};

const uploadDocument = async (req, res) => {
  const { temp_path, temp_filename, mimetype, doc_type, label, purpose, extra_info, ai_description, extracted_text, category, group_name, period, expiry_date, workspace_id } = req.body;
  const userId = req.userId;

  if (workspace_id) {
    const mem = await WorkspaceMember.findOne({ workspaceId: workspace_id, userId, status: 'active' });
    if (!mem) return res.status(403).json({ error: 'Not a member of this workspace' });
  }

  if (!temp_path || !fs.existsSync(temp_path)) return res.status(400).json({ error: 'File not found, please re-upload' });
  if (!doc_type) return res.status(400).json({ error: 'doc_type is required' });

  const hash = fileHash(temp_path);
  const storeId = workspace_id || userId;

  const exactDuplicate = await getDocumentByHash(hash, storeId);
  if (exactDuplicate) return res.json({ success: true, action: 'unchanged', document: exactDuplicate });

  const sameType = await getDocumentsByType(doc_type, storeId);
  const sameGroup = sameType.filter(d => (d.group_name || '') === (group_name || ''));

  if (sameGroup.length > 0) {
    const old = sameGroup[0];
    try { fs.unlinkSync(old.filepath); } catch (e) {}
    await removeDocument(old.doc_id, storeId);
    const doc = { id: parseInt(old.doc_id), user_id: userId, workspace_id: workspace_id || '', doc_type, category: category || old.category || 'other', group_name: group_name || old.group_name || '', period: period || old.period || '', expiry_date: expiry_date || old.expiry_date || '', is_favourite: old.is_favourite === 'true', label: label || old.label || '', purpose: purpose || old.purpose || '', extra_info: extra_info || '', ai_description: ai_description || old.ai_description || '', extracted_text: extracted_text || old.extracted_text || '', filename: temp_filename, filepath: temp_path, filehash: hash, mimetype, created_at: old.created_at };
    await upsertDocument(doc, storeId);
    return res.json({ success: true, action: 'updated', document: doc });
  }

  const id = generateId();
  const doc = { id, user_id: userId, workspace_id: workspace_id || '', doc_type, category: category || 'other', group_name: group_name || '', period: period || '', expiry_date: expiry_date || '', is_favourite: false, label: label || '', purpose: purpose || '', extra_info: extra_info || '', ai_description: ai_description || '', extracted_text: extracted_text || '', filename: temp_filename, filepath: temp_path, filehash: hash, mimetype, created_at: new Date().toISOString() };
  await upsertDocument(doc, storeId);
  res.json({ success: true, action: 'created', document: doc });
};

const listDocuments = async (req, res) => {
  const { workspace_id } = req.query;
  if (workspace_id) {
    const mem = await WorkspaceMember.findOne({ workspaceId: workspace_id, userId: req.userId, status: 'active' });
    if (!mem) return res.status(403).json({ error: 'Not a member' });
    return res.json({ documents: await getDocumentsByUser(workspace_id) });
  }
  res.json({ documents: await getDocumentsByUser(req.userId) });
};

const getExpiringDocuments = async (req, res) => {
  const days = parseInt(req.query.days || '30');
  const docs = await getDocumentsByUser(req.userId);
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const expiring = docs.filter(d => {
    if (!d.expiry_date) return false;
    const exp = new Date(d.expiry_date);
    return !isNaN(exp.getTime()) && exp >= now && exp <= cutoff;
  }).map(d => ({ ...d, days_left: Math.ceil((new Date(d.expiry_date) - now) / (1000 * 60 * 60 * 24)) }));
  res.json({ expiring });
};

const toggleFavourite = async (req, res) => {
  const { doc, storeId } = await findDocAcrossStores(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const newVal = doc.is_favourite !== 'true';
  await upsertDocument({ ...doc, id: doc.doc_id, user_id: req.userId, is_favourite: newVal, extracted_text: doc.extracted_text || '' }, storeId);
  res.json({ success: true, is_favourite: newVal });
};

const deleteDocument = async (req, res) => {
  const { doc, storeId } = await findDocAcrossStores(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  try { fs.unlinkSync(doc.filepath); } catch (e) {}
  await removeDocument(doc.doc_id, storeId);
  res.json({ success: true });
};

const serveFile = async (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-production';
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  let userId;
  try { userId = jwt.verify(token, JWT_SECRET).userId; } catch { return res.status(401).json({ error: 'Invalid token' }); }

  const { doc } = await findDocAcrossStores(req.params.id, userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (!fs.existsSync(doc.filepath)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Type', doc.mimetype);
  res.sendFile(path.resolve(doc.filepath));
};

module.exports = { analyzeDocument, uploadDocument, listDocuments, getExpiringDocuments, toggleFavourite, deleteDocument, serveFile };
