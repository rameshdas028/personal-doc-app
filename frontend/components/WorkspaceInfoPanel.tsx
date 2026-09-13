'use client';
import { useState, useEffect } from 'react';
import { Workspace } from './ChatScreen';
import { apiFetch } from '@/lib/api';

interface Member {
  userId: string;
  name: string;
  phone: string;
  role: 'owner' | 'member';
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const colors = ['#00a8f3', '#fc4355', '#f59e0b', '#10b981', '#8b5cf6', '#0081bc'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function WorkspaceInfoPanel({ workspace, token, docCount, onClose, onWorkspaceUpdated, onWorkspaceDeleted }: {
  workspace: Workspace;
  token: string;
  docCount: number;
  onClose: () => void;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onWorkspaceDeleted: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(workspace.name);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null); // userId to remove
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isOwner = workspace.role === 'owner';

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    try {
      const data = await apiFetch(`/api/workspaces/${workspace.id}/members`, {}, token);
      setMembers(data.members || []);
    } catch {}
  }

  async function fetchInviteCode() {
    if (inviteCode) return;
    try {
      const data = await apiFetch(`/api/workspaces/${workspace.id}/invite`, {}, token);
      setInviteCode(data.inviteCode);
    } catch {}
  }

  async function saveName() {
    if (!newName.trim() || newName === workspace.name) { setEditingName(false); return; }
    try {
      // Update via API (add rename endpoint if needed — for now optimistic)
      onWorkspaceUpdated({ ...workspace, name: newName.trim() });
      setEditingName(false);
    } catch {}
  }

  async function removeMember(userId: string) {
    try {
      await apiFetch(`/api/workspaces/${workspace.id}/members/${userId}`, { method: 'DELETE' }, token);
      setMembers(prev => prev.filter(m => m.userId !== userId));
    } catch {}
  }

  async function leaveWorkspace() {
    try {
      await apiFetch(`/api/workspaces/${workspace.id}/leave`, { method: 'DELETE' }, token);
      onWorkspaceDeleted();
    } catch {}
  }

  async function deleteWorkspace() {
    try {
      await apiFetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' }, token);
      onWorkspaceDeleted();
    } catch {}
  }

  function copyInviteCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ width: 320, height: '100vh', background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ padding: '14px 16px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Group Info</span>
      </div>

      {/* Group avatar + name */}
      <div style={{ padding: '28px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={workspace.name} size={80} />
          {isOwner && (
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg2)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
          )}
        </div>

        {/* Editable name */}
        {editingName ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', padding: '0 8px' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 12px', fontSize: 15, color: 'var(--text)', outline: 'none', textAlign: 'center' }}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            />
            <button onClick={saveName} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Save</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{workspace.name}</span>
            {isOwner && (
              <button onClick={() => setEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
            )}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Group · {members.length} member{members.length !== 1 ? 's' : ''} · {docCount} docs</div>
      </div>

      {/* Invite code */}
      {isOwner && (
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Invite Link</div>
          {!inviteCode ? (
            <button onClick={fetchInviteCode}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
            >🔗 Show Invite Code</button>
          ) : (
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 20, fontWeight: 800, letterSpacing: 4, color: 'var(--accent)', textAlign: 'center' }}>{inviteCode}</span>
              <button onClick={copyInviteCode}
                style={{ background: copied ? 'var(--success)' : 'var(--accent)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
              >{copied ? '✓ Copied' : 'Copy'}</button>
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          {members.length} Members
        </div>
        {members.map(m => (
          <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <Avatar name={m.name || m.phone} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.phone}</div>
            </div>
            {/* Role badge */}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: m.role === 'owner' ? 'var(--accent)' : 'var(--bg4)', color: m.role === 'owner' ? '#fff' : 'var(--text3)' }}>
              {m.role}
            </span>
            {/* Remove member (owner only, not self) */}
            {isOwner && m.role !== 'owner' && (
              confirmRemove === m.userId ? (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { removeMember(m.userId); setConfirmRemove(null); }}
                    style={{ background: 'var(--error)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Remove</button>
                  <button onClick={() => setConfirmRemove(null)}
                    style={{ background: 'var(--bg4)', border: 'none', borderRadius: 6, padding: '4px 8px', color: 'var(--text2)', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmRemove(m.userId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 4, opacity: 0.6, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                  title="Remove member"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/></svg>
                </button>
              )
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>

        {/* Member: Leave Group */}
        {workspace.role !== 'owner' && (
          confirmLeave ? (
            <div style={{ background: 'rgba(252,67,85,0.08)', borderRadius: 10, padding: '12px', border: '1px solid var(--error)' }}>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10, textAlign: 'center' }}>Leave "{workspace.name}"?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmLeave(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={leaveWorkspace} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--error)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Leave</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmLeave(true)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', fontSize: 13, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Leave Group
            </button>
          )
        )}

        {/* Owner: Delete Group */}
        {workspace.role === 'owner' && (
          <>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >🗑️ Delete Group</button>
            ) : (
              <div style={{ background: 'rgba(252,67,85,0.08)', borderRadius: 10, padding: '12px', border: '1px solid var(--error)' }}>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10, textAlign: 'center' }}>Delete this group? This cannot be undone.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={deleteWorkspace} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--error)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
