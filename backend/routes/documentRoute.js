const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/authMiddleware');
const { analyzeDocument, uploadDocument, listDocuments, getExpiringDocuments, toggleFavourite, deleteDocument, serveFile } = require('../controllers/documentController');

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOAD_ROOT, String(req.userId));
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP or PDF allowed'));
  },
});

router.post('/analyze',        authMiddleware, upload.single('file'), analyzeDocument);
router.post('/upload',         authMiddleware, uploadDocument);
router.get('/',                authMiddleware, listDocuments);
router.get('/expiring',        authMiddleware, getExpiringDocuments);
router.get('/file/:id',        serveFile);
router.patch('/:id/favourite', authMiddleware, toggleFavourite);
router.delete('/:id',          authMiddleware, deleteDocument);

module.exports = router;
