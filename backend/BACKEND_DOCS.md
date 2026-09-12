# Backend Documentation — ilovemydoc

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Database Design](#database-design)
4. [Vector Store (ChromaDB)](#vector-store-chromadb)
5. [AI / LLM Layer](#ai--llm-layer)
6. [API Reference](#api-reference)
7. [File Storage](#file-storage)
8. [Environment Variables](#environment-variables)
9. [Data Flow](#data-flow)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP REST
┌────────────────────────▼────────────────────────────────┐
│                  Express.js Server (:3000)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  /auth   │ │  /docs   │ │  /chat   │ │/workspaces│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└───────┬──────────────┬──────────────┬───────────────────┘
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼────────────────┐
│   MongoDB    │ │  ChromaDB  │ │   AI Layer (LLM)    │
│  (Users,     │ │  (Vector   │ │  Groq / Gemini /    │
│  Workspaces) │ │   Search)  │ │  OpenRouter Vision  │
└──────────────┘ └────────────┘ └─────────────────────┘
                        │
                 ┌──────▼──────┐
                 │  Local Disk │
                 │  (uploads/) │
                 └─────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ |
| Framework | Express.js |
| Primary DB | MongoDB (via Mongoose) |
| Vector DB | ChromaDB (semantic search) |
| Chat LLM | Groq `llama3-70b-8192` / Gemini `gemini-3.6-flash` |
| Vision AI | OpenRouter (image analysis) |
| Embeddings | Gemini `gemini-embedding-001` |
| Image Processing | Sharp (smart crop, trim) |
| PDF Parsing | pdfjs-dist |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| File Upload | Multer |

---

## Database Design

### MongoDB Collections

#### 1. `users`
```js
{
  _id:         ObjectId,
  firstName:   String (required),
  lastName:    String (required),
  phone:       String (unique, required),  // login identifier
  password:    String (bcrypt hashed),
  resetOtp:    String,                     // 4-digit OTP for password reset
  resetOtpExp: Date,                       // OTP expiry (5 min)
  created_at:  Date
}
```

#### 2. `workspaces`
```js
{
  _id:         ObjectId,
  name:        String (required),          // e.g. "My Family", "Office"
  owner_id:    String,                     // userId of creator
  invite_code: String (unique),            // 8-char code e.g. "A3F9B2C1"
  created_at:  Date
}
```

#### 3. `workspacemembers`
```js
{
  _id:          ObjectId,
  workspace_id: String (required),
  user_id:      String (required),
  role:         String (enum: 'owner' | 'member'),
  status:       String (enum: 'pending' | 'active'),
  joined_at:    Date,
  // Unique index on (workspace_id + user_id)
}
```

---

## Vector Store (ChromaDB)

Documents are stored as **vector embeddings** in ChromaDB for semantic search.

### Collection Naming
- Personal docs: `user_{userId}`
- Workspace docs: `user_{workspaceId}`

Each user/workspace gets an **isolated collection** — no cross-user data leakage.

### Document Schema (ChromaDB Metadata)
```js
{
  doc_id:         String,   // unique document ID
  user_id:        String,   // owner
  doc_type:       String,   // e.g. "aadhar", "pan", "gas_bill"
  category:       String,   // identity | bills | income | medical | vehicle | insurance | education | legal | other
  group_name:     String,   // entity name e.g. "HP Gas", "HDFC Bank"
  period:         String,   // "Jan 2025"
  expiry_date:    String,   // "2027-03-15"
  is_favourite:   String,   // "true" | "false"
  label:          String,   // human-readable name
  purpose:        String,
  ai_description: String,   // 1-line AI summary
  extracted_text: String,   // all OCR text (max 2000 chars)
  filename:       String,
  filepath:       String,   // absolute path on disk
  filehash:       String,   // SHA-256 for duplicate detection
  mimetype:       String,   // "image/jpeg" | "application/pdf"
  file_url:       String,   // "/api/documents/file/{id}"
  created_at:     String
}
```

### Vector Search Flow
```
User query → Gemini Embedding → ChromaDB cosine similarity → Top K results → LLM answer
```

---

## AI / LLM Layer

### `llm.js` — Model Factory

| Function | Purpose |
|---|---|
| `getChatModel()` | Returns chat LLM (Groq or Gemini) based on `.env` |
| `getEmbeddingModel()` | Returns embedding model (Gemini) |

### `aiAnalyzer.js` — Document Analysis Pipeline

```
Image Upload
    ↓
smartCrop()          ← sharp trim() removes blank margins
    ↓
analyzeImage()       ← Vision AI (OpenRouter) reads document
    ↓
Returns JSON:
  - doc_type         (aadhar / pan / gas_bill / ...)
  - category         (identity / bills / medical / ...)
  - group_name       (HP Gas / HDFC Bank / ...)
  - period           (Jan 2025)
  - expiry_date      (2027-03-15)
  - description      (1-line summary)
  - extracted_text   (all OCR text)
  - is_informative   (reject selfies/random images)
```

### `routes/chat.js` — Intent Parsing + RAG

```
User message
    ↓
parseIntent()        ← LLM classifies intent
    ↓
  wants_file?        → ChromaDB search → return document
  wants_list?        → filter all docs by category/type
  folder_query?      → list docs in category
  asking_category?   → which folder is this doc in?
  general question?  → top 3 docs context → LLM answer
```

---

## API Reference

### Auth — `/api/auth`

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/signup` | `{firstName, lastName, phone, password}` | Register new user |
| POST | `/login` | `{phone, password}` | Login, returns JWT |
| POST | `/forgot-password` | `{phone}` | Send reset OTP |
| POST | `/reset-password` | `{phone, otp, newPassword}` | Reset password |

**Auth Middleware** — All protected routes require:
```
Authorization: Bearer <jwt_token>
```

---

### Documents — `/api/documents`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/analyze` | ✅ | Upload file → AI scan → return analysis |
| POST | `/upload` | ✅ | Confirm upload with metadata |
| GET | `/` | ✅ | List all documents (`?workspace_id=` optional) |
| GET | `/expiring` | ✅ | Docs expiring within N days (`?days=30`) |
| GET | `/file/:id` | token param | Serve file securely |
| PATCH | `/:id/favourite` | ✅ | Toggle favourite |
| DELETE | `/:id` | ✅ | Delete document |

**Upload Flow (2-step):**
```
Step 1: POST /analyze   → returns temp_path + AI analysis
Step 2: POST /upload    → confirm with doc_type, label, etc.
```

**Duplicate Detection:**
- SHA-256 hash comparison → exact duplicate blocked
- Same `doc_type + group_name` → auto-replace (update)

---

### Chat — `/api/chat`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | ✅ | Send message, get AI response |

**Request Body:**
```json
{
  "message": "mera aadhar dikhao",
  "workspace_id": "optional_workspace_id",
  "history": [{"role": "user", "text": "..."}, ...],
  "last_category": "identity",
  "last_folder_docs": [{"doc_id": "...", "label": "..."}]
}
```

**Response:**
```json
{
  "reply": "Yeh raha aapka Aadhar Card...",
  "matched": true,
  "document": { ...doc_metadata },
  "file_url": "/api/documents/file/123",
  "folder_docs": [...],
  "last_category": "identity"
}
```

---

### Workspaces — `/api/workspaces`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | ✅ | Create workspace |
| GET | `/` | ✅ | List my workspaces |
| GET | `/:id/invite` | ✅ (owner) | Get invite code |
| POST | `/join` | ✅ | Join via invite code |
| GET | `/:id/members` | ✅ | List members |
| DELETE | `/:id/leave` | ✅ | Leave workspace |
| DELETE | `/:id` | ✅ (owner) | Delete workspace |

---

## File Storage

```
backend/uploads/
├── {userId}/              ← personal documents
│   ├── {uuid}.jpg
│   ├── {uuid}.pdf
│   └── ...
└── {workspaceId}/         ← workspace documents
    ├── {uuid}.png
    └── ...
```

- Max file size: **15 MB**
- Allowed types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Filename: UUID v4 + original extension
- File served via token-protected route only

---

## Environment Variables

```env
# Database
MONGO_URI=mongodb://localhost:27017/docvault
CHROMA_PORT=8000
CHROMA_HOST=localhost

# Auth
JWT_SECRET=your_secret_here

# AI Providers
CHAT_PROVIDER=groq                        # groq | gemini
CHAT_MODEL=llama3-70b-8192

EMBED_PROVIDER=gemini
EMBED_MODEL=gemini-embedding-001

VISION_PROVIDER=openrouter
VISION_MODEL_OPENROUTER=dots-studio/dots-3-note-preview:free

# API Keys
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=sk-or-v1-...

# Server
PORT=3000
FRONTEND_URL=http://localhost:3001
```

---

## Data Flow

### Document Upload Flow
```
1. User selects file
2. POST /api/documents/analyze
   → Multer saves to uploads/{userId}/
   → smartCrop() trims blank margins
   → Vision AI analyzes image/PDF
   → Returns: doc_type, category, extracted_text, expiry_date
3. Frontend shows AI result to user
4. POST /api/documents/upload (user confirms)
   → SHA-256 hash check (duplicate?)
   → Gemini embeds text
   → ChromaDB upsert
   → Document indexed for search
```

### Chat Query Flow
```
1. User types message
2. POST /api/chat
   → parseIntent() → LLM classifies (wants_file / wants_list / general)
   → wants_file: ChromaDB semantic search → top 5 results → match
   → wants_list: filter all docs by category/type
   → general: top 3 docs context → LLM generates answer
3. Response includes: reply text + file_url (if document found)
4. Frontend renders message bubble + document preview
```

### Workspace Invite Flow
```
1. Owner creates workspace → 8-char invite code generated
2. Owner shares code (copy button)
3. Member enters code → POST /api/workspaces/join
4. WorkspaceMember record created (status: active)
5. Member can now upload/chat in workspace
6. Workspace docs stored in ChromaDB collection: user_{workspaceId}
```

---

## Security Model

### Workspace Access — Every request checks membership

| Route | Check |
|---|---|
| `GET /documents?workspace_id=X` | `WorkspaceMember` active record required |
| `POST /documents/upload` (workspace) | `WorkspaceMember` active record required |
| `GET /documents/file/:id` | JWT verify + personal OR workspace membership |
| `PATCH /documents/:id/favourite` | JWT verify + personal OR workspace membership |
| `DELETE /documents/:id` | JWT verify + personal OR workspace membership |
| `GET /workspaces/:id/members` | Must be active member |
| `GET /workspaces/:id/invite` | Must be owner |
| `DELETE /workspaces/:id` | Must be owner |

### Non-invited user cannot:
- See workspace document list → `403 Not a member`
- Download any workspace file → `404 Not found`
- Join without valid invite code → `404 Invalid invite code`
- Guess workspace ID directly → ChromaDB collection isolated, no API exposes it

### ChromaDB Isolation
- Personal: `user_{userId}` — only that user's JWT can access
- Workspace: `user_{workspaceId}` — only active members can access
- No cross-collection queries exist in codebase

