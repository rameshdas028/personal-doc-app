'use client';
import { useEffect, useRef, useState } from 'react';
import { Message } from './ChatScreen';

function Lightbox({ url, mimetype, onClose }: { url: string; mimetype?: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
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

function ScanningCard({ mimetype }: { mimetype?: string }) {
  return (
    <div style={{ width: 160, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '0.707', background: '#1a1a2a', borderRadius: 8, overflow: 'hidden', marginBottom: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
        {[18, 30, 42, 54, 66, 76].map(top => (
          <div key={top} style={{ position: 'absolute', left: 10, right: 10, top: `${top}%`, height: 1.5, background: 'rgba(124,111,239,0.2)', borderRadius: 2 }} />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', boxShadow: '0 0 12px var(--accent)', animation: 'scanLine 1.4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 12px 12px 0', borderColor: 'transparent var(--bg3) transparent transparent' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center', fontWeight: 500, marginBottom: 8 }}>
        {mimetype?.includes('pdf') ? '📄' : '🖼️'} Scanning...
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
        {[0, 0.2, 0.4].map(d => (
          <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: `pulse ${1}s ${d}s ease-in-out infinite` }} />
        ))}
      </div>
    </div>
  );
}

function FilePreview({ url, mimetype, onClick }: { url: string; mimetype?: string; onClick: () => void }) {
  const isPdf = mimetype?.includes('pdf');
  return (
    <div onClick={onClick} style={{ marginTop: 8, cursor: 'zoom-in', display: 'inline-block', position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
      {isPdf ? (
        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(124,111,239,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>PDF Document</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Tap to view</div>
          </div>
        </div>
      ) : (
        <>
          <img src={url} alt="doc" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 10, display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
          >
            <span style={{ fontSize: 20, opacity: 0 }} className="zoom-icon">🔍</span>
          </div>
        </>
      )}
    </div>
  );
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    );
    // Bullet
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const content = line.trim().replace(/^[-•]\s*/, '').trim();
      if (!content) return null;
      return <div key={i} style={{ display: 'flex', gap: 6, marginTop: 3 }}><span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span><span>{parts.slice(1)}</span></div>;
    }
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ marginTop: i === 0 ? 0 : 2 }}>{parts}</div>;
  });
}



export default function ChatWindow({ messages, token }: { messages: Message[]; token: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{ url: string; mimetype?: string } | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, overflowY: 'auto' }}>
        <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, #7c6fef, #ff6584)', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: '0 8px 32px rgba(124,111,239,0.25)', marginBottom: 4 }}>📁</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Your Document Vault</h2>
        <p style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>Upload documents or ask anything in Hindi or English</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
          {['🪪 Aadhar Card', '💳 PAN Card', '🚗 Driving License', '📋 All Documents'].map(q => (
            <div key={q} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)'; }}
            >{q}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {lightbox && <Lightbox url={lightbox.url} mimetype={lightbox.mimetype} onClose={() => setLightbox(null)} />}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end', animation: 'fadeUp 0.25s ease' }}>
            {/* Avatar */}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: msg.role === 'user' ? 'linear-gradient(135deg, #7c6fef, #ff6584)' : 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>

            <div style={{ maxWidth: '72%' }}>
              {msg.isScanning && <ScanningCard mimetype={msg.mimetype} />}

              {!msg.isScanning && (msg.text || msg.previewUrl || msg.fileUrl || msg.folderDocs) && (
                <div style={{
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #7c6fef, #6c5fe0)' : 'var(--bg3)',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  padding: msg.folderDocs ? '12px' : '10px 14px', fontSize: 14, lineHeight: 1.6, color: 'var(--text)',
                  boxShadow: msg.role === 'user' ? '0 2px 12px rgba(124,111,239,0.25)' : '0 1px 4px rgba(0,0,0,0.2)',
                  border: msg.role === 'bot' ? '1px solid var(--border)' : 'none',
                  maxWidth: msg.folderDocs ? '480px' : undefined,
                }}>
                  {msg.text && <div style={{ whiteSpace: 'pre-wrap', marginBottom: msg.folderDocs ? 10 : 0 }}>{renderMarkdown(msg.text)}</div>}
                  {msg.folderDocs && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                      {msg.folderDocs.map(doc => {
                        const isPdf = doc.mimetype?.includes('pdf');
                        const fileUrl = `${process.env.NEXT_PUBLIC_API_URL}${doc.file_url}?token=${token}`;
                        return (
                          <div key={doc.doc_id} onClick={() => setLightbox({ url: fileUrl, mimetype: doc.mimetype })}
                            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                          >
                            <div style={{ height: 80, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {isPdf
                                ? <span style={{ fontSize: 32 }}>📄</span>
                                : <img src={fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
                              }
                            </div>
                            <div style={{ padding: '6px 8px' }}>
                              <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                                {doc.label || doc.doc_type.replace(/_/g, ' ')}
                              </div>
                              {doc.period && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{doc.period}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {msg.previewUrl && (
                    <FilePreview url={msg.previewUrl} mimetype={msg.mimetype}
                      onClick={() => setLightbox({ url: msg.previewUrl!, mimetype: msg.mimetype })} />
                  )}
                  {msg.fileUrl && (
                    <FilePreview url={msg.fileUrl} mimetype={msg.mimetype}
                      onClick={() => setLightbox({ url: msg.fileUrl!, mimetype: msg.mimetype })} />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </>
  );
}
