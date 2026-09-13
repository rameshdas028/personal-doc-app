'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import DocListPanel from './DocListPanel';
import WorkspaceInfoPanel from './WorkspaceInfoPanel';
import { useTheme } from '@/components/ThemeProvider';

export interface Message {
  role: 'user' | 'bot';
  text: string;
  fileUrl?: string;
  mimetype?: string;
  isScanning?: boolean;
  previewUrl?: string;
  folderDocs?: { doc_id: string; label: string; doc_type: string; mimetype: string; file_url: string; category: string; period: string }[];
}

export interface Doc {
  doc_id: string; doc_type: string; category: string; group_name: string;
  period: string; expiry_date: string; extracted_text: string;
  is_favourite: string; label: string | null; ai_description: string | null;
  created_at: string; mimetype: string; file_url: string;
}

export interface Workspace {
  id: string; name: string; owner_id: string;
  role: 'owner' | 'member'; created_at: string;
}

type MessageStore = Record<string, Message[]>;

// ── Helpers ──────────────────────────────────────────────────────────────────
function getToken() {
  try { return JSON.parse(localStorage.getItem('auth') || '{}').state?.token || ''; } catch { return ''; }
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const colors = ['#00a884','#0063cb','#7c3aed','#db2777','#ea580c','#16a34a'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Left Panel ────────────────────────────────────────────────────────────────
function LeftPanel({ phone, workspaces, activeId, onSelect, onLogout, onWorkspaceCreated, messageStore }: {
  phone: string; workspaces: Workspace[];
  activeId: string | null;
  onSelect: (id: string | null, ws: Workspace | null) => void;
  onLogout: () => void;
  onWorkspaceCreated: (ws: Workspace) => void;
  messageStore: MessageStore;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const { theme, toggle } = useTheme();

  async function createWs() {
    if (!newName.trim()) return;
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onWorkspaceCreated(d.workspace);
      setNewName(''); setShowNew(false); setError('');
    } catch (e: any) { setError(e.message); }
  }

  async function joinWs() {
    if (!joinCode.trim()) return;
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workspaces/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ invite_code: joinCode.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onWorkspaceCreated(d.workspace);
      setJoinCode(''); setShowJoin(false); setError('');
    } catch (e: any) { setError(e.message); }
  }

  const items = [
    { id: 'personal', name: 'My Drive', sub: 'Personal documents', ws: null },
    ...workspaces.map(ws => ({ id: ws.id, name: ws.name, sub: ws.role, ws })),
  ];

  return (
    <div style={{ height: '100vh', background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* Header */}
      <div style={{ padding: '10px 16px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <Avatar name={phone || 'U'} size={40} />
        <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>ilovemydoc</div>
        <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 18, padding: 6, borderRadius: '50%' }}
          title="Toggle theme"
        >{theme === 'dark' ? '☀️' : '🌙'}</button>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 6, borderRadius: '50%' }} title="Logout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>

      {/* Search bar style */}
      <div style={{ padding: '8px 12px', background: 'var(--bg2)', flexShrink: 0 }}>
        <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>Search or start new chat</span>
        </div>
      </div>

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {items.map((item, idx) => {
          const isActive = item.id === activeId;
          const msgs = messageStore[item.id] || [];
          const lastMsg = msgs.filter(m => !m.isScanning).slice(-1)[0];
          const unread = msgs.filter(m => m.role === 'bot' && !m.isScanning).length;
          const gradients = [
            'linear-gradient(135deg,#fc4355,#d62d3e)',
            'linear-gradient(135deg,#00a8f3,#0081bc)',
            'linear-gradient(135deg,#f59e0b,#d97706)',
            'linear-gradient(135deg,#10b981,#059669)',
            'linear-gradient(135deg,#8b5cf6,#7c3aed)',
          ];
          const grad = item.id === 'personal' ? 'linear-gradient(135deg,#fc4355,#d62d3e)' : gradients[idx % gradients.length];
          const lastText = lastMsg ? (lastMsg.text || '📎 File').replace(/\*\*/g, '').slice(0, 40) : item.sub;
          const lastTime = lastMsg ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          return (
            <div key={item.id} onClick={() => onSelect(item.id, item.ws)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', cursor: 'pointer',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {/* Avatar with online dot */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: '50%',
                  background: grad,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: '#fff',
                  boxShadow: isActive ? `0 0 0 2px var(--accent)` : 'none',
                  transition: 'box-shadow 0.15s',
                }}>
                  {item.id === 'personal' ? '🏠' : item.name.charAt(0).toUpperCase()}
                </div>
                {/* Online dot */}
                <div style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 11, height: 11, borderRadius: '50%',
                  background: 'var(--success)',
                  border: '2px solid var(--bg2)',
                }} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 11, color: isActive ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }}>{lastTime}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                    {lastMsg?.role === 'user' && <span style={{ color: 'var(--accent)', marginRight: 3 }}>✓✓</span>}
                    {lastText}
                  </span>
                  {unread > 0 && !isActive && (
                    <span style={{
                      background: 'var(--accent)', color: '#fff',
                      borderRadius: '50%', minWidth: 18, height: 18,
                      fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px', flexShrink: 0,
                    }}>{unread > 99 ? '99+' : unread}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* New / Join */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          {!showNew && !showJoin ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNew(true)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              >＋ New group</button>
              <button onClick={() => setShowJoin(true)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              >🔑 Join group</button>
            </div>
          ) : showNew ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name" autoFocus
                style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && createWs()}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={createWs} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Create</button>
                <button onClick={() => { setShowNew(false); setError(''); }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter invite code" autoFocus
                style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                onKeyDown={e => e.key === 'Enter' && joinWs()}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={joinWs} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Join</button>
                <button onClick={() => { setShowJoin(false); setError(''); }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          {error && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Empty right panel ─────────────────────────────────────────────────────────
function EmptyPanel() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 16 }}>
      <div style={{ fontSize: 80 }}>📁</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>ilovemydoc</div>
      <div style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        Select a drive or group from the left to start chatting with your documents
      </div>
      <div style={{ marginTop: 8, padding: '6px 16px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
        🔒 End-to-end encrypted
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { token, phone, logout } = useAuthStore();
  const { theme } = useTheme();

  const [messageStore, setMessageStore] = useState<MessageStore>({ personal: [] });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>('personal');
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [showDrive, setShowDrive] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false); // mobile: show right panel
  const [pendingClarification, setPendingClarification] = useState<{ originalMessage: string; question: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const lastCategoryRef = useRef<string | null>(null);
  const lastFolderDocsRef = useRef<{ doc_id: string; label: string }[]>([]);

  const messages = messageStore[activeId ?? ''] || [];

  function addMessage(msg: Message) {
    if (!activeId) return;
    setMessageStore(prev => ({ ...prev, [activeId]: [...(prev[activeId] || []), msg] }));
  }

  useEffect(() => { loadWorkspaces(); loadExpiryAlerts(); }, []);
  useEffect(() => { if (activeId) loadDocs(); lastCategoryRef.current = null; lastFolderDocsRef.current = []; setPendingClarification(null); setShowInfo(false); if (activeWorkspace) loadMembers(); }, [activeId]);

  async function loadMembers() {
    try {
      const data = await apiFetch(`/api/workspaces/${activeWorkspace?.id}/members`, {}, token);
      setMembers(data.members || []);
    } catch {}
  }

  async function loadWorkspaces() {
    try {
      const data = await apiFetch('/api/workspaces', {}, token);
      setWorkspaces(data.workspaces || []);
    } catch {}
  }

  async function loadExpiryAlerts() {
    try {
      const data = await apiFetch('/api/documents/expiring?days=30', {}, token);
      if (data.expiring?.length) {
        const lines = data.expiring.map((d: any) => {
          const name = d.label || d.group_name || d.doc_type.replace(/_/g, ' ');
          return `⚠️ **${name}** — expires in ${d.days_left} day${d.days_left === 1 ? '' : 's'} (${d.expiry_date})`;
        });
        setMessageStore(prev => ({ ...prev, personal: [...(prev.personal || []), { role: 'bot', text: `🔔 **Expiry Alerts:**\n${lines.join('\n')}` }] }));
      }
    } catch {}
  }

  async function loadDocs() {
    try {
      const url = activeWorkspace ? `/api/documents?workspace_id=${activeWorkspace.id}` : '/api/documents';
      const data = await apiFetch(url, {}, token);
      setDocs(data.documents || []);
    } catch {}
  }

  function selectChat(id: string | null, ws: Workspace | null) {
    setActiveId(id);
    setActiveWorkspace(ws);
    setShowDrive(false);
    setShowChat(true); // mobile: slide to chat
  }

  async function sendMessage(text: string, clarification?: string) {
    if (!text.trim() || !activeId) return;
    addMessage({ role: 'user', text: clarification ? clarification : text });
    try {
      const body: any = clarification ? { message: text, clarification } : { message: text };
      if (activeWorkspace) body.workspace_id = activeWorkspace.id;
      if (lastCategoryRef.current) body.last_category = lastCategoryRef.current;
      if (lastFolderDocsRef.current.length) body.last_folder_docs = lastFolderDocsRef.current;
      body.history = messages.slice(-6).map(m => ({ role: m.role, text: m.text || '' }));

      const data = await apiFetch('/api/chat', { method: 'POST', body: JSON.stringify(body) }, token);

      if (data.needs_clarification) {
        addMessage({ role: 'bot', text: data.question });
        setPendingClarification({ originalMessage: text, question: data.question });
        return;
      }
      setPendingClarification(null);
      if (data.last_category) lastCategoryRef.current = data.last_category;
      else if (data.matched) lastCategoryRef.current = data.document?.category || null;
      else if (data.folder_used) lastCategoryRef.current = data.folder_used;
      if (data.folder_docs) lastFolderDocsRef.current = data.folder_docs;
      else if (data.matched) lastFolderDocsRef.current = [];

      addMessage({
        role: 'bot', text: data.reply,
        fileUrl: data.file_url ? `${process.env.NEXT_PUBLIC_API_URL}${data.file_url}?token=${token}` : undefined,
        mimetype: data.document?.mimetype,
        folderDocs: data.folder_docs?.length ? data.folder_docs : undefined,
      });
    } catch (e: any) { addMessage({ role: 'bot', text: '❌ ' + e.message }); }
  }

  async function handleFile(file: File) {
    if (!activeId) return;
    setUploading(true);
    addMessage({ role: 'user', text: file.name, previewUrl: URL.createObjectURL(file), mimetype: file.type });
    addMessage({ role: 'bot', text: '', isScanning: true });
    try {
      const fd = new FormData(); fd.append('file', file);
      const data = await apiFetch('/api/documents/analyze', { method: 'POST', body: fd }, token);
      setMessageStore(prev => ({ ...prev, [activeId]: (prev[activeId] || []).filter(m => !m.isScanning) }));
      doUpload(data);
    } catch (e: any) {
      setMessageStore(prev => ({ ...prev, [activeId]: (prev[activeId] || []).filter(m => !m.isScanning) }));
      addMessage({ role: 'bot', text: '❌ ' + e.message });
    }
    setUploading(false);
  }

  async function doUpload(ai: any) {
    try {
      const body = {
        temp_path: ai.temp_path, temp_filename: ai.temp_filename, mimetype: ai.mimetype,
        doc_type: ai.doc_type, category: ai.category || 'other', group_name: ai.group_name || '',
        period: ai.period || '', expiry_date: ai.expiry_date || '',
        label: ai.description || '', ai_description: ai.description || '',
        extracted_text: ai.extracted_text || '', purpose: '', force_update: 'false',
        ...(activeWorkspace ? { workspace_id: activeWorkspace.id } : {}),
      };
      const data = await apiFetch('/api/documents/upload', { method: 'POST', body: JSON.stringify(body) }, token);
      addMessage({ role: 'bot', text: data.action === 'updated' ? `✅ Updated!` : data.action === 'unchanged' ? `ℹ️ Already up to date.` : `✅ ${ai.doc_type} saved!` });
      loadDocs();
    } catch (e: any) { addMessage({ role: 'bot', text: '❌ ' + e.message }); }
  }

  async function toggleFavourite(id: string) { try { await apiFetch(`/api/documents/${id}/favourite`, { method: 'PATCH' }, token); loadDocs(); } catch {} }
  async function deleteDoc(id: string) { try { await apiFetch(`/api/documents/${id}`, { method: 'DELETE' }, token); loadDocs(); } catch {} }

  const activeName = activeWorkspace?.name ?? (activeId === 'personal' ? 'My Drive' : '');

  return (
    <div className="app-layout">

      {/* LEFT — WhatsApp sidebar */}
      <div className={`left-panel${showChat ? ' hidden' : ''}`}>
        <LeftPanel
          phone={phone!}
          workspaces={workspaces}
          activeId={activeId}
          onSelect={selectChat}
          onLogout={logout}
          onWorkspaceCreated={(ws) => { setWorkspaces(prev => [...prev, ws]); selectChat(ws.id, ws); }}
          messageStore={messageStore}
        />
      </div>

      {/* RIGHT — chat */}
      <div className={`right-panel${showChat ? ' active' : ''}`}>
        {!activeId ? <EmptyPanel /> : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

            {/* Chat header */}
            <div style={{ padding: '10px 16px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              {/* Back button — mobile only */}
              <button onClick={() => setShowChat(false)} className="back-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: '4px 8px 4px 0' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              {/* Clickable avatar/name — opens info panel for workspaces */}
              <div onClick={() => activeWorkspace && setShowInfo(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: activeWorkspace ? 'pointer' : 'default' }}
              >
                <Avatar name={activeName} size={40} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{activeName}</div>
                  <div style={{ fontSize: 12, color: 'var(--accent)' }}>
                    {activeWorkspace ? `${members?.length || ''} members · ${docs.length} docs` : `${docs.length} documents`}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDrive(v => !v)}
                style={{ background: showDrive ? 'var(--accent)' : 'none', border: 'none', cursor: 'pointer', color: showDrive ? '#fff' : 'var(--text2)', padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}
              >🗂️</button>
            </div>

          <div style={{ flex: 1, display: 'flex', height: 'calc(100vh - 57px)', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Body */}
            {showDrive ? (
              <DocListPanel
                docs={docs} token={token!}
                workspaces={workspaces} activeWorkspace={activeWorkspace}
                onSwitchWorkspace={(ws) => { setActiveWorkspace(ws); }}
                onWorkspaceCreated={(ws) => { setWorkspaces(prev => [...prev, ws]); setActiveWorkspace(ws); }}
                onBack={() => setShowDrive(false)}
                onQuery={(q) => { setShowDrive(false); sendMessage(q); }}
                onDelete={deleteDoc} onFavourite={toggleFavourite}
              />
            ) : (
              <>
                <ChatWindow messages={messages} token={token!} />
                <ChatInput
                  onSend={(text) => {
                    if (pendingClarification) sendMessage(pendingClarification.originalMessage, text);
                    else sendMessage(text);
                  }}
                  onFile={handleFile}
                  disabled={uploading}
                />
              </>
            )}
            </div>

            {/* Workspace info panel */}
            {showInfo && activeWorkspace && (
              <WorkspaceInfoPanel
                workspace={activeWorkspace}
                token={token!}
                docCount={docs.length}
                onClose={() => setShowInfo(false)}
                onWorkspaceUpdated={(ws) => { setActiveWorkspace(ws); setWorkspaces(prev => prev.map(w => w.id === ws.id ? ws : w)); }}
                onWorkspaceDeleted={() => { setShowInfo(false); setActiveWorkspace(null); setActiveId(null); setWorkspaces(prev => prev.filter(w => w.id !== activeWorkspace.id)); }}
              />
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
