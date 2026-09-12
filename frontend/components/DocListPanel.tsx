'use client';
import { useState } from 'react';
import { Doc, Workspace } from './ChatScreen';
import { apiFetch } from '@/lib/api';

const CAT_ICONS: Record<string, string> = {
  identity: '🪪', bills: '🧾', income: '💰', medical: '🏥',
  vehicle: '🚗', insurance: '🛡️', education: '🎓', legal: '⚖️', other: '📁',
};
const CAT_COLORS: Record<string, string> = {
  identity: '#7c6fef', bills: '#f59e0b', income: '#10b981', medical: '#ef4444',
  vehicle: '#3b82f6', insurance: '#8b5cf6', education: '#06b6d4', legal: '#6b7280', other: '#9ca3af',
};

const PAGE_SIZE = 10;

function Lightbox({ url, mimetype, onClose }: { url: string; mimetype?: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      <div onClick={e => e.stopPropagation()} style={{ width: '92vw', height: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mimetype?.includes('pdf')
          ? <iframe src={url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }} />
          : <img src={url} alt="doc" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, objectFit: 'contain' }} />
        }
      </div>
    </div>
  );
}

function DeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 24px', width: 300, textAlign: 'center', zIndex: 1, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ width: 52, height: 52, background: 'rgba(220,38,38,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 14px' }}>🗑️</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Delete Document?</div>
        <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 22 }}>This cannot be undone.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px', color: 'var(--text2)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, background: 'var(--error)', border: 'none', borderRadius: 10, padding: '10px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Doc row (list view) ──────────────────────────────────────────────────────
function DocRow({ doc, token, onFavourite, onDelete, onPreview }: {
  doc: Doc; token: string;
  onFavourite: () => void; onDelete: () => void; onPreview: () => void;
}) {
  const isFav = doc.is_favourite === 'true';
  const cat = doc.category || 'other';
  const now = new Date();
  const exp = doc.expiry_date ? new Date(doc.expiry_date) : null;
  const daysLeft = exp && !isNaN(exp.getTime()) && exp >= now
    ? Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const expBadge = daysLeft !== null && daysLeft <= 30 ? { days: daysLeft, color: daysLeft <= 7 ? '#ef4444' : '#fb923c' } : null;

  return (
    <div onClick={onPreview}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, marginBottom: 2, cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ width: 36, height: 36, background: `${CAT_COLORS[cat]}18`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
        {doc.mimetype?.includes('pdf') ? '📄' : '🖼️'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
          {doc.label || doc.doc_type.replace(/_/g, ' ')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
          {CAT_ICONS[cat]} {cat}{doc.period ? ` · ${doc.period}` : ''}
        </div>
      </div>
      {expBadge && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: expBadge.color, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{expBadge.days === 0 ? 'TODAY' : `${expBadge.days}d`}</span>}
      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>
        {new Date(doc.created_at).toLocaleDateString()}
      </span>
      <button onClick={e => { e.stopPropagation(); onFavourite(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? '#ef4444' : 'none'} stroke={isFav ? '#ef4444' : '#888'} strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--error)', padding: 4, flexShrink: 0, opacity: 0.5 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
      >🗑️</button>
    </div>
  );
}

// ── Doc card (folder-inside grid) ────────────────────────────────────────────
function DocCard({ doc, token, onFavourite, onDelete, onPreview }: {
  doc: Doc; token: string;
  onFavourite: () => void; onDelete: () => void; onPreview: () => void;
}) {
  const isFav = doc.is_favourite === 'true';
  const isPdf = doc.mimetype?.includes('pdf');
  const fileUrl = `${process.env.NEXT_PUBLIC_API_URL}${doc.file_url}?token=${token}`;

  return (
    <div onClick={onPreview} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.18s', position: 'relative' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Thumbnail */}
      <div style={{ height: 110, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {isPdf
          ? <div style={{ fontSize: 40 }}>📄</div>
          : <img src={fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        }
        {/* Fav button overlay */}
        <button onClick={e => { e.stopPropagation(); onFavourite(); }}
          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isFav ? '#ef4444' : 'none'} stroke={isFav ? '#ef4444' : '#fff'} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      {/* Info */}
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', marginBottom: 4 }}>
          {doc.label || doc.doc_type.replace(/_/g, ' ')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{doc.period || new Date(doc.created_at).toLocaleDateString()}</span>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--error)', padding: 2, opacity: 0.5 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
          >🗑️</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocListPanel({ docs, onBack, onQuery, onDelete, onFavourite, token, workspaces, activeWorkspace, onSwitchWorkspace, onWorkspaceCreated }: {
  docs: Doc[]; token: string;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSwitchWorkspace: (ws: Workspace | null) => void;
  onWorkspaceCreated: (ws: Workspace) => void;
  onBack: () => void; onQuery: (q: string) => void;
  onDelete: (id: string) => void; onFavourite: (id: string) => void;
}) {
  const [view, setView] = useState<'folders' | 'list'>('folders');
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; mimetype?: string } | null>(null);
  const [showNewWs, setShowNewWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [wsInviteCode, setWsInviteCode] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [wsError, setWsError] = useState('');

  async function createWorkspace() {
    if (!newWsName.trim()) return;
    try {
      const data = await apiFetch('/api/workspaces', { method: 'POST', body: JSON.stringify({ name: newWsName.trim() }) }, token);
      const inv = await apiFetch(`/api/workspaces/${data.workspace.id}/invite`, {}, token);
      setWsInviteCode(inv.invite_code);
      setNewWsName(''); setShowNewWs(false); setWsError('');
      onWorkspaceCreated(data.workspace);
    } catch (e: any) { setWsError(e.message); }
  }

  async function joinWorkspace() {
    if (!joinCode.trim()) return;
    try {
      const data = await apiFetch('/api/workspaces/join', { method: 'POST', body: JSON.stringify({ invite_code: joinCode.trim() }) }, token);
      setJoinCode(''); setShowJoin(false); setWsError('');
      onWorkspaceCreated(data.workspace);
    } catch (e: any) { setWsError(e.message); }
  }

  async function fetchInviteCode() {
    if (!activeWorkspace) return;
    try {
      const data = await apiFetch(`/api/workspaces/${activeWorkspace.id}/invite`, {}, token);
      setInviteCode(data.invite_code); setShowInvite(true);
    } catch (e: any) { setWsError(e.message); }
  }

  const q = search.toLowerCase().trim();
  const allFiltered = docs.filter(d =>
    !q ||
    (d.label || '').toLowerCase().includes(q) ||
    (d.doc_type || '').toLowerCase().includes(q) ||
    (d.category || '').toLowerCase().includes(q) ||
    (d.group_name || '').toLowerCase().includes(q) ||
    (d.period || '').toLowerCase().includes(q)
  );

  // Group by category
  const folders: Record<string, Doc[]> = {};
  allFiltered.forEach(d => {
    const cat = d.category || 'other';
    if (!folders[cat]) folders[cat] = [];
    folders[cat].push(d);
  });

  // List view pagination
  const totalPages = Math.ceil(allFiltered.length / PAGE_SIZE);
  const pageDocs = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); if (v) setOpenFolder(null); };
  const previewDoc = (doc: Doc) => setLightbox({ url: `${process.env.NEXT_PUBLIC_API_URL}${doc.file_url}?token=${token}`, mimetype: doc.mimetype });

  // Breadcrumb title
  const title = openFolder ? `${CAT_ICONS[openFolder] || '📁'} ${openFolder.charAt(0).toUpperCase() + openFolder.slice(1)}` : (activeWorkspace?.name || 'My Drive');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {lightbox && <Lightbox url={lightbox.url} mimetype={lightbox.mimetype} onClose={() => setLightbox(null)} />}
      {deleteId && <DeleteModal onConfirm={() => { onDelete(deleteId!); setDeleteId(null); }} onCancel={() => setDeleteId(null)} />}

      {/* Workspace created — show invite code */}
      {wsInviteCode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setWsInviteCode(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 24px', width: 320, textAlign: 'center', zIndex: 1 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Workspace Created!</div>
            <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>Share this invite code:</div>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px', fontSize: 24, fontWeight: 800, letterSpacing: 4, color: 'var(--accent)', marginBottom: 16 }}>{wsInviteCode}</div>
            <button onClick={() => navigator.clipboard.writeText(wsInviteCode)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 8 }}>Copy Code</button>
            <button onClick={() => setWsInviteCode(null)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 20px', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* Show invite code for existing workspace */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowInvite(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 24px', width: 300, textAlign: 'center', zIndex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🔗 Invite — {activeWorkspace?.name}</div>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px', fontSize: 24, fontWeight: 800, letterSpacing: 4, color: 'var(--accent)', marginBottom: 16 }}>{inviteCode}</div>
            <button onClick={() => navigator.clipboard.writeText(inviteCode)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 8 }}>Copy</button>
            <button onClick={() => setShowInvite(false)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 20px', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* Workspace switcher bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', overflowX: 'auto', flexShrink: 0 }}>
        <button onClick={() => { onSwitchWorkspace(null); setOpenFolder(null); }}
          style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: !activeWorkspace ? 'var(--accent)' : 'var(--bg3)', color: !activeWorkspace ? '#fff' : 'var(--text2)', whiteSpace: 'nowrap' }}
        >🏠 My Drive</button>
        {workspaces.map(ws => (
          <button key={ws.id} onClick={() => { onSwitchWorkspace(ws); setOpenFolder(null); }}
            style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeWorkspace?.id === ws.id ? 'var(--accent)' : 'var(--bg3)', color: activeWorkspace?.id === ws.id ? '#fff' : 'var(--text2)', whiteSpace: 'nowrap' }}
          >👥 {ws.name}</button>
        ))}
        <div style={{ flex: 1 }} />
        {activeWorkspace?.role === 'owner' && (
          <button onClick={fetchInviteCode} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: 'var(--bg3)', color: 'var(--text2)', whiteSpace: 'nowrap' }}>🔗 Invite</button>
        )}
        {!showJoin ? (
          <button onClick={() => { setShowJoin(true); setShowNewWs(false); }} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: 'var(--bg3)', color: 'var(--text2)', whiteSpace: 'nowrap' }}>🔑 Join</button>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Invite code" autoFocus
              style={{ width: 100, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '4px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              onKeyDown={e => e.key === 'Enter' && joinWorkspace()}
            />
            <button onClick={joinWorkspace} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Join</button>
            <button onClick={() => setShowJoin(false)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>✕</button>
          </div>
        )}
        {!showNewWs ? (
          <button onClick={() => { setShowNewWs(true); setShowJoin(false); }} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 20, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: 'var(--bg3)', color: 'var(--text2)', whiteSpace: 'nowrap' }}>＋ New</button>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <input value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="Workspace name" autoFocus
              style={{ width: 120, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '4px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              onKeyDown={e => e.key === 'Enter' && createWorkspace()}
            />
            <button onClick={createWorkspace} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Create</button>
            <button onClick={() => setShowNewWs(false)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>✕</button>
          </div>
        )}
      </div>
      {wsError && <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--error)', background: 'rgba(220,38,38,0.08)', flexShrink: 0 }}>{wsError} <button onClick={() => setWsError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: 11 }}>✕</button></div>}

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={openFolder ? () => setOpenFolder(null) : onBack}
          style={{ width: 36, height: 36, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text2)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)'; }}
        >←</button>

        {/* Breadcrumb */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {openFolder && (
            <>
              <span onClick={() => setOpenFolder(null)} style={{ fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontWeight: 500 }}>{activeWorkspace?.name || 'My Drive'}</span>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>›</span>
            </>
          )}
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3 }}>{title}</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--bg3)', borderRadius: 8, padding: '2px 7px', marginLeft: 4 }}>
            {openFolder ? folders[openFolder]?.length || 0 : allFiltered.length} items
          </span>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
          {(['folders', 'list'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); setOpenFolder(null); }}
              style={{ width: 30, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', background: view === v ? 'var(--bg2)' : 'transparent', color: view === v ? 'var(--accent)' : 'var(--text3)', boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}
            >
              {v === 'folders' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text3)', pointerEvents: 'none' }}>🔍</span>
          <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search documents..."
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 32px 8px 32px', fontSize: 13, color: 'var(--text)', outline: 'none', transition: 'border-color 0.15s' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          {search && <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text3)', padding: 2 }}>✕</button>}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {allFiltered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--text3)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{search ? '🔍' : '📭'}</div>
            <div style={{ fontSize: 14 }}>{search ? `No results for "${search}"` : 'No documents yet'}</div>
          </div>
        )}

        {/* ── FOLDERS VIEW ── */}
        {view === 'folders' && allFiltered.length > 0 && (
          <>
            {!openFolder ? (
              // Folder grid
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Folders</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
                  {Object.entries(folders).map(([cat, catDocs]) => {
                    const color = CAT_COLORS[cat] || '#9ca3af';
                    return (
                      <div key={cat} onClick={() => setOpenFolder(cat)}
                        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 12px', cursor: 'pointer', transition: 'all 0.18s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${color}22`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{CAT_ICONS[cat] || '📁'}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3, textTransform: 'capitalize' }}>{cat}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{catDocs.length} file{catDocs.length !== 1 ? 's' : ''}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              // Inside folder — doc cards grid
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {folders[openFolder]?.length} files
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {(folders[openFolder] || []).map(doc => (
                    <DocCard key={doc.doc_id} doc={doc} token={token}
                      onPreview={() => previewDoc(doc)}
                      onFavourite={() => onFavourite(doc.doc_id)}
                      onDelete={() => setDeleteId(doc.doc_id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && allFiltered.length > 0 && (
          <>
            {/* Column headers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 14px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
              <div style={{ width: 36, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Name</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, minWidth: 70, textAlign: 'right' }}>Date</div>
              <div style={{ width: 60, flexShrink: 0 }} />
            </div>
            {pageDocs.map(doc => (
              <DocRow key={doc.doc_id} doc={doc} token={token}
                onPreview={() => previewDoc(doc)}
                onFavourite={() => onFavourite(doc.doc_id)}
                onDelete={() => setDeleteId(doc.doc_id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Pagination — list view only */}
      {view === 'list' && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: page === 1 ? 'var(--text3)' : 'var(--text)', cursor: page === 1 ? 'default' : 'pointer', fontSize: 14 }}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer', background: page === p ? 'var(--accent)' : 'var(--bg3)', color: page === p ? '#fff' : 'var(--text2)', fontWeight: page === p ? 700 : 400 }}>{p}</button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: page === totalPages ? 'var(--text3)' : 'var(--text)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 14 }}>›</button>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>{page} / {totalPages}</span>
        </div>
      )}
    </div>
  );
}
