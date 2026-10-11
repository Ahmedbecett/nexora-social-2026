import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { api } from '../api.js';
import { t, errText } from '../i18n.js';
import { useApp, Wordmark, Spinner, Sheet } from '../components.jsx';
import { IEye, IEyeOff, IDown, IFacebook, IBack, ICheck } from '../icons.jsx';

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field with-icon">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete="current-password" dir="auto" />
      <button type="button" className="field-icon" onClick={() => setShow(!show)} aria-label="toggle password">
        {show ? <IEye size={24} /> : <IEyeOff size={24} />}
      </button>
    </div>
  );
}

function LangPicker() {
  const { lang, setLang } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="lang-picker" onClick={() => setOpen(true)}>
        <span>{lang === 'ar' ? 'العربية' : 'English'}</span><IDown size={16} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="actions">
          {[['ar', 'العربية'], ['en', 'English']].map(([k, label]) => (
            <button key={k} className="action" onClick={() => { setOpen(false); setLang(k); }}>
              <span style={{ flex: 1 }}>{label}</span>{lang === k && <ICheck size={20} />}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export function Login({ goSignup }) {
  const { login, toast } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const r = await api('auth/login', { method: 'POST', body: { identifier, password } });
      login(r.token, r.user);
    } catch (err) { setError(errText(err.code)); }
    setBusy(false);
  };
  const ready = identifier.trim() && password.length >= 1;

  return (
    <div className="auth">
      {!Capacitor.isNativePlatform() && (
        <a className="get-app" href="/download/Nexora.apk" download>
          <img src="/icon-192.png" alt="" /><span className="flex1"><b>Nexora</b><small>{t('getApp')}</small></span><span className="btn btn-primary btn-sm">APK</span>
        </a>
      )}
      <div className="auth-top"><LangPicker /></div>
      <form className="auth-body" onSubmit={submit}>
        <div className="auth-logo"><Wordmark size={64} gradient /></div>
        <div className="field">
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t('loginId')}
            autoCapitalize="none" autoCorrect="off" autoComplete="username" dir="auto" />
        </div>
        <PasswordInput value={password} onChange={setPassword} placeholder={t('password')} />
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-lg" disabled={!ready || busy}>{busy ? <Spinner size={22} light /> : t('login')}</button>
        <div className="divider"><span>{t('or')}</span></div>
        <button type="button" className="fb-link" onClick={() => toast(t('facebookSoon'))}><IFacebook size={30} /><span>{t('loginFacebook')}</span></button>
        <button type="button" className="text-link" onClick={() => toast(t('forgotHelp'))}>{t('forgot')}</button>
      </form>
      <div className="auth-bottom">
        {t('noAccount')} <button className="text-link strong" onClick={goSignup}>{t('createNew')}</button>
      </div>
    </div>
  );
}

export function Signup({ goLogin }) {
  const { login, toast } = useApp();
  const [f, setF] = useState({ fullName: '', username: '', contact: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uState, setUState] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: k === 'username' ? e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '') : e.target.value });

  useEffect(() => {
    if (f.username.length < 3) { setUState(null); return; }
    const tm = setTimeout(() => {
      api(`auth/check-username?u=${encodeURIComponent(f.username)}`).then((r) => setUState(r.available ? 'ok' : 'taken')).catch(() => {});
    }, 400);
    return () => clearTimeout(tm);
  }, [f.username]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const r = await api('auth/register', { method: 'POST', body: f });
      login(r.token, r.user);
    } catch (err) { setError(errText(err.code)); }
    setBusy(false);
  };
  const ready = f.fullName.trim() && f.username.length >= 3 && f.contact.trim() && f.password.length >= 6;

  return (
    <div className="auth">
      <div className="auth-top start"><button className="icon-btn" onClick={goLogin} aria-label="back"><IBack size={28} /></button></div>
      <form className="auth-body signup" onSubmit={submit}>
        <h1 className="auth-title">{t('createAccount')}</h1>
        <p className="auth-sub">{t('createSub')}</p>
        <div className="field"><input value={f.fullName} onChange={set('fullName')} placeholder={t('fullName')} autoComplete="name" dir="auto" /></div>
        <div className="field with-icon">
          <input value={f.username} onChange={set('username')} placeholder={t('username')} autoCapitalize="none" autoCorrect="off" dir="ltr" />
          {uState && <span className={`field-status ${uState}`}>{uState === 'ok' ? '✓' : '✕'}</span>}
        </div>
        {uState === 'taken' && <div className="form-hint bad">{t('usernameTaken')}</div>}
        <div className="field"><input value={f.contact} onChange={set('contact')} placeholder={t('contact')} autoCapitalize="none" inputMode="email" autoComplete="email" dir="auto" /></div>
        <PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} placeholder={t('password')} />
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-lg" disabled={!ready || busy}>{busy ? <Spinner size={22} light /> : t('next')}</button>
        <div className="divider"><span>{t('or')}</span></div>
        <button type="button" className="fb-link" onClick={() => toast(t('facebookSoon'))}><IFacebook size={30} /><span>{t('signupFacebook')}</span></button>
        <p className="terms">{t('terms')}</p>
      </form>
      <div className="auth-bottom">
        {t('haveAccount')} <button className="text-link strong" onClick={goLogin}>{t('loginLink')}</button>
      </div>
    </div>
  );
}
