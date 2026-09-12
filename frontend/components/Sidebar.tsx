'use client';
import { useState } from 'react';
import { Workspace } from './ChatScreen';

export default function Sidebar({
  phone, workspaces, activeWorkspace, onSelect, onLogout, onWorkspaceCreated,
}: {
  phone: string;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null | undefined;
  onSelect: (ws: Workspace | null) => void;
  onLogout: () => void;
  onWorkspaceCreated: (ws: Workspace) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  function getToken() {
    try { return JSON.parse(localStorage.getItem('auth') || '{}').state?.token || ''; } catch { return ''; }
  }

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

  const allItems = [
    { ws: null, name: 'My Drive', sub: 'Personal documents', icon: '🏠' },
    ...workspaces.map(ws => ({ ws, name: ws.name, sub: ws.role, icon: '👥' })),
  ];

  return (
    <div style={{
      width: 300, flexShrink: 0, height: '100vh',
      background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>📁</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>ilovemydoc</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phone}</div>
        </div>
        <button onClick={onLogout} title="Logout"
          style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--error)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--error)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
        </button>
      </div>

      {/* Search-style label */}
      <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Workspaces</div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {allItems.map((item, i) => {
          const isActive = (item.ws?.id ?? null) === (activeWorkspace?.id ?? null);
          return (
            <div key={item.ws?.id ?? 'personal'}
              onClick={() => onSelect(item.ws)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--accent)' : 'var(--bg3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, transition: 'background 0.15s',
              }}>{item.icon}</div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.sub}
                </div>
              </div>

              {/* Active dot */}
              {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
            </div>
          );
        })}

        {/* New / Join */}
        <div style={{ padding: '10px 12px' }}>
          {!showNew && !showJoin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNew(true)}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; }}
              >＋ New workspace</button>
              <button onClick={() => setShowJoin(true)}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text3)'; }}
              >🔑 Join</button>
            </div>
          )}
          {showNew && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Workspace name" autoFocus
                style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%' }}
                onKeyDown={e => e.key === 'Enter' && createWs()}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={createWs} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Create</button>
                <button onClick={() => { setShowNew(false); setError(''); }} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          {showJoin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter invite code" autoFocus
                style={{ background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 9, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%' }}
                onKeyDown={e => e.key === 'Enter' && joinWs()}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={joinWs} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Join</button>
                <button onClick={() => { setShowJoin(false); setError(''); }} style={{ flex: 1, padding: '8px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          {error && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 5 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
