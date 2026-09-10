const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'app.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    label TEXT,
    extra_info TEXT,
    ai_description TEXT,
    extracted_text TEXT,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filehash TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Add ai_description column if it doesn't exist (for existing DBs)
try { db.exec(`ALTER TABLE documents ADD COLUMN ai_description TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE documents ADD COLUMN extracted_text TEXT`); } catch(e) {}

module.exports = db;
