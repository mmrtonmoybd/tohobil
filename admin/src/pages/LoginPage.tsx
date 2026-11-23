import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminFetch } from '../lib/api';
import { useAuth, AdminUser } from '../lib/auth';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import en from '../i18n/en.json';
import bn from '../i18n/bn.json';

interface LoginResponse {
  status: string;
  csrf_token?: string;
  admin?: AdminUser;
  challenge?: string;
  setup_required?: boolean;
  setup_secret?: string;
}
const copy = navigator.language.toLowerCase().startsWith('bn') ? bn : en;

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<LoginResponse | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [token, setToken] = useState('');
  const [info, setInfo] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function finish(res: LoginResponse) {
    if (!res.admin || !res.csrf_token) throw new Error(copy.invalidResponse);
    login(res.admin, res.csrf_token);
    navigate('/admin/dashboard');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (challenge?.challenge) {
        finish(await adminFetch<LoginResponse>('auth/2fa/verify', {
          method: 'POST', body: JSON.stringify({ challenge: challenge.challenge, code }),
        }));
      } else {
        const res = await adminFetch<LoginResponse>('auth/login', {
          method: 'POST', body: JSON.stringify({ email, password }),
        });
        if (res.status === '2fa_required') { setChallenge(res); setCode(''); }
        else finish(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : copy.loginFailed);
    } finally { setLoading(false); }
  }

  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: 20 }}>
    <div className="surface-card" style={{ width: '100%', maxWidth: 400, padding: 36, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <img src="/admin/logo.svg" alt="Tohobil" style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 12 }} />
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{copy.title}</h2>
        <p style={{ fontSize: 13, color: 'var(--admin-muted)', margin: 0 }}>{copy.subtitle}</p>
      </div>
      {error && <div role="alert" style={{ padding: '12px 14px', borderRadius: 8, background: '#ef444415', border: '1px solid #ef444430', color: 'var(--admin-danger)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}><AlertCircle size={18} /><span>{error}</span></div>}
      {mode !== 'login' ? (
        <form onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          setLoading(true);
          try {
            if (mode === 'forgot') {
              await adminFetch('auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });
              setInfo(copy.resetSent);
              setMode('reset');
            } else {
              await adminFetch('auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) });
              setInfo(copy.passwordUpdated);
              setMode('login');
            }
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : copy.loginFailed);
          } finally { setLoading(false); }
        }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {info && <div>{info}</div>}
          <input className="input-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={copy.email} />
          {mode === 'reset' && <>
            <input className="input-field" required value={token} onChange={(e) => setToken(e.target.value)} placeholder={copy.resetToken} />
            <input className="input-field" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={copy.newPassword} />
          </>}
          <button className="btn-primary" type="submit">{mode === 'forgot' ? copy.sendReset : copy.resetPassword}</button>
          <button className="btn-secondary" type="button" onClick={() => setMode('login')}>{copy.back}</button>
        </form>
      ) : null}
      {mode === 'login' && <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {challenge ? <>
          {challenge.setup_required && <div style={{ overflowWrap: 'anywhere', fontSize: 13 }}>
            <p>{copy.setupInstructions}</p>
            <code style={{ display: 'block', padding: 12, background: 'var(--admin-bg)', userSelect: 'all' }}>{challenge.setup_secret}</code>
            <p>{copy.setupWarning}</p>
          </div>}
          <div><label htmlFor="admin-totp" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{copy.code}</label>
            <input id="admin-totp" className="input-field" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></div>
          <button type="button" onClick={() => { setChallenge(null); setCode(''); setError(''); }} className="btn-secondary">{copy.back}</button>
        </> : <>
          <div><label htmlFor="admin-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{copy.email}</label>
            <div style={{ position: 'relative' }}><Mail size={18} color="var(--admin-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input id="admin-email" type="email" required className="input-field" placeholder="admin@tohobil.app" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: 38 }} /></div></div>
          <div><label htmlFor="admin-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{copy.password}</label>
            <div style={{ position: 'relative' }}><Lock size={18} color="var(--admin-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input id="admin-password" type="password" required className="input-field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: 38 }} /></div></div>
        </>}
        <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: 12, justifyContent: 'center', marginTop: 8, fontSize: 15 }}>
          {loading ? copy.authenticating : challenge ? copy.verify : copy.signIn}<ArrowRight size={18} />
        </button>
      </form>}
      {mode === 'login' && <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => setMode('forgot')}>{copy.forgotPassword}</button>}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--admin-muted)' }}>{copy.sessionNote}</div>
    </div>
  </div>;
}
