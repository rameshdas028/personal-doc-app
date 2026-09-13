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

  let analysis = { docType: 'document', confident: false, description: '', extractedText: '', questions: [], aiFailed: true };
  try {
    analysis = await analyzeFile(req.file.path, req.file.mimetype);
  } catch (err) {
    console.warn('[Analyze] AI failed:', err.message);
  }

  if (analysis.isInformative === false) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(422).json({ error: 'This image has no document value. Only upload documents, bills, IDs, certificates, or official papers.' });
  }

  res.json({
    success: true,
    tempPath: req.file.path,
    tempFilename: req.file.filename,
    mimetype: req.file.mimetype,
    originalName: req.file.originalname,
    needsPurpose: true,
    ...analysis,
  });
};

const uploadDocument = async (req, res) => {
  const { tempPath, tempFilename, mimetype, docType, label, purpose, extraInfo, aiDescription, extractedText, category, groupName, period, expiryDate, workspaceId } = req.body;
  const userId = req.userId;

  if (workspaceId) {
    const mem = await WorkspaceMember.findOne({ workspaceId, userId, status: 'active' });
    if (!mem) return res.status(403).json({ error: 'Not a member of this workspace' });
  }

  if (!tempPath || !fs.existsSync(tempPath)) return res.status(400).json({ error: 'File not found, please re-upload' });
  if (!docType) return res.status(400).json({ error: 'docType is required' });

  const hash = fileHash(tempPath);
  const storeId = workspaceId || userId;

  const exactDuplicate = await getDocumentByHash(hash, storeId);
  if (exactDuplicate) return res.json({ success: true, action: 'unchanged', document: exactDuplicate });

  const sameType = await getDocumentsByType(docType, storeId);
  const sameGroup = sameType.filter(d => (d.groupName || '') === (groupName || ''));

  if (sameGroup.length > 0) {
    const old = sameGroup[0];
    try { fs.unlinkSync(old.filepath); } catch (e) {}
    await removeDocument(old.docId, storeId);
    const doc = {
      id: parseInt(old.docId), userId, workspaceId: workspaceId || '', docType,
      category: category || old.category || 'other', groupName: groupName || old.groupName || '',
      period: period || old.period || '', expiryDate: expiryDate || old.expiryDate || '',
      isFavourite: old.isFavourite === 'true', label: label || old.label || '',
      purpose: purpose || old.purpose || '', extraInfo: extraInfo || '',
      aiDescription: aiDescription || old.aiDescription || '',
      extractedText: extractedText || old.extractedText || '',
      filename: tempFilename, filepath: tempPath, filehash: hash, mimetype, createdAt: old.createdAt,
    };
    await upsertDocument(doc, storeId);
    return res.json({ success: true, action: 'updated', document: doc });
  }

  const id = generateId();
  const doc = {
    id, userId, workspaceId: workspaceId || '', docType,
    category: category || 'other', groupName: groupName || '',
    period: period || '', expiryDate: expiryDate || '',
    isFavourite: false, label: label || '', purpose: purpose || '',
    extraInfo: extraInfo || '', aiDescription: aiDescription || '',
    extractedText: extractedText || '', filename: tempFilename,
    filepath: tempPath, filehash: hash, mimetype, createdAt: new Date().toISOString(),
  };
  await upsertDocument(doc, storeId);
  res.json({ success: true, action: 'created', document: doc });
};

const listDocuments = async (req, res) => {
  const { workspaceId } = req.query;
  if (workspaceId) {
    const mem = await WorkspaceMember.findOne({ workspaceId, userId: req.userId, status: 'active' });
    if (!mem) return res.status(403).json({ error: 'Not a member' });
    return res.json({ documents: await getDocumentsByUser(workspaceId) });
  }
  res.json({ documents: await getDocumentsByUser(req.userId) });
};

const getExpiringDocuments = async (req, res) => {
  const days = parseInt(req.query.days || '30');
  const docs = await getDocumentsByUser(req.userId);
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const expiring = docs.filter(d => {
    if (!d.expiryDate) return false;
    const exp = new Date(d.expiryDate);
    return !isNaN(exp.getTime()) && exp >= now && exp <= cutoff;
  }).map(d => ({ ...d, daysLeft: Math.ceil((new Date(d.expiryDate) - now) / (1000 * 60 * 60 * 24)) }));
  res.json({ expiring });
};

const toggleFavourite = async (req, res) => {
  const { doc, storeId } = await findDocAcrossStores(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const newVal = doc.isFavourite !== 'true';
  await upsertDocument({ ...doc, id: doc.docId, userId: req.userId, isFavourite: newVal, extractedText: doc.extractedText || '' }, storeId);
  res.json({ success: true, isFavourite: newVal });
};

const deleteDocument = async (req, res) => {
  const { doc, storeId } = await findDocAcrossStores(req.params.id, req.userId);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  try { fs.unlinkSync(doc.filepath); } catch (e) {}
  await removeDocument(doc.docId, storeId);
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
