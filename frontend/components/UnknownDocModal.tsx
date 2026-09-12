'use client';
import { useState, useRef, useEffect } from 'react';

export default function UnknownDocModal({ onConfirm, onCancel, aiDescription, detectedType, aiAnalysis }: {
  onConfirm: (purpose: string, docType: string, label: string, description: string) => void;
  onCancel: () => void;
  aiDescription?: string;
  detectedType?: string;
  aiAnalysis?: any;
}) {
  const aiTitle = aiDescription || '';
  const aiDesc = aiAnalysis?.description || '';

  const [title, setTitle] = useState(aiTitle);
  const [description, setDescription] = useState(aiDesc);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'relative', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: 420, zIndex: 1, boxSizing: 'border-box' }}>

        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text)' }}>📄 Document Details</div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: 0.5 }}>TITLE</label>
            {title !== aiTitle && aiTitle && (
              <button onClick={() => setTitle(aiTitle)}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ✨ Restore AI title
              </button>
            )}
          </div>
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Ramesh Kumar Resume"
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: 0.5 }}>
              DESCRIPTION <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span>
            </label>
            {description !== aiDesc && aiDesc && (
              <button onClick={() => setDescription(aiDesc)}
                style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ✨ Restore AI description
              </button>
            )}
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Add any extra notes about this document..."
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* AI detected type badge */}
        {detectedType && (
          <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>AI detected:</span>
            <span style={{ fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 10px', color: 'var(--text2)' }}>
              {detectedType.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: 'var(--text2)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm('', detectedType || 'document', title.trim() || aiTitle, description.trim())}
            disabled={!title.trim()}
            style={{ flex: 1, background: title.trim() ? 'var(--accent)' : 'var(--bg3)', border: 'none', borderRadius: 10, padding: 10, color: title.trim() ? '#fff' : 'var(--text3)', cursor: title.trim() ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
