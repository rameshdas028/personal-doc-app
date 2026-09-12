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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      <div onClick={e => e.stopPropagation()} style={{ width: '92vw', height: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mimetype?.includes('pdf')
          ? <iframe src={url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} />
          : <img src={url} alt="doc" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
        }
      </div>
    </div>
  );
}

function ScanningBubble() {
  return (
    <div style={{ background: 'var(--msg-in)', borderRadius: '0 8px 8px 8px', padding: '12px 16px', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>Scanning</span>
      {[0, 0.2, 0.4].map(d => (
        <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1s ${d}s ease-in-out infinite` }} />
      ))}
    </div>
  );
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g).map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const content = line.trim().replace(/^[-•]\s*/, '').trim();
      if (!content) return null;
      return <div key={i} style={{ display: 'flex', gap: 6, marginTop: 2 }}><span style={{ color: 'var(--accent)' }}>•</span><span>{parts.slice(1)}</span></div>;
    }
    if (line.trim() === '') return <div key={i} style={{ height: 4 }} />;
    return <div key={i}>{parts}</div>;
  });
}

export default function ChatWindow({ messages, token }: { messages: Message[]; token: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<{ url: string; mimetype?: string } | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // WhatsApp chat background pattern
  const bgStyle = {
    flex: 1, overflowY: 'auto' as const,
    background: 'var(--bg)',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    padding: '12px 8%',
    display: 'flex', flexDirection: 'column' as const, gap: 2,
  };

  if (messages.length === 0) {
    return (
      <div style={{ ...bgStyle, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
          🔒 Messages are end-to-end encrypted. Ask anything about your documents.
        </div>
      </div>
    );
  }

  return (
    <>
      {lightbox && <Lightbox url={lightbox.url} mimetype={lightbox.mimetype} onClose={() => setLightbox(null)} />}
      <div style={bgStyle}>
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 2, animation: 'fadeUp 0.2s ease' }}>
              <div style={{
                maxWidth: '65%', minWidth: 80,
                background: isUser ? 'var(--msg-out)' : 'var(--msg-in)',
                borderRadius: isUser ? '8px 0 8px 8px' : '0 8px 8px 8px',
                padding: msg.isScanning ? 0 : '6px 10px 8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                border: isUser ? 'none' : '1px solid var(--border)',
                position: 'relative',
              }}>
                {msg.isScanning && <ScanningBubble />}

                {!msg.isScanning && (
                  <>
                    {/* File preview */}
                    {(msg.previewUrl || msg.fileUrl) && (() => {
                      const url = msg.previewUrl || msg.fileUrl!;
                      const isPdf = msg.mimetype?.includes('pdf');
                      return (
                        <div onClick={() => setLightbox({ url, mimetype: msg.mimetype })} style={{ cursor: 'pointer', marginBottom: msg.text ? 6 : 0, borderRadius: 6, overflow: 'hidden' }}>
                          {isPdf ? (
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 6 }}>
                              <span style={{ fontSize: 28 }}>📄</span>
                              <div><div style={{ fontSize: 13, fontWeight: 600 }}>PDF Document</div><div style={{ fontSize: 11, color: 'var(--text3)' }}>Tap to view</div></div>
                            </div>
                          ) : (
                            <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 220, display: 'block', borderRadius: 6 }} />
                          )}
                        </div>
                      );
                    })()}

                    {/* Text */}
                    {msg.text && (
                      <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: msg.folderDocs ? 8 : 0 }}>
                        {renderMarkdown(msg.text)}
                      </div>
                    )}

                    {/* Folder docs grid */}
                    {msg.folderDocs && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6, marginTop: 6 }}>
                        {msg.folderDocs.map(doc => {
                          const isPdf = doc.mimetype?.includes('pdf');
                          const fileUrl = `${process.env.NEXT_PUBLIC_API_URL}${doc.file_url}?token=${token}`;
                          return (
                            <div key={doc.doc_id} onClick={() => setLightbox({ url: fileUrl, mimetype: doc.mimetype })}
                              style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)' }}
                            >
                              <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {isPdf ? <span style={{ fontSize: 28 }}>📄</span>
                                  : <img src={fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                              </div>
                              <div style={{ padding: '4px 6px', fontSize: 10, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.label || doc.doc_type.replace(/_/g, ' ')}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Timestamp + tick */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{time}</span>
                      {isUser && <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓✓</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </>
  );
}
