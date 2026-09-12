'use client';
import { useState, useRef, useEffect, ClipboardEvent, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api';
import PhoneInput, { Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

type Screen = 'login' | 'signup' | 'forgot' | 'reset';

export default function LoginScreen() {
  const [screen, setScreen] = useState<Screen>('login');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', password: '', confirmPassword: '', otp: ['', '', '', ''], newPassword: '', confirmNewPassword: '' });
  const [country, setCountry] = useState<Country>('IN');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); setError(''); }
  function go(s: Screen) { setScreen(s); setError(''); setSuccess(''); setDevOtp(''); }

  useEffect(() => {
    fetch('https://ipapi.co/json/').then(r => r.json()).then(d => { if (d.country_code) setCountry(d.country_code as Country); }).catch(() => {});
  }, []);

  async function handleLogin() {
    if (!form.phone || !form.password) return setError('All fields required');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone: form.phone, password: form.password }) });
      setAuth(data.token, data.user.phone);
      router.replace('/chat');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleSignup() {
    if (!form.firstName || !form.lastName || !form.phone || !form.password || !form.confirmPassword) return setError('All fields required');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, phone: form.phone, password: form.password }) });
      setAuth(data.token, data.user.phone);
      router.replace('/chat');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleForgot() {
    if (!form.phone) return setError('Phone number required');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ phone: form.phone }) });
      setDevOtp(data.dev_otp || '');
      go('reset');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleReset() {
    const otp = form.otp.join('');
    if (otp.length < 4 || !form.newPassword || !form.confirmNewPassword) return setError('All fields required');
    if (form.newPassword !== form.confirmNewPassword) return setError('Passwords do not match');
    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ phone: form.phone, otp, newPassword: form.newPassword }) });
      setSuccess('Password reset! Redirecting...');
      setTimeout(() => go('login'), 1500);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  function handleOtpChange(val: string, i: number) {
    if (!/^\d?$/.test(val)) return;
    const next = [...form.otp]; next[i] = val;
    setForm(f => ({ ...f, otp: next }));
    if (val && i < 3) otpRefs.current[i + 1]?.focus();
  }
  function handleOtpKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Backspace' && !form.otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }
  function handleOtpPaste(e: ClipboardEvent) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4).split('');
    if (digits.length === 4) { setForm(f => ({ ...f, otp: digits })); otpRefs.current[3]?.focus(); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      {/* Background glow */}
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(124,111,239,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeUp 0.4s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, background: 'var(--gradient)', borderRadius: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14, boxShadow: '0 8px 32px rgba(124,111,239,0.3)' }}>
            📁
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>ilovemydoc</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
            {screen === 'login' && 'Welcome back'}
            {screen === 'signup' && 'Create your account'}
            {screen === 'forgot' && 'Reset your password'}
            {screen === 'reset' && `OTP sent to your phone${devOtp ? ` · DEV: ${devOtp}` : ''}`}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 28px 24px' }}>

          {/* Login/Signup tabs */}
          {(screen === 'login' || screen === 'signup') && (
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
              {(['login', 'signup'] as Screen[]).map(s => (
                <button key={s} onClick={() => go(s)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', background: screen === s ? 'var(--bg2)' : 'transparent', color: screen === s ? 'var(--text)' : 'var(--text3)', boxShadow: screen === s ? '0 1px 4px rgba(0,0,0,0.3)' : 'none' }}>
                  {s === 'login' ? 'Login' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {/* LOGIN */}
          {screen === 'login' && (
            <>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 12px', marginBottom: 12 }}
                onFocus={() => {}} >
                <PhoneInput international defaultCountry={country} country={country}
                  onCountryChange={c => c && setCountry(c)}
                  value={form.phone} onChange={v => { setForm(f => ({ ...f, phone: v || '' })); setError(''); }}
                  onKeyDown={(e: any) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <Field placeholder="Password" type={showPass ? 'text' : 'password'} value={form.password} onChange={(v: string) => set('password', v)} onEnter={handleLogin} />
              <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 16 }}>
                <span onClick={() => go('forgot')} style={{ color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}>Forgot password?</span>
              </div>
              <Btn onClick={handleLogin} loading={loading} label="Login" />
            </>
          )}

          {/* SIGNUP */}
          {screen === 'signup' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field placeholder="First Name" value={form.firstName} onChange={(v: string) => set('firstName', v)} autoFocus />
                <Field placeholder="Last Name" value={form.lastName} onChange={(v: string) => set('lastName', v)} />
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 12px', marginBottom: 12 }}>
                <PhoneInput international defaultCountry={country} country={country}
                  onCountryChange={c => c && setCountry(c)}
                  value={form.phone} onChange={v => { setForm(f => ({ ...f, phone: v || '' })); setError(''); }}
                />
              </div>
              <Field placeholder="Password (min 6 chars)" type="password" value={form.password} onChange={(v: string) => set('password', v)} />
              <Field placeholder="Confirm Password" type="password" value={form.confirmPassword} onChange={(v: string) => set('confirmPassword', v)} onEnter={handleSignup} />
              <Btn onClick={handleSignup} loading={loading} label="Create Account" />
            </>
          )}

          {/* FORGOT */}
          {screen === 'forgot' && (
            <>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 12px', marginBottom: 16 }}>
                <PhoneInput international defaultCountry={country} country={country}
                  onCountryChange={c => c && setCountry(c)}
                  value={form.phone} onChange={v => { setForm(f => ({ ...f, phone: v || '' })); setError(''); }}
                  onKeyDown={(e: any) => e.key === 'Enter' && handleForgot()}
                />
              </div>
              <Btn onClick={handleForgot} loading={loading} label="Send OTP" />
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
                <span onClick={() => go('login')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>← Back to Login</span>
              </p>
            </>
          )}

          {/* RESET */}
          {screen === 'reset' && (
            <>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }} onPaste={handleOtpPaste}>
                {form.otp.map((d, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el; }} value={d}
                    onChange={e => handleOtpChange(e.target.value, i)}
                    onKeyDown={e => handleOtpKey(e, i)}
                    maxLength={1} inputMode="numeric" autoFocus={i === 0}
                    style={{ width: 58, height: 58, background: 'var(--bg3)', border: `2px solid ${d ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, textAlign: 'center', fontSize: 22, fontWeight: 700, color: 'var(--text)', outline: 'none', transition: 'border-color 0.2s' }}
                  />
                ))}
              </div>
              <Field placeholder="New Password" type="password" value={form.newPassword} onChange={(v: string) => set('newPassword', v)} />
              <Field placeholder="Confirm New Password" type="password" value={form.confirmNewPassword} onChange={(v: string) => set('confirmNewPassword', v)} onEnter={handleReset} />
              <Btn onClick={handleReset} loading={loading} label="Reset Password" />
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
                <span onClick={() => go('forgot')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>← Resend OTP</span>
              </p>
            </>
          )}

          {error && (
            <div style={{ marginTop: 14, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '10px 14px', color: 'var(--error)', fontSize: 13, textAlign: 'center' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 14, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '10px 14px', color: 'var(--success)', fontSize: 13, textAlign: 'center' }}>
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ placeholder, type = 'text', value, onChange, onEnter, autoFocus }: {
  placeholder: string; type?: string; value: string;
  onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <input
        suppressHydrationWarning
        placeholder={placeholder} type={type} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={(e: any) => e.key === 'Enter' && onEnter?.()}
        autoFocus={autoFocus}
        style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg3)', border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '13px 16px', color: 'var(--text)', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

function Btn({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ width: '100%', background: 'var(--gradient)', border: 'none', borderRadius: 12, padding: '13px', color: '#fff', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s', boxShadow: '0 4px 20px rgba(124,111,239,0.3)' }}>
      {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
        Please wait...
      </span> : label}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
