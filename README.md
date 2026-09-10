# Personal Document Assistant

Ek ChatGPT-jaisa web app jisme user apna phone number + OTP se login karke apne
personal documents (Aadhar, PAN, Driving License, Passport, Personal Photos, Medical
Slips) upload kar sakta hai, aur baad mein chat ke through unhe wapas maang sakta hai.

---

## Features

| Feature | Detail |
|---|---|
| Login | Phone number + OTP (4-digit) based authentication |
| Chat UI | ChatGPT jaisa interface — text + file attach (📎) dono ek hi jagah |
| Document Upload | Image (JPG/PNG/WEBP) ya PDF upload, doc-type tag ke saath (Aadhar, PAN, DL, Passport, Photo, Medical Slip, Other) |
| Personal Photo Upload | Photo upload karte waqt system poochta hai — "Yeh kiska photo hai?" (naam) + extra info |
| Retrieval via Chat | Natural query se document milta hai — e.g. "Aadhar dikhao", "Driving license nikaalo", "Medical slip do" |
| Duplicate Detection | Same file dobara upload hone par system rok deta hai |
| Update Flow | Agar naya wala behtar hai to purana replace ho jata hai (force-update) |
| Secure File Access | Har file sirf uske owner (logged-in user) ko hi milti hai, token-protected route se |

---

## Project Structure

personal-doc-app/
├── server.js              # Main Express app entry point
├── db.js                  # SQLite schema (users, documents tables)
├── package.json           # Dependencies list
├── routes/
│   ├── auth.js             # OTP send/verify + JWT auth middleware
│   ├── documents.js        # Upload, duplicate/update logic, secure file serving
│   └── chat.js             # Keyword-based (Hindi+English) query → document retrieval
├── public/
│   ├── index.html           # Login + OTP + Chat screens
│   ├── style.css
│   └── app.js                # Frontend logic (auth flow, chat, upload modal)
└── uploads/                  # Uploaded files, per user_id folder

---

## Kaise Chalayein (Local Setup)

Requirement: Node.js v18 ya usse upar (npm bhi saath aata hai)

1. Project folder VS Code mein open karo
2. Terminal kholo (Ctrl + `) aur likho:
   npm install
   npm start
3. Terminal mein dikhega: "Server running at http://localhost:3000"
4. Browser mein http://localhost:3000 kholo
5. Koi bhi phone number daalo → OTP terminal (console) mein aur screen par bhi dikhega
   (kyunki abhi real SMS gateway connect nahi hai — ye dev-mode hai)
6. Login ke baad chat screen milegi — 📎 se file upload karo ya text se query karo

Database (app.db) aur uploads/ folder khud-ba-khud ban jayenge — koi extra
setup (cloud account, API key) local testing ke liye zaroori nahi hai.

---

## Kaise Use Karein

- Document upload: 📎 icon dabao → file choose karo → doc-type select karo
  (Aadhar / PAN / DL / Passport / Personal Photo / Medical Slip / Other) → agar
  "Personal Photo" chuna hai to naam bharna zaroori hai → Upload
- Document maangna: Chat box mein likho — "mujhe aadhar dikhao",
  "driving license nikaalo", "passport photo do" — system turant wahi file
  chat mein dikha dega
- Update karna: Same doc-type ka naya file upload karo → system poochega ki
  purana replace karna hai ya nahi → confirm karne par update ho jayega

---

## Production Mein Le Jaane Ke Liye Kya Chahiye

| Cheez | Kyun chahiye | Suggestion |
|---|---|---|
| Real SMS/OTP gateway | Abhi OTP sirf console/screen par dikhta hai | Twilio, MSG91, Fast2SMS, 2Factor.in |
| Cloud file storage | Local disk scalable/reliable nahi hai production ke liye | AWS S3, Cloudflare R2, Google Cloud Storage |
| Managed database | SQLite single-server ke liye theek hai | PostgreSQL / MySQL (Supabase, RDS, etc.) |
| HTTPS + domain | Sensitive documents http par bhejna unsafe hai | Nginx + Let's Encrypt, ya Vercel/Render |
| Encryption at rest | Aadhar/PAN/medical jaisi PII files encrypted honi chahiye | S3 server-side encryption ya app-level AES |
| Strong JWT secret | Abhi ek dev-secret hardcoded hai | .env file mein JWT_SECRET set karo |
| Rate limiting | OTP spam / brute-force se bachne ke liye | express-rate-limit middleware |
| Legal/compliance | India ke DPDP Act ke daayre mein aata hai | Privacy policy, consent flow, secure delete option |

---

## Aage Kya Improve Kar Sakte Hain (Optional)

- Claude Vision API se image upload hote hi khud detect ho jaye ki wo Aadhar hai ya passport photo
- Ek hi doc-type ke multiple versions/history rakhna (overwrite ki jagah)
- Real SMS gateway connect karna