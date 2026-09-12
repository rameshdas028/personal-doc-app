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
    <div style={{ padding: '12px 16px 16px', background: 'var(--bg2)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 16, padding: '6px 6px 6px 6px', transition: 'border-color 0.2s', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
      >
        {/* Attach button */}
        <label style={{ width: 38, height: 38, background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 11, color: disabled ? 'var(--text3)' : 'var(--text2)', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
          onMouseEnter={e => !disabled && ((e.currentTarget as HTMLElement).style.background = 'var(--accent-soft)', (e.currentTarget as HTMLElement).style.color = 'var(--accent)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg4)', (e.currentTarget as HTMLElement).style.color = 'var(--text2)')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden disabled={disabled}
            onChange={e => { if (e.target.files?.[0]) { onFile(e.target.files[0]); e.target.value = ''; } }} />
        </label>

        {/* Text input */}
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Ask anything... 'Show Aadhar', 'PAN card do'"
          disabled={disabled}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14, padding: '8px 4px' }}
        />

        {/* Send button */}
        <button onClick={submit} disabled={disabled || !text.trim()}
          style={{ width: 38, height: 38, background: text.trim() && !disabled ? 'var(--gradient)' : 'var(--bg4)', border: 'none', borderRadius: 11, color: text.trim() && !disabled ? '#fff' : 'var(--text3)', cursor: text.trim() && !disabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', boxShadow: text.trim() && !disabled ? '0 2px 12px rgba(124,111,239,0.4)' : 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
