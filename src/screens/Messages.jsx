import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, uploadMedia, uploadBlob } from '../api.js';
import { t, timeAgo, errText, getLang } from '../i18n.js';
import { useApp, Avatar, UserName, TopBar, Loading, Empty, ErrorBox, Sheet, Spinner, Confirm, ActionSheet, useAsync } from '../components.jsx';
import { IEdit, ISend, IImage, IComment, IReply, ICopy, IPin, IUnsend, ITrash, IPlus, IClose, IMic, IPlay, IPause, IArrowUp, ICamera, IPhone } from '../icons.jsx';
import { IScissors, IHandset, ICamcorder, IPencilSoft } from '../chatkit/icons2.jsx';
import { tapHaptic } from '../theme.js';
import {
  ChatComposer, ChatDrawer, AiMenu, LocationSheet, AiImageSheet, DrawSheet, AiChatSheet,
  CutoutSheet, MusicSheet, EffectSheet, KitSettingsSheet, DragLayer,
  StickerBubble, GifBubble, LocationBubble, MusicBubble,
} from '../chatkit/ChatKit.jsx';
import { startCall, isCallSignal, isCallLog, parseCallLog } from '../chatkit/call.js';
import { ct } from '../chatkit/callText.js';
import { CallLogBubble } from '../chatkit/calls.jsx';
import { rasterize, readFile } from '../chatkit/lib.js';

/** "Active now" / "Active 9m ago" (hidden after 7 days or when activity status is off). */
export function activeLabel(at) {
  if (!at) return '';
  const d = Date.now() - new Date(at).getTime();
  if (d < 5 * 60000) return t('activeNowLive');
  if (d < 7 * 864e5) return t('activeAgo', { t: timeAgo(at) });
  return '';
}
const isActiveNow = (at) => !!at && Date.now() - new Date(at).getTime() < 5 * 60000;

export function Inbox({ isTab = false, active = true }) {
  const { me, nav, refreshBadges } = useApp();
  const { loading, data, error, reload } = useAsync(() => api('conversations'), []);
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const iv = setInterval(() => { if (document.visibilityState === 'visible') reload(true); }, 15000);
    return () => clearInterval(iv);
  }, [active]); // eslint-disable-line
  useEffect(() => { const h = () => reload(); window.addEventListener('nx-msg', h); return () => window.removeEventListener('nx-msg', h); }); // eslint-disable-line
  const convs = (data?.conversations || []).filter((c) => !q || c.user.username.includes(q.toLowerCase()) || (c.user.fullName || '').toLowerCase().includes(q.toLowerCase()));
  const preview = (c) => {
    const prefix = c.last.mine ? `${t('you')}: ` : '';
    if (isCallSignal(c.last.text)) return prefix + ct('ckCallPreviewAudio');
    if (isCallLog(c.last.text)) {
      const d = parseCallLog(c.last.text) || {};
      if (d.d === 'missed') return prefix + ct(d.k === 'video' ? 'ckLogMissedVideo' : 'ckLogMissedAudio');
      return prefix + ct(d.k === 'video' ? 'ckCallPreviewVideo' : 'ckCallPreviewAudio');
    }
    if (c.last.post) return prefix + t('sentPost');
    if (c.last.media && !c.last.text) return prefix + t(c.last.mediaType === 'audio' ? 'sentVoice' : c.last.mediaType === 'video' ? 'sentVideo' : 'sentPhoto');
    return prefix + c.last.text;
  };
  return (
    <div className="screen">
      <TopBar left={isTab ? <span /> : undefined} className={isTab ? 'start-title' : ''} title={<b>{me.username}</b>} right={<button className="icon-btn" onClick={() => setNewOpen(true)} aria-label={t('newMessage')}><IPencilSoft size={25} /></button>} />
      <div className="scroll">
        <div className="search-box pad"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
        <div className="section-head pad"><b>{t('messages')}</b></div>
        {loading ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : convs.length === 0 ? (
          <Empty icon={<IComment size={40} />} title={t('noMessages')} sub={t('noMessagesSub')}
            action={<button className="btn btn-primary" onClick={() => setNewOpen(true)}>{t('newMessage')}</button>} />
        ) : (
          <div className="user-list">
            {convs.map((c) => (
              <div className={`user-row conv ${c.unread ? 'unread' : ''}`} key={c.user.id} onClick={() => { nav.push('chat', { user: c.user, onBack: () => { reload(); refreshBadges(); } }); }}>
                <span className="avatar-presence"><Avatar src={c.user.avatarUrl} name={c.user.username} size={56} />{isActiveNow(c.activeAt) && <i className="presence-dot" />}</span>
                <div className="user-row-text">
                  <span className="conv-name">{c.user.fullName || c.user.username}</span>
                  <span className="conv-last">{c.unread || !activeLabel(c.activeAt) ? <><span className="ellipsis">{preview(c)}</span> · {timeAgo(c.last.createdAt)}</> : <span className="ellipsis">{activeLabel(c.activeAt)}</span>}</span>
                </div>
                {c.unread > 0 && <span className="unread-dot" />}
              </div>
            ))}
          </div>
        )}
      </div>
      <UserPicker open={newOpen} onClose={() => setNewOpen(false)} title={t('newMessage')} onPick={(u) => nav.push('chat', { user: u })} />
    </div>
  );
}

/** Pick a user (new message / forward). */
function UserPicker({ open, onClose, title, onPick }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  useEffect(() => {
    if (!open) return;
    setQ(''); setUsers(null);
    Promise.all([api('conversations').catch(() => ({ conversations: [] })), api('suggestions').catch(() => ({ users: [] }))])
      .then(([c, s]) => {
        const seen = new Set(); const list = [];
        for (const u of [...(c.conversations || []).map((x) => x.user), ...(s.users || [])]) if (!seen.has(u.id)) { seen.add(u.id); list.push(u); }
        setUsers(list);
      });
  }, [open]);
  useEffect(() => {
    if (!q.trim()) return undefined;
    const tm = setTimeout(() => api(`search/users?q=${encodeURIComponent(q)}`).then((r) => setUsers(r.users)).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [q]);
  return (
    <Sheet open={open} onClose={onClose} title={title} full>
      <div className="search-box sheet-search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} dir="auto" /></div>
      <div className="user-list">
        {users === null ? <Loading /> : users.map((u) => (
          <div className="user-row" key={u.id} onClick={() => { onClose(); onPick(u); }}>
            <Avatar src={u.avatarUrl} name={u.username} size={48} />
            <div className="user-row-text"><span className="conv-name">{u.fullName || u.username}</span><UserName user={u} className="muted" /></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------------- chat ---------------- */
const QUICK = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const MORE = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '👏', '🙏', '😍', '🥰', '😘', '😁', '😅', '🤣', '😊',
  '😎', '🤔', '🙄', '😴', '🥺', '😭', '😤', '🤯', '🥳', '😇', '🤗', '🤝', '👌', '✌️', '💪', '👀',
  '💯', '✨', '🎉', '💔', '💙', '💚', '💛', '🖤', '🤍', '💜', '🌹', '⭐', '☀️', '🌙', '⚽', '🎶'];
const isEmojiOnly = (s) => !!s && s.length <= 16 && /\p{Extended_Pictographic}/u.test(s)
  && /^[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\s]+$/u.test(s) && !/[0-9#*]/.test(s);
const preview = (m) => {
  if (isCallSignal(m.text)) return `📞 ${ct('ckCallPreviewAudio')}`;
  if (isCallLog(m.text)) {
    const d = parseCallLog(m.text) || {};
    if (d.d === 'missed') return `📞 ${ct(d.k === 'video' ? 'ckLogMissedVideo' : 'ckLogMissedAudio')}`;
    return `📞 ${ct(d.k === 'video' ? 'ckCallPreviewVideo' : 'ckCallPreviewAudio')}`;
  }
  const k = m.mediaMeta?.kind;
  if (k === 'sticker') return `🎨 ${t('ckSticker')}`;
  if (k === 'gif') return `🎞️ ${t('ckGifs')}`;
  if (k === 'cutout') return `✂️ ${t('ckCutouts')}`;
  if (k === 'draw') return `✍️ ${t('ckDraw')}`;
  if (k === 'ai') return `✨ ${t('ckAiImages')}`;
  if (k === 'location') return `📍 ${m.mediaMeta?.place || m.text || t('ckLocation')}`;
  if (k === 'music') return `🎵 ${m.mediaMeta?.title || t('ckMusic')}`;
  return m.text ? m.text : m.mediaType === 'audio' ? `🎤 ${t('msgVoice')}` : m.mediaType === 'video' ? `🎬 ${t('msgVideo')}`
    : m.media || m.mediaUrl ? `📷 ${t('msgPhoto')}` : m.post ? t('msgPost') : '';
};
const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function resample(arr, n) {
  if (!arr?.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * arr.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * arr.length) / n));
    out.push(Math.max(...arr.slice(a, b)));
  }
  const max = Math.max(0.05, ...out);
  return out.map((v) => v / max);
}
function pseudoPeaks(seed, n) { // stable fallback waveform when none was recorded
  let x = (Number(seed) || 1) * 9301 + 49297;
  return Array.from({ length: n }, () => { x = (x * 9301 + 49297) % 233280; return 0.25 + (x / 233280) * 0.75; });
}

let playingAudio = null;
function VoiceBubble({ m }) {
  const ref = useRef();
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(m.mediaMeta?.duration || 0);
  const peaks = useMemo(() => (m.mediaMeta?.peaks?.length ? resample(m.mediaMeta.peaks, 30) : pseudoPeaks(m.id, 30)), [m.id, m.mediaMeta]);
  const toggle = (e) => {
    e.stopPropagation();
    const a = ref.current; if (!a) return;
    if (a.paused) { if (playingAudio && playingAudio !== a) playingAudio.pause(); playingAudio = a; a.play().catch(() => {}); } else a.pause();
  };
  const frac = dur ? Math.min(1, pos / dur) : 0;
  return (
    <div className="bubble voice-bubble" dir="ltr">
      <button className="voice-play" onClick={toggle} aria-label="play">{playing ? <IPause size={20} /> : <IPlay size={20} />}</button>
      <div className="voice-wave">{peaks.map((v, i) => <i key={i} className={(i + 0.5) / peaks.length <= frac ? 'on' : ''} style={{ height: `${18 + v * 82}%` }} />)}</div>
      <span className="voice-time">{fmtDur(playing || pos ? dur - pos : dur)}</span>
      <audio ref={ref} src={m.mediaUrl} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPos(0); }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDur(d); }} />
    </div>
  );
}

function MediaViewer({ v, onClose }) {
  useEffect(() => {
    const h = () => onClose();
    document.addEventListener('nx-close-overlay', h);
    return () => document.removeEventListener('nx-close-overlay', h);
  }, [onClose]);
  return createPortal(
    <div className="media-viewer" onClick={onClose}>
      <button className="media-viewer-x" onClick={onClose} aria-label="close"><IClose size={26} /></button>
      {v.type === 'video'
        ? <video src={v.url} poster={v.poster || undefined} controls autoPlay playsInline disableRemotePlayback onClick={(e) => e.stopPropagation()} />
        : <img src={v.url} alt="" draggable={false} onClick={(e) => e.stopPropagation()} />}
    </div>, document.body,
  );
}
const menuTime = (d) => {
  const dt = new Date(d);
  const recent = Date.now() - dt < 6 * 864e5;
  try {
    return dt.toLocaleString(getLang(), recent ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).toUpperCase();
  } catch { return dt.toLocaleString(); }
};
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

function MsgBody({ m, onPost, onMedia }) {
  const kind = m.mediaMeta?.kind;
  // ملصق / صورة متحركة / موقع / موسيقى: عرض خاص بدون فقاعة
  if (m.mediaUrl && kind === 'sticker') return <StickerBubble m={m} onOpen={onMedia} />;
  if (m.mediaUrl && kind === 'cutout') return <StickerBubble m={m} big onOpen={onMedia} />;
  if (m.mediaUrl && kind === 'draw') return <StickerBubble m={m} big onOpen={onMedia} />;
  if (m.mediaUrl && kind === 'gif') return <GifBubble m={m} />;
  if (m.mediaUrl && kind === 'location') return <LocationBubble m={m} />;
  if (m.mediaUrl && kind === 'music') return <MusicBubble m={m} />;
  return (
    <>
      {m.post && (
        <div className="bubble-post" onClick={onPost}>
          {m.post.username && <div className="bubble-post-head">{m.post.username}</div>}
          {m.post.thumb && (m.post.type === 'video' ? <video disableRemotePlayback src={m.post.thumb + '#t=0.3'} muted /> : <img src={m.post.thumb} alt="" draggable={false} />)}
        </div>
      )}
      {m.mediaUrl && m.mediaType === 'audio' && <VoiceBubble m={m} />}
      {m.mediaUrl && m.mediaType === 'video' && (
        <div className="bubble-video" onClick={() => onMedia?.({ type: 'video', url: m.mediaUrl, poster: m.mediaMeta?.poster })}>
          {m.mediaMeta?.poster ? <img src={m.mediaMeta.poster} alt="" draggable={false} /> : <video disableRemotePlayback src={m.mediaUrl + '#t=0.1'} muted playsInline preload="metadata" />}
          <span className="bubble-video-play"><IPlay size={28} /></span>
        </div>
      )}
      {m.mediaUrl && (!m.mediaType || m.mediaType === 'image') && (
        <span className={`ck-img-wrap ${kind === 'ai' ? 'ai' : ''}`}>
          <img className="bubble-img" src={m.mediaUrl} alt="" draggable={false} onClick={() => onMedia?.({ type: 'image', url: m.mediaUrl })} />
          {kind === 'ai' && <span className="ck-ai-badge">✨ {t('ckAiImages')}</span>}
        </span>
      )}
      {m.text && <div className={`bubble ${isEmojiOnly(m.text) ? 'emoji' : ''}`} dir="auto">{m.text}</div>}
    </>
  );
}

function MessageRow({ m, user, showAvatar, flash, onMenu, onDoubleTap, onSwipeReply, onReactions, onJump, onMedia, nav }) {
  const bodyRef = useRef();
  const st = useRef({});
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const setOffset = (v) => { dxRef.current = v; setDx(v); };
  const reset = () => { const s = st.current; clearTimeout(s.timer); s.x = null; s.swiping = false; s.buzzed = false; setOffset(0); };

  const onPointerDown = (e) => {
    if (e.button) return;
    const s = st.current;
    s.x = e.clientX; s.y = e.clientY; s.moved = false; s.swiping = false; s.fired = false; s.buzzed = false;
    clearTimeout(s.timer);
    s.timer = setTimeout(() => { s.fired = true; tapHaptic(); onMenu(m, bodyRef.current); }, 420);
  };
  const onPointerMove = (e) => {
    const s = st.current;
    if (s.x == null) return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (!s.swiping) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      clearTimeout(s.timer); s.moved = true;
      if (!s.fired && Math.abs(ddx) > Math.abs(ddy) * 1.3) s.swiping = true;
      else { s.x = null; return; }
    }
    const v = Math.max(-76, Math.min(76, ddx));
    setOffset(v);
    if (Math.abs(v) >= 56 && !s.buzzed) { s.buzzed = true; tapHaptic(); }
  };
  const onPointerUp = () => {
    const s = st.current;
    clearTimeout(s.timer);
    if (s.swiping && Math.abs(dxRef.current) >= 56) onSwipeReply(m);
    else if (s.x != null && !s.moved && !s.fired) {
      const now = Date.now();
      if (now - (s.lastTap || 0) < 300) { s.lastTap = 0; onDoubleTap(m); } else s.lastTap = now;
    }
    reset();
  };
  const onClickCapture = (e) => { if (st.current.fired) { e.stopPropagation(); e.preventDefault(); st.current.fired = false; } };

  const reacts = m.reactions || [];
  const uniq = [...new Set(reacts.map((r) => r.emoji))].slice(0, 3);
  let replyLabel = '';
  if (m.reply) {
    const u = user.username;
    replyLabel = m.mine ? (m.reply.mine ? t('msgYouReplied') : t('msgYouRepliedTo', { u })) : (m.reply.mine ? t('msgRepliedToYou', { u }) : t('msgRepliedToSelf', { u }));
  }
  return (
    <div className={`bubble-row ${m.mine ? 'mine' : ''} ${reacts.length ? 'has-reacts' : ''} ${flash ? 'flash' : ''}`} id={`msg-${m.id}`}>
      {!m.mine && (showAvatar ? <Avatar src={user.avatarUrl} name={user.username} size={28} /> : <span className="avatar-gap" />)}
      <div className="bubble-col">
        {m.reply && (
          <div className="reply-ref" onClick={() => !m.reply.gone && onJump(m.reply.id)}>
            <span className="reply-label"><IReply size={12} /> {replyLabel}</span>
            <div className="reply-quote" dir="auto">{m.reply.gone ? t('msgUnavailable') : preview(m.reply)}</div>
          </div>
        )}
        <div ref={bodyRef} className={`bubble-body ${dx ? 'dragging' : ''}`} style={dx ? { transform: `translateX(${dx}px)` } : undefined}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={reset} onPointerLeave={() => st.current.swiping || reset()}
          onClickCapture={onClickCapture} onContextMenu={(e) => e.preventDefault()}>
          {m.edited && <span className="edited-label">{t('msgEdited')}</span>}
          <MsgBody m={m} onPost={() => nav.push('post', { id: m.post.id })} onMedia={onMedia} />
          {reacts.length > 0 && (
            <button className="msg-reacts" onClick={(e) => { e.stopPropagation(); onReactions(m); }}>
              {uniq.map((e) => <span key={e}>{e}</span>)}{reacts.length > 1 && <b>{reacts.length}</b>}
            </button>
          )}
        </div>
      </div>
      {dx !== 0 && <span className={`swipe-reply ${Math.abs(dx) >= 56 ? 'ready' : ''}`} style={{ opacity: Math.min(1, Math.abs(dx) / 56) }}><IReply size={18} /></span>}
    </div>
  );
}

function MessageMenu({ m, rect, onClose, onReact, onAction }) {
  const [more, setMore] = useState(false);
  const [top, setTop] = useState(null);
  const boxRef = useRef();
  useLayoutEffect(() => {
    const h = boxRef.current?.offsetHeight || 0;
    const vh = window.innerHeight;
    setTop(Math.max(16, Math.min(rect.top - 70, vh - h - 16)));
  }, [more, rect.top]);
  const mine = m.reactions?.find((r) => r.mine)?.emoji;
  const items = [
    { k: 'reply', icon: <IReply size={24} />, label: t('msgReply') },
    { k: 'forward', icon: <ISend size={24} />, label: t('msgForward') },
    m.text && { k: 'copy', icon: <ICopy size={24} />, label: t('msgCopy') },
    m.mine && m.text && !m.mediaUrl && !m.post && Date.now() - new Date(m.createdAt) < 15 * 60000 && { k: 'edit', icon: <IEdit size={24} />, label: t('msgEdit') },
    { k: m.pinned ? 'unpin' : 'pin', icon: <IPin size={24} />, label: t(m.pinned ? 'msgUnpin' : 'msgPin') },
    { k: 'hide', icon: <ITrash size={24} />, label: t('msgDeleteForYou') },
    m.mine && { k: 'unsend', icon: <IUnsend size={24} />, label: t('msgUnsend'), danger: true },
  ].filter(Boolean);
  return createPortal(
    <div className="msg-menu-wrap" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div ref={boxRef} className={`msg-menu-box ${m.mine ? 'mine' : ''}`} style={{ top: top ?? rect.top, visibility: top == null ? 'hidden' : 'visible' }} onClick={(e) => e.stopPropagation()}>
        <div className="react-bar">
          {QUICK.map((e) => <button key={e} className={mine === e ? 'on' : ''} onClick={() => onReact(m, e)}>{e}</button>)}
          <button className={`react-more ${more ? 'on' : ''}`} onClick={() => setMore((v) => !v)} aria-label="more"><IPlus size={26} /></button>
        </div>
        {more && <div className="react-grid">{MORE.map((e) => <button key={e} className={mine === e ? 'on' : ''} onClick={() => onReact(m, e)}>{e}</button>)}</div>}
        <div className="msg-menu-clone"><MsgBody m={m} /></div>
        <div className="msg-menu-card">
          <div className="msg-menu-time">{menuTime(m.createdAt)}</div>
          {items.map((it) => (
            <button key={it.k} className={`msg-menu-item ${it.danger ? 'danger' : ''}`} onClick={() => onAction(it.k, m)}>{it.icon}<span>{it.label}</span></button>
          ))}
        </div>
      </div>
    </div>, document.body,
  );
}

export function Chat({ user, onBack, active }) {
  const { me, nav, toast, refreshBadges } = useApp();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [menu, setMenu] = useState(null);       // { m, rect }
  const [reactSheet, setReactSheet] = useState(null);
  const [forward, setForward] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, m }
  const [flashId, setFlashId] = useState(0);
  const [activeAt, setActiveAt] = useState(null);
  const [typing, setTyping] = useState(false);
  const typingSent = useRef(0);
  const [editing, setEditing] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState('stickers');
  const [aiMenu, setAiMenu] = useState(false);
  const [tool, setTool] = useState(null);
  const [camMenu, setCamMenu] = useState(false);
  const [fxSrc, setFxSrc] = useState(null);
  const [fxEffect, setFxEffect] = useState('vivid');
  const [aiSeed, setAiSeed] = useState('');
  const composerRef = useRef();
  const fxInputRef = useRef();
  const camRef = useRef();
  const dragRef = useRef(null);
  const [drag, setDragState] = useState(null);
  const setDrag = (v) => { dragRef.current = v; setDragState(v); };
  const [recording, setRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [recLevels, setRecLevels] = useState([]);
  const recRef = useRef(null);
  const lastId = useRef(0);
  const since = useRef(null);
  const endRef = useRef();
  const fileRef = useRef();
  const inputRef = useRef();
  const lastRendered = useRef(0);
  const removed = useRef(new Set()); // ids unsent / deleted here: never let a stale poll bring them back

  const merge = (list, incoming) => {
    const map = new Map((list || []).map((x) => [x.id, x]));
    for (const x of incoming) { if (x.gone || removed.current.has(x.id)) map.delete(x.id); else map.set(x.id, x); }
    return [...map.values()].sort((a, b) => a.id - b.id);
  };
  const fetchNew = async (initial) => {
    try {
      const qs = initial ? 'after=0' : `after=${lastId.current}${since.current ? `&since=${encodeURIComponent(since.current)}` : ''}`;
      const r = await api(`messages/${user.id}?${qs}`);
      if (r.serverTime) since.current = new Date(new Date(r.serverTime).getTime() - 2000).toISOString();
      setActiveAt(r.activeAt || null); setTyping(!!r.typing);
      for (const x of r.messages) if (!x.gone && x.id > lastId.current) lastId.current = x.id;
      if (initial) setMsgs(r.messages.filter((x) => !x.gone && !removed.current.has(x.id)));
      else if (r.messages.length) setMsgs((m) => merge(m, r.messages));
    } catch (e) { if (initial) setMsgs([]); }
  };
  useEffect(() => {
    fetchNew(true).then(() => refreshBadges());
    const iv = setInterval(() => { if (document.visibilityState === 'visible') fetchNew(false); }, 3000);
    return () => { clearInterval(iv); onBack?.(); window.dispatchEvent(new Event('nx-msg')); };
  }, [user.id]); // eslint-disable-line
  useEffect(() => {
    const last = msgs?.[msgs.length - 1]?.id || 0;
    if (last > lastRendered.current) { endRef.current?.scrollIntoView({ block: 'end' }); lastRendered.current = last; }
  }, [msgs]);
  useEffect(() => { if (typing) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [typing]);
  useEffect(() => {
    const h = () => setMenu(null);
    document.addEventListener('nx-close-overlay', h);
    return () => document.removeEventListener('nx-close-overlay', h);
  }, []);

  const patch = (id, fn) => setMsgs((list) => (list || []).map((x) => (x.id === id ? fn(x) : x)));
  const drop = (id) => { removed.current.add(id); setMsgs((list) => (list || []).filter((x) => x.id !== id)); if (replyTo?.id === id) setReplyTo(null); };

  const send = async (payload) => {
    if (sending) return;
    if (editing && payload.text !== undefined) {
      const m = editing;
      setSending(true);
      try {
        const r = await api(`message/${m.id}`, { method: 'PATCH', body: { text: payload.text } });
        setMsgs((list) => merge(list, [r.message]));
        setText(''); setEditing(null);
      } catch (e) { toast(errText(e.code)); }
      setSending(false);
      return;
    }
    setSending(true);
    try {
      const r = await api(`messages/${user.id}`, { method: 'POST', body: { ...payload, replyTo: replyTo?.id } });
      lastId.current = Math.max(lastId.current, r.message.id);
      setMsgs((m) => merge(m, [r.message]));
      setText(''); setReplyTo(null);
    } catch (e) { toast(errText(e.code)); }
    setSending(false);
  };
  const sendPhoto = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setSending(true);
    try {
      const m = await uploadMedia(f);
      setSending(false);
      await send({ mediaUrl: m.url, mediaType: m.type, mediaMeta: { w: m.w, h: m.h, poster: m.poster || undefined } });
    } catch (err) { toast(errText(err.code || 'server_error')); setSending(false); }
  };

  /* ---- ChatKit: ملصقات، صور متحركة، أدوات ---- */
  const sendKit = async ({ blob, url: directUrl, mime = 'image/png', w, h, text: caption, meta = {} }) => {
    setSending(true);
    try {
      const url = directUrl || await uploadBlob(blob, mime);
      await send({ mediaUrl: url, mediaType: 'image', text: caption || undefined, mediaMeta: { ...meta, w, h } });
      setDrawer(false);
    } catch (e) { console.warn('[chatkit] send failed', e?.code || e?.message || e); toast(errText(e.code || 'server_error')); }
    setSending(false);
  };
  const sendSticker = async (item) => {
    tapHaptic();
    try {
      if (item.source === 'giphy') { await send({ mediaUrl: item.url, mediaType: 'image', mediaMeta: { kind: 'sticker', w: item.w, h: item.h } }); return; }
      const { blob, w, h } = await rasterize(item.url, 512);
      await sendKit({ blob, mime: 'image/png', w, h, meta: { kind: 'sticker' } });
    } catch { toast(errText('server_error')); }
  };
  const sendGif = async (item) => {
    tapHaptic();
    try {
      if (item.source === 'giphy') { await send({ mediaUrl: item.url, mediaType: 'image', mediaMeta: { kind: 'gif', w: item.w, h: item.h } }); return; }
      const res = await fetch(item.url);
      const blob = await res.blob();
      await sendKit({ blob, mime: blob.type || 'image/gif', w: item.w, h: item.h, meta: { kind: 'gif' } });
    } catch { toast(errText('network')); }
  };
  /* سحب الملصق من اللوحة وإفلاته في المحادثة */
  const handleDrag = (e) => {
    if (e.phase === 'start') { tapHaptic(); setDrag({ phase: 'down', item: e.item, x: e.x, y: e.y }); return; }
    if (e.phase === 'move') {
      const top = composerRef.current?.getBoundingClientRect().top ?? window.innerHeight;
      setDrag({ phase: 'move', item: e.item, x: e.x, y: e.y, over: e.y < top });
      return;
    }
    const cur = dragRef.current;
    setDrag(null);
    if (cur?.over && cur.item) (cur.item.kind === 'gif' ? sendGif : sendSticker)(cur.item);
  };
  const onFxFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setDrawer(false);
    try { setFxSrc(await readFile(f)); } catch { toast(errText('unsupported_type')); }
  };

  /* ---- voice messages ---- */
  const startRec = async () => {
    if (recRef.current || sending) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { toast(t('msgMicUnsupported')); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { toast(t('msgMicDenied')); return; }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((x) => MediaRecorder.isTypeSupported?.(x)) || '';
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined); }
    catch { stream.getTracks().forEach((x) => x.stop()); toast(t('msgMicUnsupported')); return; }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    const levels = [];
    let ctx = null, an = null, buf = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      an = ctx.createAnalyser(); an.fftSize = 512; buf = new Uint8Array(an.fftSize);
      ctx.createMediaStreamSource(stream).connect(an);
    } catch { ctx = null; }
    const start = Date.now();
    const tick = setInterval(() => {
      let lv = 0.3;
      if (an) { an.getByteTimeDomainData(buf); let pk = 0; for (let i = 0; i < buf.length; i++) pk = Math.max(pk, Math.abs(buf[i] - 128) / 128); lv = Math.min(1, pk * 1.8); }
      levels.push(lv);
      setRecLevels(levels.slice(-34)); setRecTime(Date.now() - start);
      if (Date.now() - start > 180000) stopRec(true);
    }, 100);
    rec.start(250);
    recRef.current = { rec, stream, chunks, ctx, tick, levels, start, mime };
    setRecLevels([]); setRecTime(0); setRecording(true); tapHaptic();
  };
  const stopRec = async (doSend) => {
    const r = recRef.current; if (!r) return;
    recRef.current = null; clearInterval(r.tick); setRecording(false);
    await new Promise((res) => { r.rec.onstop = res; try { r.rec.stop(); } catch { res(); } setTimeout(res, 1500); });
    r.stream.getTracks().forEach((x) => x.stop());
    try { r.ctx?.close(); } catch { /* ignore */ }
    const duration = (Date.now() - r.start) / 1000;
    if (!doSend || duration < 0.8 || !r.chunks.length) return;
    const base = (r.rec.mimeType || r.mime || 'audio/webm').split(';')[0];
    const type = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac'].includes(base) ? base : 'audio/webm';
    const blob = new Blob(r.chunks, { type });
    setSending(true);
    try {
      const url = await uploadBlob(blob, type);
      setSending(false);
      await send({ mediaUrl: url, mediaType: 'audio', mediaMeta: { duration: Math.round(duration * 10) / 10, peaks: resample(r.levels, 40) } });
    } catch (e) { toast(errText(e.code || 'server_error')); setSending(false); }
  };
  useEffect(() => () => { if (recRef.current) { const r = recRef.current; recRef.current = null; clearInterval(r.tick); try { r.rec.stop(); } catch { /* */ } r.stream.getTracks().forEach((x) => x.stop()); } }, []);

  const react = async (m, emoji) => {
    setMenu(null);
    const cur = m.reactions?.find((r) => r.mine)?.emoji;
    const remove = cur === emoji;
    patch(m.id, (x) => ({ ...x, reactions: [...(x.reactions || []).filter((r) => !r.mine), ...(remove ? [] : [{ emoji, mine: true }])] }));
    try {
      if (remove) await api(`message/${m.id}/react`, { method: 'DELETE' });
      else await api(`message/${m.id}/react`, { method: 'POST', body: { emoji } });
    } catch (e) { toast(errText(e.code)); fetchNew(false); }
  };
  const startReply = (m) => { setReplyTo(m); setTimeout(() => inputRef.current?.focus(), 60); };
  const jump = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlashId(id); setTimeout(() => setFlashId(0), 1300);
  };
  const action = async (k, m) => {
    setMenu(null);
    try {
      if (k === 'reply') startReply(m);
      else if (k === 'forward') setForward(m);
      else if (k === 'copy') { if (await copyText(m.text)) toast(t('msgCopied')); }
      else if (k === 'edit') { setReplyTo(null); setEditing(m); setText(m.text); setTimeout(() => inputRef.current?.focus(), 60); }
      else if (k === 'pin') { patch(m.id, (x) => ({ ...x, pinned: true })); await api(`message/${m.id}/pin`, { method: 'POST' }); }
      else if (k === 'unpin') { patch(m.id, (x) => ({ ...x, pinned: false })); await api(`message/${m.id}/pin`, { method: 'DELETE' }); }
      else if (k === 'hide') setConfirm({ kind: 'hide', m });
      else if (k === 'unsend') setConfirm({ kind: 'unsend', m });
    } catch (e) { toast(errText(e.code)); fetchNew(false); }
  };
  const doConfirm = async () => {
    const { kind, m } = confirm;
    drop(m.id);
    try {
      if (kind === 'unsend') await api(`message/${m.id}`, { method: 'DELETE' });
      else await api(`message/${m.id}/hide`, { method: 'POST' });
    } catch (e) { removed.current.delete(m.id); toast(errText(e.code)); fetchNew(true); }
  };
  const doForward = async (to) => {
    const m = forward; setForward(null);
    try {
      await api(`messages/${to.id}`, { method: 'POST', body: { text: m.text || '', mediaUrl: m.mediaUrl || undefined, mediaType: m.mediaType || undefined, mediaMeta: m.mediaMeta || undefined, postId: m.post?.id || undefined } });
      toast(t('msgSent'));
    } catch (e) { toast(errText(e.code)); }
  };

  const shown = msgs ? msgs.filter((m) => !isCallSignal(m.text)) : null;
  const pinned = shown ? [...shown].reverse().find((x) => x.pinned) : null;
  const meName = me?.username;
  return (
    <div className="screen chat">
      <TopBar title={
        <div className="chat-title" onClick={() => nav.profile(user.username)}>
          <span className="avatar-presence"><Avatar src={user.avatarUrl} name={user.username} size={32} />{isActiveNow(activeAt) && <i className="presence-dot sm" />}</span>
          <div><b>{user.fullName || user.username}</b><span>{typing ? t('msgTyping') : (activeLabel(activeAt) || user.username)}</span></div>
        </div>
      } right={
        <div className="ck-call-btns">
          <button className="icon-btn" onClick={() => startCall(user, 'audio', { active: isActiveNow(activeAt) })} aria-label={t('ckVoiceCall')}><IHandset size={24} /></button>
          <button className="icon-btn" onClick={() => startCall(user, 'video', { active: isActiveNow(activeAt) })} aria-label={t('ckVideoCall')}><ICamcorder size={25} /></button>
        </div>
      } />
      {pinned && (
        <button className="pinned-bar" onClick={() => jump(pinned.id)}>
          <IPin size={18} />
          <div><b>{t('msgPinned')}</b><span className="ellipsis" dir="auto">{preview(pinned)}</span></div>
        </button>
      )}
      <div className="scroll chat-scroll" onClick={() => drawer && setDrawer(false)}>
        {msgs === null ? <Loading /> : (
          <>
            <div className="chat-intro">
              <Avatar src={user.avatarUrl} name={user.username} size={88} />
              <h3>{user.fullName || user.username}</h3>
              <span className="muted">{user.username} · {t('activeNow')}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => nav.profile(user.username)}>{t('viewProfile')}</button>
            </div>
            {shown.map((m, i) => {
              const showTime = i === 0 || new Date(m.createdAt) - new Date(shown[i - 1].createdAt) > 30 * 60000;
              const next = shown[i + 1];
              const showAvatar = !m.mine && (!next || next.mine || new Date(next.createdAt) - new Date(m.createdAt) > 30 * 60000);
              if (isCallLog(m.text)) {
                return (
                  <div key={m.id}>
                    {showTime && <div className="chat-time">{new Date(m.createdAt).toLocaleString(getLang(), { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</div>}
                    <CallLogBubble text={m.text} mine={m.mine} />
                  </div>
                );
              }
              return (
                <div key={m.id}>
                  {showTime && <div className="chat-time">{new Date(m.createdAt).toLocaleString(getLang(), { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</div>}
                  <MessageRow m={m} user={user} showAvatar={showAvatar} flash={flashId === m.id} nav={nav}
                    onMenu={(mm, el) => setMenu({ m: mm, rect: el.getBoundingClientRect() })}
                    onDoubleTap={(mm) => react(mm, '❤️')}
                    onSwipeReply={startReply}
                    onReactions={setReactSheet}
                    onJump={jump} onMedia={setViewer} />
                </div>
              );
            })}
            {(() => {
              const last = shown[shown.length - 1];
              if (!last || !last.mine || !last.read || typing) return null;
              return <div className="seen-label">{last.readAt ? t('msgSeenAgo', { t: timeAgo(last.readAt) }) : t('msgSeen')}</div>;
            })()}
            {typing && (
              <div className="bubble-row typing-row">
                <Avatar src={user.avatarUrl} name={user.username} size={28} />
                <div className="typing-bubble"><i /><i /><i /></div>
              </div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>
      {editing && (
        <div className="reply-bar">
          <div><b>{t('msgEditing')}</b><span className="ellipsis" dir="auto">{editing.text}</span></div>
          <button className="icon-btn" onClick={() => { setEditing(null); setText(''); }} aria-label="close"><IClose size={18} /></button>
        </div>
      )}
      {replyTo && !editing && (
        <div className="reply-bar">
          <div>
            <b>{replyTo.mine ? t('msgReplyingYourself') : t('msgReplyingTo', { u: user.username })}</b>
            <span className="ellipsis" dir="auto">{preview(replyTo)}</span>
          </div>
          <button className="icon-btn" onClick={() => setReplyTo(null)} aria-label="close"><IClose size={18} /></button>
        </div>
      )}
      <ChatComposer
        rootRef={composerRef}
        inputRef={inputRef}
        text={text} setText={setText} sending={sending}
        editing={editing}
        onCancelEdit={() => { setEditing(null); setText(''); }}
        onSend={(v) => send({ text: v })}
        onTyping={() => {
          if (!editing && Date.now() - typingSent.current > 3000) {
            typingSent.current = Date.now();
            api(`messages/${user.id}/typing`, { method: 'POST' }).catch(() => {});
          }
        }}
        onPickMedia={() => fileRef.current?.click()}
        onCamera={() => setCamMenu(true)}
        onOpenStickers={() => { setDrawerTab('stickers'); setDrawer(true); tapHaptic(); }}
        onToggleDrawer={() => { setDrawer((v) => !v); tapHaptic(); }}
        onOpenAi={() => setAiMenu(true)}
        recording={recording} recTime={recTime} recLevels={recLevels}
        onStartRec={startRec} onStopRec={stopRec}
        drawerOpen={drawer}
      />
      <ChatDrawer
        open={drawer}
        tab={drawerTab} setTab={setDrawerTab}
        onClose={() => setDrawer(false)}
        onOpenAi={() => setAiMenu(true)}
        onSendSticker={sendSticker}
        onSendGif={sendGif}
        onEffect={(id) => { setFxEffect(id); fxInputRef.current?.click(); }}
        onTool={(x) => setTool(x)}
        onDrag={handleDrag}
      />
      <input ref={fxInputRef} type="file" accept="image/*" hidden onChange={onFxFile} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={sendPhoto} />
      <AiMenu
        open={aiMenu} anchorRef={composerRef} onClose={() => setAiMenu(false)}
        onPick={(id) => {
          setDrawer(false);
          setTool(id === 'location' ? 'location' : id === 'aiimage' ? 'aiimage' : id === 'draw' ? 'draw' : 'ai');
        }}
      />
      <LocationSheet open={tool === 'location'} onClose={() => setTool(null)} onSend={sendKit} toast={toast} />
      <AiImageSheet open={tool === 'aiimage'} onClose={() => setTool(null)} onSend={sendKit} toast={toast} initialPrompt={aiSeed} />
      <DrawSheet open={tool === 'draw'} onClose={() => setTool(null)} onSend={sendKit} />
      <AiChatSheet
        open={tool === 'ai'} onClose={() => setTool(null)} toast={toast} messages={msgs || []}
        onSendText={(v) => send({ text: v })}
        onUsePrompt={(p) => { setAiSeed(p); setTool('aiimage'); }}
      />
      <CutoutSheet open={tool === 'cutouts'} onClose={() => setTool(null)} onSend={sendKit} toast={toast} />
      <MusicSheet open={tool === 'music'} onClose={() => setTool(null)} onSend={sendKit} onSendText={(v) => send({ text: v })} />
      <EffectSheet open={!!fxSrc} onClose={() => setFxSrc(null)} onSend={sendKit} src={fxSrc} effect={fxEffect} setEffect={setFxEffect} />
      <KitSettingsSheet open={tool === 'settings'} onClose={() => setTool(null)} />
      <ActionSheet
        open={camMenu} onClose={() => setCamMenu(false)}
        actions={[
          { icon: <ICamera size={22} />, label: t('ckTakePhoto'), onClick: () => camRef.current?.click() },
          { icon: <IImage size={22} />, label: t('ckFromGallery'), onClick: () => fileRef.current?.click() },
          { icon: <IScissors size={22} />, label: t('ckCutouts'), onClick: () => setTool('cutouts') },
    ]}
      />
      <DragLayer drag={drag} />
      {viewer && <MediaViewer v={viewer} onClose={() => setViewer(null)} />}
      {menu && <MessageMenu m={menu.m} rect={menu.rect} onClose={() => setMenu(null)} onReact={react} onAction={action} />}
      <Sheet open={!!reactSheet} onClose={() => setReactSheet(null)} title={t('msgReactions')}>
        <div className="user-list">
          {(reactSheet?.reactions || []).map((r) => (
            <div className="user-row" key={r.mine ? 'me' : 'them'} onClick={() => { if (r.mine) { const m = reactSheet; setReactSheet(null); react(m, r.emoji); } }}>
              <Avatar src={r.mine ? me?.avatarUrl : user.avatarUrl} name={r.mine ? meName : user.username} size={44} />
              <div className="user-row-text">
                <span className="conv-name">{r.mine ? meName : (user.fullName || user.username)}</span>
                {r.mine && <span className="muted">{t('msgTapToRemove')}</span>}
              </div>
              <span className="react-emoji">{r.emoji}</span>
            </div>
          ))}
        </div>
      </Sheet>
      <UserPicker open={!!forward} onClose={() => setForward(null)} title={t('msgForwardTo')} onPick={doForward} />
      <Confirm open={!!confirm} danger
        title={confirm?.kind === 'unsend' ? t('msgUnsendQ') : t('msgDeleteQ')}
        text={confirm?.kind === 'unsend' ? t('msgUnsendDesc') : t('msgDeleteDesc')}
        okLabel={confirm?.kind === 'unsend' ? t('msgUnsend') : t('delete')}
        onOk={doConfirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
