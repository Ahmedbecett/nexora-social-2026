import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api.js';
import { t, errText } from './i18n.js';
import { IBack, IVerified } from './icons.jsx';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function Wordmark({ size = 34, gradient = false, className = '' }) {
  return <span className={`wordmark ${gradient ? 'grad' : ''} ${className}`} style={{ fontSize: size }}>Nexora</span>;
}

/** The Nexora glyph: rounded square + lens + flash dot, drawn with the brand gradient. */
let glyphSeq = 0;
export function Glyph({ size = 72, filled = false, className = '' }) {
  const [id] = useState(() => `nxg${++glyphSeq}`);
  if (filled) {
    return <img src="/icon-192.png" alt="Nexora" width={size} height={size} className={`glyph-filled ${className}`} style={{ borderRadius: size * 0.24 }} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Nexora">
<defs>
<linearGradient id={`${id}a`} gradientUnits="userSpaceOnUse" x1="30" y1="100" x2="62" y2="0"><stop offset="0" stopColor="#ffd600"/><stop offset="0.22" stopColor="#ff9a00"/><stop offset="0.45" stopColor="#ff1f5a"/><stop offset="0.75" stopColor="#e6007e"/><stop offset="1" stopColor="#d000c8"/></linearGradient>
<radialGradient id={`${id}b`} gradientUnits="userSpaceOnUse" cx="4" cy="2" r="62"><stop offset="0" stopColor="#7a2cff"/><stop offset="0.45" stopColor="#8a2be2" stopOpacity="0.85"/><stop offset="1" stopColor="#a020f0" stopOpacity="0"/></radialGradient>
</defs>
<g fill="none" strokeWidth="9.5"><g stroke={`url(#${id}a)`}><rect x="8" y="8" width="84" height="84" rx="25"/><circle cx="50" cy="50" r="19.5"/></g><g stroke={`url(#${id}b)`}><rect x="8" y="8" width="84" height="84" rx="25"/><circle cx="50" cy="50" r="19.5"/></g></g>
<circle cx="74" cy="26" r="6" fill={`url(#${id}a)`}/>
    </svg>
  );
}

/** "from Nexora" footer used on the splash and saved-profiles screens. */
export function FromBrand({ small }) {
  return (
    <div className={`from-brand ${small ? 'small' : ''}`}>
      {!small && <span className="from-label">from</span>}
      <span className="from-name"><Glyph size={small ? 20 : 22} /><span>Nexora</span></span>
    </div>
  );
}

export function Splash() {
  return (
    <div className="splash">
      <Glyph size={92} />
      <FromBrand />
    </div>
  );
}

const COLORS = ['#f58529', '#dd2a7b', '#8134af', '#515bd4', '#0095f6', '#00a67e'];
export function Avatar({ src, name = '', size = 32, ring = null, onClick, className = '' }) {
  const [err, setErr] = useState(false);
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
  const inner = src && !err
    ? <img src={src} alt="" loading="lazy" onError={() => setErr(true)} style={{ width: size, height: size }} />
    : <span className="avatar-fallback" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}>{(name[0] || '?').toUpperCase()}</span>;
  if (!ring) return <span className={`avatar ${className}`} onClick={onClick} style={{ width: size, height: size }}>{inner}</span>;
  const pad = size > 60 ? 4 : 3;
  return (
    <span className={`avatar-ring ${ring} ${className}`} onClick={onClick} style={{ width: size + pad * 2 + 2, height: size + pad * 2 + 2, padding: pad }}>
      <span className="avatar-ring-inner">{inner}</span>
    </span>
  );
}

export function UserName({ user, className = '', onClick }) {
  return (
    <span className={`uname ${className}`} onClick={onClick}>
      <bdi>{user?.username}</bdi>{user?.verified && <IVerified />}
    </span>
  );
}

export function Spinner({ size = 28, light }) {
  return <span className={`spinner ${light ? 'light' : ''}`} style={{ width: size, height: size }} />;
}
export function Loading() { return <div className="center-pad"><Spinner /></div>; }

export function Empty({ icon, title, sub, action }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="empty">
      <h3>{t('error')}</h3>
      <p>{errText(error?.code || 'server_error')}</p>
      {onRetry && <button className="btn btn-secondary" onClick={onRetry}>{t('retry')}</button>}
    </div>
  );
}

export function TopBar({ title, onBack, right, left, transparent, className = '' }) {
  const { nav } = useApp();
  return (
    <header className={`topbar ${transparent ? 'transparent' : ''} ${className}`}>
      <div className="topbar-side">
        {left ?? <button className="icon-btn" onClick={onBack || nav.pop} aria-label="back"><IBack size={26} /></button>}
      </div>
      <div className="topbar-title">{title}</div>
      <div className="topbar-side end">{right}</div>
    </header>
  );
}

export function Sheet({ open, onClose, children, title, full }) {
  const [show, setShow] = useState(open);
  useEffect(() => { if (open) setShow(true); else { const tm = setTimeout(() => setShow(false), 220); return () => clearTimeout(tm); } }, [open]);
  if (!show) return null;
  return createPortal(
    <div className={`sheet-wrap ${open ? 'open' : 'closing'}`} onClick={onClose}>
      <div className={`sheet ${full ? 'full' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {title && <div className="sheet-title">{title}</div>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>, document.body
  );
}

export function ActionSheet({ open, onClose, actions }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="actions">
        {actions.filter(Boolean).map((a, i) => (
          <button key={i} className={`action ${a.danger ? 'danger' : ''}`} onClick={() => { onClose(); a.onClick(); }}>
            {a.icon}<span>{a.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function Confirm({ open, title, text, okLabel, danger, onOk, onClose }) {
  if (!open) return null;
  return createPortal(
    <div className="dialog-wrap" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {text && <p>{text}</p>}
        <button className={`dialog-btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onClose(); onOk(); }}>{okLabel}</button>
        <button className="dialog-btn" onClick={onClose}>{t('cancel')}</button>
      </div>
    </div>, document.body
  );
}

export function FollowButton({ user, status: initial, small, onChange, className = '' }) {
  const { toast } = useApp();
  const [status, setStatus] = useState(initial || 'none');
  const [busy, setBusy] = useState(false);
  useEffect(() => setStatus(initial || 'none'), [initial]);
  const click = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const prev = status;
    try {
      let r;
      if (status === 'none') { setStatus(user.isPrivate ? 'pending' : 'accepted'); r = await api(`users/${user.id}/follow`, { method: 'POST' }); }
      else { setStatus('none'); r = await api(`users/${user.id}/follow`, { method: 'DELETE' }); }
      setStatus(r.followStatus); onChange?.(r.followStatus);
    } catch (err) { setStatus(prev); toast(errText(err.code)); }
    setBusy(false);
  };
  const label = status === 'accepted' ? t('followingBtn') : status === 'pending' ? t('requested') : t('follow');
  return (
    <button className={`btn ${status === 'none' ? 'btn-primary' : 'btn-secondary'} ${small ? 'btn-sm' : ''} ${className}`} onClick={click}>
      {label}
    </button>
  );
}

/** Caption text with clickable #hashtags and @mentions */
export function RichText({ text, onTag, onMention }) {
  if (!text) return null;
  const parts = text.split(/([#@][\p{L}\p{N}_.]+)/u);
  return parts.map((p, i) => {
    if (/^#[\p{L}\p{N}_]+/u.test(p)) return <span key={i} className="link" onClick={(e) => { e.stopPropagation(); onTag?.(p.slice(1)); }}>{p}</span>;
    if (/^@[a-z0-9._]{3,30}$/i.test(p)) return <span key={i} className="link" onClick={(e) => { e.stopPropagation(); onMention?.(p.slice(1).replace(/\.$/, '')); }}>{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

/** Autoplaying muted video when visible */
export function AutoVideo({ src, poster, className, muted = true, loop = true, onClick, style, controlsRef }) {
  const ref = useRef();
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio > 0.6) v.play().catch(() => {});
      else v.pause();
    }, { threshold: [0, 0.6, 1] });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  useEffect(() => { if (controlsRef) controlsRef.current = ref.current; });
  return <video disableRemotePlayback ref={ref} src={src} poster={poster || undefined} className={className} muted={muted} loop={loop} playsInline preload="metadata" onClick={onClick} style={style} />;
}

export function Tabs({ tabs, value, onChange, icons }) {
  return (
    <div className={`tabs ${icons ? 'icon-tabs' : ''}`}>
      {tabs.map((tb) => (
        <button key={tb.id} className={`tab ${value === tb.id ? 'active' : ''}`} onClick={() => onChange(tb.id)}>
          {tb.icon || tb.label}
        </button>
      ))}
    </div>
  );
}

export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try { const data = await fn(); setState({ loading: false, data, error: null }); }
    catch (error) { setState({ loading: false, data: null, error }); }
  };
  useEffect(() => { load(); }, deps); // eslint-disable-line
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

export function thumbOf(post) {
  const m = post?.media?.[0];
  if (!m) return null;
  return { src: m.type === 'video' ? (m.poster || m.url) : m.url, isVideo: m.type === 'video' && !m.poster, video: m.type === 'video' };
}

export function Thumb({ post, onClick, tall }) {
  const th = thumbOf(post);
  if (!th) return null;
  return (
    <div className={`grid-item ${tall ? 'tall' : ''}`} onClick={onClick}>
      {th.isVideo ? <video disableRemotePlayback src={th.src + '#t=0.5'} muted playsInline preload="metadata" /> : <img src={th.src} alt="" loading="lazy" />}
      {post.kind === 'reel' && <span className="grid-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm2.6 7.5v7l5.5-3.5Z" /></svg></span>}
      {post.kind !== 'reel' && post.media.length > 1 && <span className="grid-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8 2h11a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm-6 5v12a3 3 0 0 0 3 3h12v-2H5a1 1 0 0 1-1-1V7Z" /></svg></span>}
    </div>
  );
}
