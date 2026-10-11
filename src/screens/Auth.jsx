import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { api, getAccounts, forgetAccount, dropAccountToken } from '../api.js';
import { t, errText, LANGUAGES } from '../i18n.js';
import { useApp, Wordmark, Spinner, Sheet, Avatar, Glyph, FromBrand, ActionSheet } from '../components.jsx';
import { IEye, IEyeOff, IDown, IBack, ICheck, IClose, IMoreH, IChevron, IGoogle, IPhone, IMail, ISearch, ITrash } from '../icons.jsx';

const noAuth = { token: null };

function PasswordInput({ value, onChange, placeholder, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field with-icon">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete} dir="auto" />
      <button type="button" className="field-icon" onClick={() => setShow(!show)} aria-label="toggle password">
        {show ? <IEye size={24} /> : <IEyeOff size={24} />}
      </button>
    </div>
  );
}

export function LanguageList({ onPick }) {
  const { lang } = useApp();
  const [q, setQ] = useState('');
  const list = LANGUAGES.filter(([code, name, en]) => !q || `${name} ${en} ${code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="lang-list">
      <div className="search-box pad"><ISearch size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
      {list.map(([code, name, en]) => (
        <button key={code} className="settings-item" onClick={() => onPick(code)}>
          <span className="flex1 lang-names"><span>{name}</span><small className="muted">{en}</small></span>{lang === code && <ICheck size={20} />}
        </button>
      ))}
    </div>
  );
}

function LangPicker() {
  const { lang, setLang } = useApp();
  const [open, setOpen] = useState(false);
  const cur = LANGUAGES.find((l) => l[0] === lang);
  return (
    <>
      <button className="lang-picker" onClick={() => setOpen(true)}>
        <span>{cur ? cur[1] : lang}</span><IDown size={16} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} full>
        <LanguageList onPick={(k) => { setOpen(false); setLang(k); }} />
      </Sheet>
    </>
  );
}

function GetAppBanner() {
  if (Capacitor.isNativePlatform()) return null;
  return (
    <a className="get-app" href="/download/Nexora.apk" download>
      <img src="/icon-192.png" alt="" /><span className="flex1"><b>Nexora</b><small>{t('getApp')}</small></span><span className="btn btn-primary btn-sm">APK</span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Flow controller                                                    */
/* ------------------------------------------------------------------ */
export default function AuthFlow({ onCancel }) {
  const { login } = useApp();
  const [accounts, setAccounts] = useState(getAccounts);
  const [screen, setScreen] = useState(() => (getAccounts().length ? 'saved' : 'login'));
  const [prefill, setPrefill] = useState('');
  const [pending, setPending] = useState(null);
  const history = useRef([]);

  const go = (s) => { history.current.push(screen); setScreen(s); };
  const back = () => {
    const prev = history.current.pop();
    if (prev) setScreen(prev); else if (onCancel) onCancel();
  };
  const canBack = history.current.length > 0 || !!onCancel;

  // Handles {token,user} or {needsProfile,...} results from any provider.
  const finish = (r) => {
    if (r?.needsProfile) { setPending(r); go('complete'); return; }
    if (r?.token) login(r.token, r.user);
  };

  const refreshAccounts = () => setAccounts(getAccounts());

  const common = { go, back, canBack, finish, onCancel };
  return (
    <div className="auth-root">
      {screen === 'saved' && <SavedProfiles {...common} accounts={accounts} refresh={refreshAccounts}
        onPassword={(u) => { setPrefill(u); go('login'); }} />}
      {screen === 'login' && <Login {...common} prefill={prefill} hasSaved={accounts.length > 0} />}
      {screen === 'signup' && <Signup {...common} />}
      {screen === 'phone' && <PhoneAuth {...common} />}
      {screen === 'forgot' && <Forgot {...common} prefill={prefill} />}
      {screen === 'complete' && pending && <CompleteProfile {...common} pending={pending} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saved profiles ("Continue as")                                      */
/* ------------------------------------------------------------------ */
function SavedProfiles({ accounts, refresh, go, onPassword, finish, onCancel }) {
  const { toast } = useApp();
  const [badges, setBadges] = useState({});
  const [busy, setBusy] = useState(null);
  const [menu, setMenu] = useState(false);
  const [manage, setManage] = useState(false);

  useEffect(() => {
    accounts.forEach((a) => {
      if (!a.token) return;
      api('me/badges', { token: a.token })
        .then((b) => setBadges((x) => ({ ...x, [a.id]: b })))
        .catch((e) => { if (e.status === 401) { dropAccountToken(a.id); refresh(); } });
    });
  }, [accounts.length]); // eslint-disable-line

  const open = async (a) => {
    if (manage) return;
    if (!a.token) { onPassword(a.username); return; }
    setBusy(a.id);
    try {
      const r = await api('me', { token: a.token });
      finish({ token: a.token, user: r.user });
    } catch (e) {
      if (e.status === 401) { dropAccountToken(a.id); refresh(); onPassword(a.username); }
      else toast(errText(e.code));
    }
    setBusy(null);
  };

  return (
    <div className="auth saved-profiles">
      <div className="auth-top between">
        {onCancel ? <button className="icon-btn" onClick={onCancel} aria-label="close"><IClose size={28} /></button> : <span />}
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="more"><IMoreH size={26} /></button>
      </div>
      <div className="saved-logo"><Glyph size={84} filled /></div>
      <div className="saved-list">
        {accounts.map((a) => {
          const b = badges[a.id];
          const n = b ? b.notifications + b.messages + b.requests : 0;
          return (
            <button key={a.id} className="saved-card" onClick={() => open(a)} disabled={busy === a.id}>
              <Avatar src={a.avatarUrl} name={a.username} size={72} />
              <span className="flex1 saved-meta">
                <bdi className="saved-name">{a.username}</bdi>
                {!a.token ? <small className="muted">{t('loginAgain')}</small> : n > 0 ? <small className="muted"><i className="red-dot" />{t('newNotifications')}</small> : null}
              </span>
              {busy === a.id ? <Spinner size={20} /> : manage
                ? <span className="icon-btn danger-text" onClick={(e) => { e.stopPropagation(); forgetAccount(a.id); refresh(); }}><ITrash size={22} /></span>
                : <IChevron size={22} className="muted" />}
            </button>
          );
        })}
      </div>
      <div className="saved-actions">
        {manage ? <button className="btn btn-secondary btn-lg btn-block pill" onClick={() => setManage(false)}>{t('done')}</button> : (
          <>
            <button className="btn btn-secondary btn-lg btn-block pill" onClick={() => go('login')}>{t('useAnotherProfile')}</button>
            <button className="btn btn-outline-blue btn-lg btn-block pill" onClick={() => go('signup')}>{t('createNewAccount')}</button>
          </>
        )}
        <FromBrand small />
      </div>
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
        { label: t('removeProfiles'), icon: <ITrash size={22} />, onClick: () => setManage(true) },
      ]} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Login                                                              */
/* ------------------------------------------------------------------ */
function SocialButtons({ finish, go }) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const google = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { signInWithGoogle } = await import('../firebase.js');
      finish(await signInWithGoogle());
    } catch (e) { if (e.code !== 'cancelled') toast(errText(e.code)); }
    setBusy(false);
  };
  return (
    <div className="social-btns">
      <button type="button" className="btn btn-social" onClick={google} disabled={busy}>
        {busy ? <Spinner size={20} /> : <IGoogle size={22} />}<span>{t('continueGoogle')}</span>
      </button>
      <button type="button" className="btn btn-social" onClick={() => go('phone')}>
        <IPhone size={22} /><span>{t('continuePhone')}</span>
      </button>
    </div>
  );
}

function Login({ prefill, go, back, canBack, finish }) {
  const [identifier, setIdentifier] = useState(prefill || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try {
      finish(await api('auth/login', { method: 'POST', body: { identifier, password }, ...noAuth }));
    } catch (err) {
      if (err.code === 'use_phone_login') { go('phone'); return; }
      setError(errText(err.code));
    }
    setBusy(false);
  };
  const ready = identifier.trim() && password.length >= 1;

  return (
    <div className="auth">
      <GetAppBanner />
      <div className="auth-top between">
        {canBack ? <button className="icon-btn" type="button" onClick={back} aria-label="back"><IBack size={28} /></button> : <span />}
        <LangPicker />
        <span style={{ width: 40 }} />
      </div>
      <form className="auth-body" onSubmit={submit}>
        <div className="auth-logo"><Glyph size={64} filled /><Wordmark size={52} gradient /></div>
        <div className="field">
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={t('loginId')}
            autoCapitalize="none" autoCorrect="off" autoComplete="username" dir="auto" />
        </div>
        <PasswordInput value={password} onChange={setPassword} placeholder={t('password')} />
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-lg" disabled={!ready || busy}>{busy ? <Spinner size={22} light /> : t('login')}</button>
        <button type="button" className="text-link" onClick={() => go('forgot')}>{t('forgot')}</button>
        <div className="divider"><span>{t('or')}</span></div>
        <SocialButtons finish={finish} go={go} />
      </form>
      <div className="auth-bottom">
        {t('noAccount')} <button className="text-link strong" onClick={() => go('signup')}>{t('createNew')}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sign up (email) — phone and Google sign-ups go through CompleteProfile */
/* ------------------------------------------------------------------ */
function useUsernameCheck(username) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (username.length < 3) { setState(null); return; }
    const tm = setTimeout(() => {
      api(`auth/check-username?u=${encodeURIComponent(username)}`, noAuth).then((r) => setState(!r.valid ? 'invalid' : r.available ? 'ok' : 'taken')).catch(() => {});
    }, 400);
    return () => clearTimeout(tm);
  }, [username]);
  return state;
}
const cleanUsername = (v) => v.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30);

function Signup({ go, back, finish }) {
  const [f, setF] = useState({ fullName: '', username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uState = useUsernameCheck(f.username);
  const set = (k) => (e) => setF({ ...f, [k]: k === 'username' ? cleanUsername(e.target.value) : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try { finish(await api('auth/register', { method: 'POST', body: f, ...noAuth })); }
    catch (err) { setError(errText(err.code)); }
    setBusy(false);
  };
  const ready = f.fullName.trim() && f.username.length >= 3 && uState !== 'taken' && /\S+@\S+\.\S+/.test(f.email) && f.password.length >= 6;

  return (
    <div className="auth">
      <div className="auth-top start"><button className="icon-btn" onClick={back} aria-label="back"><IBack size={28} /></button></div>
      <form className="auth-body signup" onSubmit={submit}>
        <h1 className="auth-title">{t('createAccount')}</h1>
        <p className="auth-sub">{t('createSub')}</p>
        <div className="field"><input value={f.fullName} onChange={set('fullName')} placeholder={t('fullName')} autoComplete="name" dir="auto" /></div>
        <div className="field with-icon">
          <input value={f.username} onChange={set('username')} placeholder={t('username')} autoCapitalize="none" autoCorrect="off" dir="ltr" />
          {uState && <span className={`field-status ${uState}`}>{uState === 'ok' ? '✓' : '✕'}</span>}
        </div>
        {uState === 'taken' && <div className="form-hint bad">{t('usernameTaken')}</div>}
        <div className="field"><input value={f.email} onChange={set('email')} placeholder={t('email')} autoCapitalize="none" inputMode="email" type="email" autoComplete="email" dir="ltr" /></div>
        <PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} placeholder={t('password')} autoComplete="new-password" />
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-lg" disabled={!ready || busy}>{busy ? <Spinner size={22} light /> : t('next')}</button>
        <div className="divider"><span>{t('or')}</span></div>
        <SocialButtons finish={finish} go={go} />
        <p className="terms">{t('terms')}</p>
      </form>
      <div className="auth-bottom">
        {t('haveAccount')} <button className="text-link strong" onClick={() => go('login')}>{t('loginLink')}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phone number (Firebase SMS)                                        */
/* ------------------------------------------------------------------ */
const COUNTRIES = [
  ['DZ', '213', '🇩🇿'], ['MA', '212', '🇲🇦'], ['TN', '216', '🇹🇳'], ['LY', '218', '🇱🇾'], ['EG', '20', '🇪🇬'], ['SA', '966', '🇸🇦'],
  ['AE', '971', '🇦🇪'], ['QA', '974', '🇶🇦'], ['KW', '965', '🇰🇼'], ['BH', '973', '🇧🇭'], ['OM', '968', '🇴🇲'], ['YE', '967', '🇾🇪'],
  ['JO', '962', '🇯🇴'], ['LB', '961', '🇱🇧'], ['SY', '963', '🇸🇾'], ['IQ', '964', '🇮🇶'], ['PS', '970', '🇵🇸'], ['SD', '249', '🇸🇩'],
  ['MR', '222', '🇲🇷'], ['FR', '33', '🇫🇷'], ['BE', '32', '🇧🇪'], ['CH', '41', '🇨🇭'], ['DE', '49', '🇩🇪'], ['ES', '34', '🇪🇸'],
  ['IT', '39', '🇮🇹'], ['PT', '351', '🇵🇹'], ['NL', '31', '🇳🇱'], ['GB', '44', '🇬🇧'], ['IE', '353', '🇮🇪'], ['SE', '46', '🇸🇪'],
  ['NO', '47', '🇳🇴'], ['DK', '45', '🇩🇰'], ['FI', '358', '🇫🇮'], ['PL', '48', '🇵🇱'], ['RO', '40', '🇷🇴'], ['GR', '30', '🇬🇷'],
  ['TR', '90', '🇹🇷'], ['RU', '7', '🇷🇺'], ['UA', '380', '🇺🇦'], ['US', '1', '🇺🇸'], ['CA', '1', '🇨🇦'], ['MX', '52', '🇲🇽'],
  ['BR', '55', '🇧🇷'], ['AR', '54', '🇦🇷'], ['CO', '57', '🇨🇴'], ['CL', '56', '🇨🇱'], ['PE', '51', '🇵🇪'], ['IN', '91', '🇮🇳'],
  ['PK', '92', '🇵🇰'], ['BD', '880', '🇧🇩'], ['ID', '62', '🇮🇩'], ['MY', '60', '🇲🇾'], ['PH', '63', '🇵🇭'], ['VN', '84', '🇻🇳'],
  ['TH', '66', '🇹🇭'], ['CN', '86', '🇨🇳'], ['JP', '81', '🇯🇵'], ['KR', '82', '🇰🇷'], ['AU', '61', '🇦🇺'], ['NZ', '64', '🇳🇿'],
  ['NG', '234', '🇳🇬'], ['KE', '254', '🇰🇪'], ['ZA', '27', '🇿🇦'], ['SN', '221', '🇸🇳'], ['ML', '223', '🇲🇱'], ['NE', '227', '🇳🇪'],
  ['IR', '98', '🇮🇷'], ['AF', '93', '🇦🇫'], ['AZ', '994', '🇦🇿'], ['KZ', '7', '🇰🇿'], ['UZ', '998', '🇺🇿'],
];
// Time zone is a better hint than the UI language (many phones in Algeria run in French or English).
const TZ_COUNTRY = {
  'Africa/Algiers': 'DZ', 'Africa/Casablanca': 'MA', 'Africa/Tunis': 'TN', 'Africa/Tripoli': 'LY', 'Africa/Cairo': 'EG', 'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM', 'Asia/Aden': 'YE', 'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB', 'Asia/Damascus': 'SY', 'Asia/Baghdad': 'IQ', 'Asia/Gaza': 'PS', 'Asia/Hebron': 'PS', 'Africa/Khartoum': 'SD',
  'Africa/Nouakchott': 'MR', 'Europe/Paris': 'FR', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT', 'Europe/Lisbon': 'PT', 'Europe/Amsterdam': 'NL', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Bucharest': 'RO', 'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR', 'Europe/Moscow': 'RU', 'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Jakarta': 'ID', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Manila': 'PH', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Bangkok': 'TH', 'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
  'Africa/Johannesburg': 'ZA', 'Africa/Dakar': 'SN', 'Africa/Bamako': 'ML', 'Africa/Niamey': 'NE', 'Asia/Tehran': 'IR', 'Asia/Kabul': 'AF',
  'Asia/Baku': 'AZ', 'Asia/Almaty': 'KZ', 'Asia/Tashkent': 'UZ', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Bogota': 'CO', 'America/Santiago': 'CL', 'America/Lima': 'PE', 'America/Toronto': 'CA',
  'Australia/Sydney': 'AU', 'Pacific/Auckland': 'NZ',
};
function guessCountry() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* */ }
  const region = TZ_COUNTRY[tz] || (navigator.language || '').split('-')[1];
  return COUNTRIES.find((c) => c[0] === region) || COUNTRIES[0];
}

function PhoneAuth({ back, finish }) {
  const [country, setCountry] = useState(guessCountry);
  const [pickOpen, setPickOpen] = useState(false);
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('number');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!cooldown) return;
    const tm = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(tm);
  }, [cooldown]);

  const e164 = `+${country[1]}${number.replace(/\D/g, '').replace(/^0+/, '')}`;
  const send = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try {
      const { sendPhoneCode } = await import('../firebase.js');
      let done = false;
      const onAuto = (result) => { if (done) return; done = true; finish(result); };
      const onError = (err) => setError(errText(err.code));
      confirmRef.current = await sendPhoneCode(e164, 'recaptcha-box', { onAuto, onError, resend: step === 'code' });
      setStep('code'); setCooldown(60);
    } catch (err) { setError(errText(err.code)); }
    setBusy(false);
  };
  const verify = async (e) => {
    e.preventDefault();
    if (busy || !confirmRef.current) return;
    setError(''); setBusy(true);
    try { finish(await confirmRef.current(code.trim())); }
    catch (err) { setError(errText(err.code)); }
    setBusy(false);
  };

  return (
    <div className="auth">
      <div className="auth-top start"><button className="icon-btn" onClick={step === 'code' ? () => { setStep('number'); setCode(''); } : back} aria-label="back"><IBack size={28} /></button></div>
      {step === 'number' ? (
        <form className="auth-body signup" onSubmit={send}>
          <h1 className="auth-title">{t('phoneTitle')}</h1>
          <p className="auth-sub">{t('phoneSub')}</p>
          <div className="phone-row" dir="ltr">
            <button type="button" className="field country-btn" onClick={() => setPickOpen(true)}>{country[2]} +{country[1]}<IDown size={14} /></button>
            <div className="field flex1"><input value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d ]/g, ''))} placeholder={t('phoneNumber')} inputMode="tel" autoComplete="tel-national" /></div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-lg" disabled={busy || number.replace(/\D/g, '').length < 6}>{busy ? <Spinner size={22} light /> : t('sendCode')}</button>
          <p className="terms">{t('smsNote')}</p>
        </form>
      ) : (
        <form className="auth-body signup" onSubmit={verify}>
          <h1 className="auth-title">{t('enterCode')}</h1>
          <p className="auth-sub">{t('codeSentTo', { p: e164 })}</p>
          <div className="field"><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" autoComplete="one-time-code" className="code-input" dir="ltr" /></div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-lg" disabled={busy || code.length < 6}>{busy ? <Spinner size={22} light /> : t('confirm')}</button>
          <button type="button" className="text-link" disabled={cooldown > 0 || busy} onClick={send}>{cooldown > 0 ? t('resendIn', { s: cooldown }) : t('resendCode')}</button>
        </form>
      )}
      <div id="recaptcha-box" />
      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} full>
        <CountryList onPick={(c) => { setCountry(c); setPickOpen(false); }} />
      </Sheet>
    </div>
  );
}

function CountryList({ onPick }) {
  const [q, setQ] = useState('');
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'region' }) : null;
  const list = COUNTRIES.map((c) => [...c, names?.of(c[0]) || c[0]]).filter((c) => !q || `${c[3]} ${c[0]} +${c[1]}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="lang-list">
      <div className="search-box pad"><ISearch size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
      {list.map((c) => (
        <button key={c[0]} className="settings-item" onClick={() => onPick(c)}><span>{c[2]}</span><span className="flex1">{c[3]}</span><span className="muted" dir="ltr">+{c[1]}</span></button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Complete profile after first Google / phone sign-in                */
/* ------------------------------------------------------------------ */
function CompleteProfile({ pending, back, finish }) {
  const [f, setF] = useState({ fullName: pending.suggested?.fullName || '', username: cleanUsername(pending.suggested?.username || '') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uState = useUsernameCheck(f.username);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try { finish(await api('auth/complete', { method: 'POST', body: { pending: pending.pending, ...f }, ...noAuth })); }
    catch (err) { setError(errText(err.code)); }
    setBusy(false);
  };
  return (
    <div className="auth">
      <div className="auth-top start"><button className="icon-btn" onClick={back} aria-label="back"><IBack size={28} /></button></div>
      <form className="auth-body signup" onSubmit={submit}>
        <h1 className="auth-title">{t('completeTitle')}</h1>
        <p className="auth-sub">{pending.suggested?.email || pending.suggested?.phone}</p>
        <div className="field"><input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} placeholder={t('fullName')} dir="auto" /></div>
        <div className="field with-icon">
          <input value={f.username} onChange={(e) => setF({ ...f, username: cleanUsername(e.target.value) })} placeholder={t('username')} autoCapitalize="none" dir="ltr" />
          {uState && <span className={`field-status ${uState}`}>{uState === 'ok' ? '✓' : '✕'}</span>}
        </div>
        {uState === 'taken' && <div className="form-hint bad">{t('usernameTaken')}</div>}
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary btn-lg" disabled={busy || !f.fullName.trim() || f.username.length < 3 || uState === 'taken'}>{busy ? <Spinner size={22} light /> : t('next')}</button>
        <p className="terms">{t('terms')}</p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Forgot password (Firebase reset e-mail)                            */
/* ------------------------------------------------------------------ */
function Forgot({ prefill, back, go }) {
  const [id, setId] = useState(prefill || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try { const r = await api('auth/reset', { method: 'POST', body: { identifier: id }, ...noAuth }); setSent(r.sentTo); }
    catch (err) {
      if (err.code === 'use_phone_login') { go('phone'); return; }
      setError(errText(err.code));
    }
    setBusy(false);
  };
  return (
    <div className="auth">
      <div className="auth-top start"><button className="icon-btn" onClick={back} aria-label="back"><IBack size={28} /></button></div>
      <form className="auth-body signup" onSubmit={submit}>
        <div className="forgot-icon"><IMail size={46} /></div>
        <h1 className="auth-title">{t('troubleLogin')}</h1>
        {sent ? (
          <>
            <p className="auth-sub">{t('resetSent', { e: sent })}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={back}>{t('backToLogin')}</button>
          </>
        ) : (
          <>
            <p className="auth-sub">{t('troubleSub')}</p>
            <div className="field"><input value={id} onChange={(e) => setId(e.target.value)} placeholder={t('loginIdShort')} autoCapitalize="none" dir="auto" /></div>
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary btn-lg" disabled={busy || !id.trim()}>{busy ? <Spinner size={22} light /> : t('sendLoginLink')}</button>
            <button type="button" className="text-link" onClick={() => go('phone')}>{t('continuePhone')}</button>
          </>
        )}
      </form>
    </div>
  );
}
