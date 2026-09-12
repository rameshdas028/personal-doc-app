'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import ChatInput from './ChatInput';
import DocListPanel from './DocListPanel';
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
  doc_id: string;
  doc_type: string;
  category: string;
  group_name: string;
  period: string;
  expiry_date: string;
  extracted_text: string;
  is_favourite: string;
  label: string | null;
  ai_description: string | null;
  created_at: string;
  mimetype: string;
  file_url: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  role: 'owner' | 'member';
  created_at: string;
}

// key = workspace id or 'personal'
type MessageStore = Record<string, Message[]>;

// ── Home landing page — shown when back is clicked ─────────────────────────────────
function HomeView({ workspaces, onSelect }: { workspaces: Workspace[]; onSelect: (ws: Workspace | null) => void }) {
  const allItems = [
    { ws: null as Workspace | null, name: 'My Drive', sub: 'Your personal documents', icon: '🏠', color: 'var(--gradient)' },
    ...workspaces.map(ws => ({ ws, name: ws.name, sub: `${ws.role} · shared workspace`, icon: '👥', color: 'var(--accent)' })),
  ];
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Good day! 👋</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28 }}>Select a drive to start chatting</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {allItems.map((item, i) => (
          <div key={item.ws?.id ?? 'personal'} onClick={() => onSelect(item.ws)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 18px', cursor: 'pointer', transition: 'all 0.18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(124,111,239,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 14 }}>{item.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatScreen() {
  const { token, phone, logout } = useAuthStore();
  const { theme, toggle } = useTheme();

  // Per-workspace message history
  const [messageStore, setMessageStore] = useState<MessageStore>({ personal: [] });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [view, setView] = useState<'home' | 'chat' | 'drive'>('chat'); // 'chat' = default after login
  const [pendingClarification, setPendingClarification] = useState<{ originalMessage: string; question: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const lastCategoryRef = useRef<string | null>(null);
  const lastFolderDocsRef = useRef<{ doc_id: string; label: string }[]>([]);

  const storeKey = activeWorkspace?.id ?? 'personal';
  const messages = messageStore[storeKey] || [];

  function addMessage(msg: Message) {
    setMessageStore(prev => ({ ...prev, [storeKey]: [...(prev[storeKey] || []), msg] }));
  }

  useEffect(() => { loadWorkspaces(); loadExpiryAlerts(); }, []);
  useEffect(() => { loadDocs(); lastCategoryRef.current = null; lastFolderDocsRef.current = []; setPendingClarification(null); }, [activeWorkspace]);

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
          return `⚠️ **${name}** — ${d.days_left === 0 ? 'expires today!' : `expires in ${d.days_left} day${d.days_left === 1 ? '' : 's'}`} (${d.expiry_date})`;
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

  async function sendMessage(text: string, clarification?: string) {
    if (!text.trim()) return;
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
        role: 'bot',
        text: data.reply,
        fileUrl: data.file_url ? `${process.env.NEXT_PUBLIC_API_URL}${data.file_url}?token=${token}` : undefined,
        mimetype: data.document?.mimetype,
        folderDocs: data.folder_docs?.length ? data.folder_docs : undefined,
      });
    } catch (e: any) {
      addMessage({ role: 'bot', text: '❌ ' + e.message });
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    addMessage({ role: 'user', text: file.name, previewUrl: URL.createObjectURL(file), mimetype: file.type });
    addMessage({ role: 'bot', text: '', isScanning: true });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiFetch('/api/documents/analyze', { method: 'POST', body: fd }, token);
      setMessageStore(prev => ({ ...prev, [storeKey]: (prev[storeKey] || []).filter(m => !m.isScanning) }));
      doUpload(data);
    } catch (e: any) {
      setMessageStore(prev => ({ ...prev, [storeKey]: (prev[storeKey] || []).filter(m => !m.isScanning) }));
      addMessage({ role: 'bot', text: '❌ ' + e.message });
    }
    setUploading(false);
  }

  async function doUpload(aiAnalysis: any, purpose?: string, docType?: string, forceUpdate = false, label?: string, description?: string) {
    try {
      const finalDocType = docType || aiAnalysis.doc_type;
      const body = {
        temp_path: aiAnalysis.temp_path, temp_filename: aiAnalysis.temp_filename,
        mimetype: aiAnalysis.mimetype, doc_type: finalDocType,
        category: aiAnalysis.category || 'other', group_name: aiAnalysis.group_name || '',
        period: aiAnalysis.period || '', expiry_date: aiAnalysis.expiry_date || '',
        label: label || aiAnalysis.description || '',
        ai_description: description || aiAnalysis.description || '',
        extracted_text: aiAnalysis.extracted_text || '',
        purpose: purpose || '', force_update: forceUpdate ? 'true' : 'false',
        ...(activeWorkspace ? { workspace_id: activeWorkspace.id } : {}),
      };
      const data = await apiFetch('/api/documents/upload', { method: 'POST', body: JSON.stringify(body) }, token);
      const msg = data.action === 'updated' ? `✅ ${finalDocType} updated!` : data.action === 'unchanged' ? `ℹ️ Already up to date.` : `✅ ${finalDocType} saved!`;
      addMessage({ role: 'bot', text: msg });
      loadDocs();
    } catch (e: any) {
      addMessage({ role: 'bot', text: '❌ ' + e.message });
    }
  }

  async function toggleFavourite(docId: string) {
    try { await apiFetch(`/api/documents/${docId}/favourite`, { method: 'PATCH' }, token); loadDocs(); } catch {}
  }

  async function deleteDoc(id: string) {
    try { await apiFetch(`/api/documents/${id}`, { method: 'DELETE' }, token); loadDocs(); } catch {}
  }

  const wsName = activeWorkspace?.name ?? 'My Drive';
  const wsIcon = activeWorkspace ? '👥' : '🏠';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Permanent left sidebar */}
      <Sidebar
        phone={phone!}
        workspaces={workspaces}
        activeWorkspace={view === 'home' ? undefined : activeWorkspace}
        onSelect={(ws) => { setActiveWorkspace(ws); setView('chat'); }}
        onLogout={logout}
        onWorkspaceCreated={(ws) => { setWorkspaces(prev => [...prev, ws]); setActiveWorkspace(ws); setView('chat'); }}
      />

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>

        {/* ── HOME VIEW: workspace grid landing page ── */}
        {view === 'home' && (
          <HomeView
            workspaces={workspaces}
            onSelect={(ws) => { setActiveWorkspace(ws); setView('chat'); }}
          />
        )}

        {/* ── CHAT / DRIVE VIEW ── */}
        {view !== 'home' && (
          <>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {/* Back button */}
              <button onClick={() => setView('home')}
                style={{ width: 36, height: 36, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text2)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)'; }}
              >←</button>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: activeWorkspace ? 'var(--accent)' : 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{wsIcon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{wsName}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {activeWorkspace ? `${activeWorkspace.role} · ${docs.length} docs` : `${docs.length} documents`}
                </div>
              </div>
              <button onClick={() => setView(view === 'drive' ? 'chat' : 'drive')} title="Browse files"
                style={{ width: 36, height: 36, background: view === 'drive' ? 'var(--accent-soft)' : 'var(--bg3)', border: `1px solid ${view === 'drive' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}
              >🗂️</button>
              <button onClick={toggle}
                style={{ width: 36, height: 36, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >{theme === 'dark' ? '☀️' : '🌙'}</button>
            </div>

            {view === 'drive' ? (
              <DocListPanel
                docs={docs} token={token!}
                workspaces={workspaces}
                activeWorkspace={activeWorkspace}
                onSwitchWorkspace={(ws) => { setActiveWorkspace(ws); }}
                onWorkspaceCreated={(ws) => { setWorkspaces(prev => [...prev, ws]); setActiveWorkspace(ws); }}
                onBack={() => setView('chat')}
                onQuery={(q) => { setView('chat'); sendMessage(q); }}
                onDelete={deleteDoc}
                onFavourite={toggleFavourite}
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
          </>
        )}
      </div>
    </div>
  );
}
