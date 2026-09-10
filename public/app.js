let TOKEN = null;
let pendingFile = null;
let selectedDocType = 'aadhar';

const $ = (id) => document.getElementById(id);

function showScreen(id) {
  ['login-screen', 'otp-screen', 'chat-screen'].forEach(s => {
    const el = $(s);
    if (s === id) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}

// ── AUTH ──
let currentPhone = '';

$('send-otp-btn').onclick = async () => {
  const phone = $('phone-input').value.trim();
  if (!phone) return;
  currentPhone = phone;
  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const data = await res.json();
  if (!res.ok) { $('login-error').textContent = data.error; return; }
  $('otp-subtitle').textContent = `OTP bheja gaya: ${phone}` + (data.dev_otp ? ` (DEV: ${data.dev_otp})` : '');
  showScreen('otp-screen');
};

// OTP boxes logic
const otpBoxes = document.querySelectorAll('.otp-box');
otpBoxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    box.classList.toggle('filled', box.value.length > 0);
    if (box.value && i < otpBoxes.length - 1) otpBoxes[i + 1].focus();
    syncOtpInput();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && i > 0) otpBoxes[i - 1].focus();
  });
  box.addEventListener('paste', (e) => {
    const paste = e.clipboardData.getData('text').trim();
    if (paste.length === 4) {
      otpBoxes.forEach((b, j) => { b.value = paste[j] || ''; b.classList.toggle('filled', !!b.value); });
      syncOtpInput();
      otpBoxes[3].focus();
    }
    e.preventDefault();
  });
});

function syncOtpInput() {
  $('otp-input').value = Array.from(otpBoxes).map(b => b.value).join('');
}

$('verify-otp-btn').onclick = async () => {
  const otp = $('otp-input').value.trim();
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: currentPhone, otp })
  });
  const data = await res.json();
  if (!res.ok) { $('otp-error').textContent = data.error; return; }
  TOKEN = data.token;
  showScreen('chat-screen');
  addBotMessage('Hello! 👋 I am your personal document assistant. Upload any document or ask me anything!');
};

$('back-btn').onclick = () => showScreen('login-screen');

$('logout-btn').onclick = () => {
  TOKEN = null;
  $('chat-window').innerHTML = '';
  $('welcome-state') && $('chat-window').appendChild(createWelcomeState());
  showScreen('login-screen');
};

// ── CHAT UI ──
function createWelcomeState() {
  const div = document.createElement('div');
  div.className = 'welcome-state';
  div.id = 'welcome-state';
  div.innerHTML = `
    <div class="welcome-icon">📁</div>
    <h2>DocVault mein aapka swagat hai!</h2>
    <p>Apne documents upload karein ya neeche se query karein</p>
    <div class="quick-actions">
      <div class="quick-chip" data-query="mere saare documents dikhao">📋 Saare documents</div>
      <div class="quick-chip" data-query="aadhar dikhao">🪪 Aadhar Card</div>
      <div class="quick-chip" data-query="pan card dikhao">💳 PAN Card</div>
      <div class="quick-chip" data-query="driving license dikhao">🚗 Driving License</div>
    </div>`;
  div.querySelectorAll('.quick-chip').forEach(chip => {
    chip.onclick = () => sendMessage(chip.dataset.query);
  });
  return div;
}

function addUserMessage(text) {
  removeWelcomeState();
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = `<div class="msg-avatar">👤</div><div class="msg-bubble">${escHtml(text)}</div>`;
  $('chat-window').appendChild(div);
  scrollBottom();
}

function addBotMessage(text, fileUrl, mimetype) {
  removeWelcomeState();
  const div = document.createElement('div');
  div.className = 'msg bot';
  let fileHtml = '';
  if (fileUrl) {
    fileHtml = mimetype && mimetype.includes('pdf')
      ? `<embed src="${fileUrl}" type="application/pdf" />`
      : `<img src="${fileUrl}" alt="document" loading="lazy" />`;
  }
  div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-bubble">${escHtml(text)}${fileHtml}</div>`;
  $('chat-window').appendChild(div);
  scrollBottom();
  return div;
}

function addTypingIndicator() {
  removeWelcomeState();
  const div = document.createElement('div');
  div.className = 'msg bot typing-indicator';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  $('chat-window').appendChild(div);
  scrollBottom();
}

function removeTypingIndicator() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

function removeWelcomeState() {
  const el = $('welcome-state');
  if (el) el.remove();
}

function scrollBottom() {
  const w = $('chat-window');
  w.scrollTop = w.scrollHeight;
}

// Keep chat-window bottom in sync with actual input area height
(function() {
  const observer = new ResizeObserver(() => {
    const area = document.querySelector('.chat-input-area');
    const win = document.querySelector('.chat-window');
    if (area && win) win.style.bottom = area.offsetHeight + 'px';
  });
  document.addEventListener('DOMContentLoaded', () => {
    const area = document.querySelector('.chat-input-area');
    if (area) observer.observe(area);
  });
})();

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function fetchFileAsUrl(fileUrl) {
  const res = await fetch(fileUrl, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ── SEND MESSAGE ──
async function sendMessage(text) {
  if (!text) return;
  addUserMessage(text);
  $('text-input').value = '';
  addTypingIndicator();

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ message: text })
  });
  const data = await res.json();
  removeTypingIndicator();

  if (data.matched && data.file_url) {
    const blobUrl = await fetchFileAsUrl(data.file_url);
    addBotMessage(data.reply, blobUrl, data.document.mimetype);
  } else {
    addBotMessage(data.reply || data.error);
  }
}

$('chat-form').onsubmit = (e) => {
  e.preventDefault();
  sendMessage($('text-input').value.trim());
};

// Quick chips in welcome state
document.querySelectorAll('.quick-chip').forEach(chip => {
  chip.onclick = () => sendMessage(chip.dataset.query);
});

// ── SIDEBAR DOC LIST ──
const DOC_ICONS = { aadhar:'🪪', pan:'💳', driving_license:'🚗', passport:'📘', passport_photo:'🖼️', medical_slip:'🏥', other:'📁' };

$('docs-menu-item').onclick = () => {
  const list = $('doc-list');
  const item = $('docs-menu-item');
  const isOpen = !list.classList.contains('hidden');
  list.classList.toggle('hidden', isOpen);
  item.classList.toggle('open', !isOpen);
  if (!isOpen) loadDocList();
};

let pendingDeleteId = null;

$('delete-confirm-btn').onclick = async () => {
  if (!pendingDeleteId) return;
  const idToDelete = pendingDeleteId;
  pendingDeleteId = null;
  $('delete-modal').classList.add('hidden');
  await fetch(`/api/documents/${idToDelete}`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
  $('doc-list').classList.remove('hidden');
  $('docs-menu-item').classList.add('open');
  loadDocList();
};
$('delete-cancel-btn').onclick = () => { pendingDeleteId = null; $('delete-modal').classList.add('hidden'); };
$('delete-backdrop').onclick = () => { pendingDeleteId = null; $('delete-modal').classList.add('hidden'); };

async function loadDocList() {
  const res = await fetch('/api/documents', { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await res.json();
  const list = $('doc-list');
  list.innerHTML = '';
  if (!data.documents || data.documents.length === 0) {
    list.innerHTML = '<div class="doc-list-empty">No documents uploaded yet</div>';
    return;
  }  data.documents.forEach(doc => {
    const item = document.createElement('div');
    item.className = 'doc-list-item';
    const icon = DOC_ICONS[doc.doc_type] || '📁';
    const name = doc.label || doc.doc_type.replace(/_/g, ' ');
    const date = new Date(doc.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
    item.innerHTML = `
      <div class="doc-list-icon">${icon}</div>
      <div class="doc-list-info">
        <div class="doc-list-name">${name}</div>
        <div class="doc-list-meta">${doc.doc_type.replace(/_/g,' ')} · ${date}</div>
      </div>
      <button class="doc-list-del" data-id="${doc.id}" title="Delete">🗑️</button>`;
    item.querySelector('.doc-list-info').onclick = () => sendMessage(`show my ${doc.doc_type}${doc.label ? ' of ' + doc.label : ''}`);
    item.querySelector('.doc-list-del').onclick = (e) => {
      e.stopPropagation();
      pendingDeleteId = doc.id;
      $('delete-modal').classList.remove('hidden');
    };
    list.appendChild(item);
  });
}

// Sidebar toggle (mobile)
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('active');
}
$('sidebar-toggle').onclick = () => {
  document.querySelector('.sidebar').classList.toggle('open');
  $('sidebar-overlay').classList.toggle('active');
};
$('sidebar-close').onclick = closeSidebar;
$('sidebar-overlay').onclick = closeSidebar;

// ── FILE UPLOAD ──
let aiAnalysis = null;

const DOC_TYPE_LABELS = { aadhar:'Aadhar', pan:'PAN Card', driving_license:'Driving License', passport:'Passport', passport_photo:'Personal Photo', medical_slip:'Medical Slip', other:'Other' };
const DOC_ICONS_MAP = { aadhar:'🪪', pan:'💳', driving_license:'🚗', passport:'📘', passport_photo:'🖼️', medical_slip:'🏥', other:'📁' };

async function handleFileSelect(file) {
  if (!file) return;

  // Show scanning spinner in chat
  const scanMsg = addBotMessage('⏳ Scanning document...');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/documents/analyze', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');

    aiAnalysis = data;
    scanMsg.remove();

    // If AI identified the doc type → upload directly, no popup
    if (data.doc_type !== 'other') {
      await doUpload(false);
      return;
    }

    // Only show popup when AI genuinely couldn't identify
    $('unknown-answer').value = '';
    $('unknown-modal').classList.remove('hidden');
    setTimeout(() => $('unknown-answer').focus(), 100);

  } catch (err) {
    scanMsg.remove();
    addBotMessage('❌ Analysis failed: ' + err.message);
    aiAnalysis = null;
  }
}
  }
}

$('file-input').onchange = () => handleFileSelect($('file-input').files[0]);
$('file-input-2').onchange = () => handleFileSelect($('file-input-2').files[0]);

// Doc type grid selection
document.querySelectorAll('.doc-type-option').forEach(opt => {
  opt.onclick = () => {
    document.querySelectorAll('.doc-type-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedDocType = opt.dataset.value;
    $('doc-type-select').value = selectedDocType;
    const isPhoto = selectedDocType === 'passport_photo';
    $('label-field').classList.toggle('hidden', !isPhoto);
    if (!isPhoto) { $('label-input').value = ''; $('info-input').value = ''; }
  };
});

$('cancel-upload-btn').onclick = () => {
  pendingFile = null;
  $('file-input').value = '';
  $('file-input-2').value = '';
  $('upload-modal').classList.add('hidden');
};

// Unknown doc modal handlers
function closeUnknownModal() {
  $('unknown-modal').classList.add('hidden');
  $('file-input').value = '';
  $('file-input-2').value = '';
  aiAnalysis = null;
}
$('unknown-cancel-btn').onclick = closeUnknownModal;
$('unknown-backdrop').onclick = closeUnknownModal;
$('unknown-confirm-btn').onclick = async () => {
  const answer = $('unknown-answer').value.trim();
  if (!answer) { $('unknown-answer').focus(); return; }
  if (aiAnalysis) aiAnalysis.extra_info = answer;
  $('unknown-modal').classList.add('hidden');
  await doUpload(false);
};
$('unknown-answer').onkeydown = (e) => { if (e.key === 'Enter') $('unknown-confirm-btn').click(); };

async function doUpload(forceUpdate) {
  if (!aiAnalysis) return;
  const docType = aiAnalysis.doc_type || 'other';

  const body = {
    temp_path: aiAnalysis.temp_path,
    temp_filename: aiAnalysis.temp_filename,
    mimetype: aiAnalysis.mimetype,
    doc_type: docType,
    ai_description: aiAnalysis.description || '',
    extracted_text: aiAnalysis.extracted_text || '',
    extra_info: aiAnalysis.extra_info || undefined,
    force_update: forceUpdate ? 'true' : 'false'
  };

  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();

  if (res.status === 409) {
    $('upload-modal').classList.add('hidden');
    showReplaceModal(data.error === 'duplicate'
      ? 'This exact file already exists. Replace it?'
      : `A ${docType} is already saved. Update with this new one?`,
      () => doUpload(true)
    );
    return;
  }

  if (!res.ok) { $('upload-error') && ($('upload-error').textContent = data.error || 'Upload failed'); return; }

  $('upload-modal').classList.add('hidden');
  $('file-input').value = '';
  $('file-input-2').value = '';
  if (!$('doc-list').classList.contains('hidden')) loadDocList();
  addBotMessage(data.action === 'updated' ? `✅ ${docType} updated successfully!` : `✅ ${docType} saved! You can ask me for it anytime.`);
  aiAnalysis = null;
}

$('confirm-upload-btn').onclick = () => doUpload(false);

function showReplaceModal(message, onConfirm) {
  $('delete-modal').querySelector('p').textContent = message;
  $('delete-modal').querySelector('h3').textContent = 'Replace Document?';
  $('delete-modal').querySelector('div[style*="font-size:36px"]').textContent = '🔄';
  $('delete-confirm-btn').textContent = 'Replace';
  $('delete-confirm-btn').style.background = 'var(--accent)';
  pendingDeleteId = '__replace__';
  $('delete-modal').classList.remove('hidden');

  const original = $('delete-confirm-btn').onclick;
  $('delete-confirm-btn').onclick = async () => {
    $('delete-modal').classList.add('hidden');
    $('delete-confirm-btn').textContent = 'Delete';
    $('delete-confirm-btn').style.background = 'var(--error)';
    $('delete-modal').querySelector('h3').textContent = 'Delete Document?';
    $('delete-modal').querySelector('div[style*="font-size:36px"]').textContent = '🗑️';
    $('delete-modal').querySelector('p').textContent = 'This action cannot be undone.';
    $('delete-confirm-btn').onclick = original;
    await onConfirm();
  };
}
