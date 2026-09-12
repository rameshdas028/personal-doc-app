'use client';
import { useState, useRef } from 'react';

export default function ChatInput({ onSend, onFile, disabled }: {
  onSend: (text: string) => void;
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <div style={{ padding: '8px 16px 12px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, borderTop: '1px solid var(--border)' }}>

      {/* Attach */}
      <label style={{ width: 42, height: 42, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--text2)', flexShrink: 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text2)'; }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
        </svg>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden disabled={disabled}
          onChange={e => { if (e.target.files?.[0]) { onFile(e.target.files[0]); e.target.value = ''; } }} />
      </label>

      {/* Input */}
      <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 24, padding: '10px 18px', display: 'flex', alignItems: 'center' }}>
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Type a message"
          disabled={disabled}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15 }}
        />
      </div>

      {/* Send / Mic */}
      <button onClick={submit} disabled={disabled}
        style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = '#008f72'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
      >
        {text.trim() ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
          </svg>
        )}
      </button>
    </div>
  );
}
