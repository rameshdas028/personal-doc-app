# ilovemydoc — Product Description

## What is it?
ilovemydoc is an AI-powered personal document vault web application.
Users can securely store, search, and retrieve all their important documents
in one place — and get automatic alerts before anything expires.

---

## The Problem it Solves
People lose important documents, forget expiry dates, and waste time
searching for the right file when needed urgently.

Examples:
- Passport expired — didn't know until airport
- Warranty card lost — can't claim repair
- Insurance policy due — missed renewal
- Need Aadhar copy urgently — can't find it

---

## Who is it For?
- Individuals who want to organize personal documents
- Families managing documents for multiple members
- Anyone who has ever missed an expiry date or lost an important file

---

## Core Features

### 1. AI Document Scanner
- Upload any image (JPG/PNG) or PDF
- AI automatically reads and understands the document
- Extracts: name, ID numbers, dates, address, issuer, amounts — everything
- Auto-categorizes: Identity / Bills / Medical / Insurance / Vehicle / Income etc.
- Rejects non-documents (selfies, random photos)

### 2. Chat-Based Retrieval
- ChatGPT-style interface
- Ask in plain language: "show my aadhar", "give me driving license", "electricity bill dikhao"
- AI finds and shows the exact document instantly
- Works in Hindi + English both

### 3. Smart Expiry Tracking
- AI extracts expiry date from every document automatically
  - Passport → expiry date
  - Driving license → renewal date
  - Insurance → due date
  - Electronics invoice → warranty end date (purchase date + warranty period)
  - Electricity bill → payment due date
- Sidebar shows "⚠️ Expiring Soon" section
- Login pe automatic alert: "Driving License expires in 7 days"
- Color-coded urgency: 🔴 ≤7 days, 🟠 ≤30 days

### 4. Powerful Search
- Search by name, ID number, address, date, amount — anything
- Works on full extracted text of every document
- Example: search "9876" → finds Aadhar with that number
- Example: search "apollo" → finds Apollo Hospital bills

### 5. Organized Sidebar
- Category → Group → Document tree structure
- Filter by: All / PDF / Image / Favourite
- Favourite documents with heart icon
- Delete with confirmation

### 6. Secure Access
- Every file is token-protected — only the owner can access
- JWT-based authentication
- Files served via secure authenticated routes

---

## Tech Stack
- **Frontend**: Next.js 14, TypeScript, React
- **Backend**: Node.js, Express
- **Database**: MongoDB (users) + ChromaDB (vector search)
- **AI**: OpenRouter Vision API (document scanning) + Groq (chat)
- **File Storage**: Local (upgradeable to AWS S3)

---

## Current Status
- Fully functional web app
- AI scanning, chat retrieval, expiry tracking, search — all working
- Ready for deployment

---

## What Makes it Different
| Feature | ilovemydoc | Google Drive | DigiLocker |
|---|---|---|---|
| AI auto-scan & extract | ✅ | ❌ | ❌ |
| Chat-based retrieval | ✅ | ❌ | ❌ |
| Expiry alerts | ✅ | ❌ | ❌ |
| Works for ALL doc types | ✅ | ✅ | ❌ (govt only) |
| Full text search | ✅ | ❌ | ❌ |
| Warranty tracking | ✅ | ❌ | ❌ |

---

## Monetization Potential
- Freemium: Free tier (limited docs) + Paid plan
- B2B: E-commerce plugin — auto-save invoices/warranties to user vault
- Browser Extension: Auto-capture orders from Amazon, Flipkart etc.
- White label: Sell to insurance companies, banks, hospitals

---

## Target Markets
- **Primary**: International users (US, UK, Canada, Australia) — organized, willing to pay
- **Secondary**: India — free tier for adoption and social proof
