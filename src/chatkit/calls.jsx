/**
 * واجهة المكالمات: شاشة كاملة (خلفية ضبابية + أفاتار + الحالة + شريط الصوت
 * الجانبي + شريط الأزرار السفلي) وفق تصميم إنستغرام، إضافة إلى فقاعات سجل
 * المكالمة داخل المحادثة.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp, Avatar, Spinner } from '../components.jsx';
import { api } from '../api.js';
import { KitSheet } from './ChatKit.jsx';
import { ISearch } from '../icons.jsx';
import {
  getCall, subscribeCall, startCallLoop, clearError, acceptCall, declineCall, endCall,
  setMuted, toggleCam, setSpeaker, switchCamera, getStreams, parseCallLog,
  inviteToCall, setAudioTouchUp, clearNotice, setMyId,
} from './call.js';
import { ct, fmtClock } from './callText.js';

/* ---------------- أيقونات ---------------- */
const Svg = ({ size = 26, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...rest}>{children}</svg>
);
export const ICamOff = (p) => (
  <Svg {...p}>
    <rect x="2.6" y="6.6" width="12.4" height="10.8" rx="2.6" />
    <path d="M15.2 10.7 20.4 7.5v9l-5.2-3.2" />
    <path d="M3.4 3.4 20.6 20.6" />
  </Svg>
);
export const ICamOn = (p) => (
  <Svg {...p}>
    <rect x="2.6" y="6.6" width="12.4" height="10.8" rx="2.6" />
    <path d="M15.2 10.7 20.4 7.5v9l-5.2-3.2" />
  </Svg>
);
export const IMicOn = (p) => (
  <Svg {...p}>
    <rect x="9" y="2.6" width="6" height="11" rx="3" />
    <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" />
    <path d="M12 17.8v3.6" />
  </Svg>
);
export const IMicOff = (p) => (
  <Svg {...p}>
    <rect x="9" y="2.6" width="6" height="11" rx="3" />
    <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" />
    <path d="M12 17.8v3.6" />
    <path d="M3.4 3.4 20.6 20.6" />
  </Svg>
);
export const ISpkOff = (p) => (
  <Svg {...p}>
    <path d="M4 9.4h3.3L12 5.5v13l-4.7-3.9H4z" />
    <path d="M15.5 9.4a3.7 3.7 0 0 1 0 5.2" />
    <path d="M18.2 6.7a7.3 7.3 0 0 1 0 10.6" />
    <path d="M3.2 3.4 20.8 20.6" />
  </Svg>
);
export const ISpkOn = (p) => (
  <Svg {...p}>
    <path d="M4 9.4h3.3L12 5.5v13l-4.7-3.9H4z" />
    <path d="M15.5 9.4a3.7 3.7 0 0 1 0 5.2" />
    <path d="M18.2 6.7a7.3 7.3 0 0 1 0 10.6" />
  </Svg>
);
/** دعوة أشخاص: شخص + */
export const IInvitePeer = ({ size = 25 }) => (
  <Svg size={size}>
    <circle cx="9.6" cy="8.4" r="3.6" />
    <path d="M3.2 19.6c0-3.2 2.9-5.4 6.4-5.4 1.5 0 2.9.4 4 1.1" />
    <path d="M17.4 14.2v6.2M14.3 17.3h6.2" />
  </Svg>
);
/** بريق (تحسين الصوت) */
export const ISparkle = ({ size = 22 }) => (
  <Svg size={size} strokeWidth="1.7">
    <path d="M12 3.4c.5 3.3 1.4 4.2 4.7 4.7-3.3.5-4.2 1.4-4.7 4.7-.5-3.3-1.4-4.2-4.7-4.7 3.3-.5 4.2-1.4 4.7-4.7Z" />
    <path d="M18.4 14.6c.25 1.6.7 2.05 2.3 2.3-1.6.25-2.05.7-2.3 2.3-.25-1.6-.7-2.05-2.3-2.3 1.6-.25 2.05-.7 2.3-2.3Z" />
    <path d="M8.2 15.6c.18 1.15.5 1.47 1.65 1.65-1.15.18-1.47.5-1.65 1.65-.18-1.15-.5-1.47-1.65-1.65 1.15-.18 1.47-.5 1.65-1.65Z" />
  </Svg>
);
export const IDeviceWaves = (p) => (
  <Svg {...p}>
    <rect x="8.6" y="4.2" width="6.8" height="15.6" rx="2.3" />
    <path d="M6 9.6v4.8" /><path d="M3.4 10.8v2.4" />
    <path d="M18 9.6v4.8" /><path d="M20.6 10.8v2.4" />
  </Svg>
);
export const IDots = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5.5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="18.5" cy="12" r="1.9" />
  </svg>
);
export const IEndCall = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 9c-1.6 0-3.2.3-4.6.7v3.1c0 .4-.2.8-.6.9-1 .5-1.9 1.1-2.7 1.9-.2.2-.4.3-.7.3-.3 0-.5-.1-.7-.3L.3 13.1c-.2-.2-.3-.4-.3-.7s.1-.5.3-.7C3.3 8.8 7.5 7 12 7s8.7 1.8 11.7 4.7c.2.2.3.4.3.7s-.1.5-.3.7l-2.5 2.5c-.2.2-.4.3-.7.3-.3 0-.5-.1-.7-.3-.8-.7-1.7-1.4-2.7-1.9-.3-.2-.6-.5-.6-.9V9.7C15.2 9.3 13.6 9 12 9z" />
  </svg>
);
export const IPhoneFill = ({ size = 26, arrow = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.9 10.6c1.3 2.6 3.5 4.7 6.1 6.1l2-2c.3-.3.6-.4 1-.2 1 .3 2.1.5 3.3.5.5 0 .9.4.9.9v3.3c0 .5-.4.9-.9.9-8.7 0-15.8-7.1-15.8-15.8 0-.5.4-.9.9-.9h3.3c.5 0 .9.4.9.9 0 1.2.2 2.3.5 3.3.1.4 0 .8-.2 1z" />
    {arrow && (
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M15.4 8.6h4.4v4.4" /><path d="M19.8 8.6l-6.2 6.2" />
      </g>
    )}
  </svg>
);
export const IPhoneOutline = ({ size = 30 }) => (
  <Svg size={size} strokeWidth="1.7">
    <path d="M5.4 3.7h3c.5 0 .9.3 1 .8.1 1 .3 2 .7 3 .1.3.1.6-.2.9L8.4 9.9a13.7 13.7 0 0 0 5.7 5.7l1.5-1.5c.2-.2.6-.3.9-.2 1 .3 2 .6 3 .7.5.1.8.5.8 1v3c0 .6-.4 1-1 1h-.6C9.7 19.6 4.4 14.3 4.4 4.7v-.6c0-.2.3-.4 1-.4z" />
  </Svg>
);
export const ICheck = ({ size = 26 }) => (
  <Svg size={size} strokeWidth="2.2"><path d="M4.5 12.5 9.5 17.5 19.5 6.5" /></Svg>
);
export const IEndCallBig = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(135deg)' }}>
    <path d="M6.9 10.6c1.3 2.6 3.5 4.7 6.1 6.1l2-2c.3-.3.6-.4 1-.2 1 .3 2.1.5 3.3.5.5 0 .9.4.9.9v3.3c0 .5-.4.9-.9.9-8.7 0-15.8-7.1-15.8-15.8 0-.5.4-.9.9-.9h3.3c.5 0 .9.4.9.9 0 1.2.2 2.3.5 3.3.1.4 0 .8-.2 1z" />
  </svg>
);

/* ---------------- أدوات ---------------- */
export function useCallState() {
  const [s, setS] = useState(getCall());
  useEffect(() => subscribeCall(setS), []);
  return s;
}
function useTick(active, ms = 1000) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const iv = setInterval(() => force((v) => v + 1), ms);
    return () => clearInterval(iv);
  }, [active, ms]);
}
const durText = (startedAt) => {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
function statusText(s) {
  if (s.phase === 'connected') return durText(s.startedAt);
  if (s.phase === 'ended') {
    switch (s.reason) {
      case 'declined': return ct('ckCallDeclined');
      case 'noanswer': return ct('ckCallNoAnswer');
      case 'busy': return ct('ckCallBusy');
      case 'failed': case 'media': case 'perm': return ct('ckCallFailed');
      case 'lost': return ct('ckCallLost');
      default: return ct('ckCallEnded');
    }
  }
  if (s.phase === 'incoming') return s.kind === 'video' ? ct('ckCallInVideo') : ct('ckCallInAudio');
  if (s.phase === 'connecting') return ct('ckCallConnecting');
  if (s.status === 'reconnecting') return ct('ckCallReconnecting');
  return s.status === 'ringing' ? ct('ckCallRinging') : ct('ckCallContacting');
}

/* ---------------- شاشة المكالمة ---------------- */
/** يربط عنصر فيديو/صوت بالمسار المطلوب فور تركيبه (وبلا تكرار). */
function bindStream(el, stream) {
  if (!el) return;
  if (el.srcObject !== stream) el.srcObject = stream || null;
  if (stream) {
    try { const pr = el.play?.(); if (pr && pr.catch) pr.catch(() => {}); } catch { /* ignore */ }
  }
}

function CallOverlay({ s }) {
  const { toast, me } = useApp();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [hideUi, setHideUi] = useState(false);
  const [vidSize, setVidSize] = useState(null);   // أبعاد فيديو الطرف الآخر (لمكان صورة كاميرتي)
  const { local, remote } = getStreams();
  useTick(s.phase === 'connected');
  const errShown = useRef('');
  const noticeShown = useRef(null);
  useEffect(() => { setMyId(me?.id); }, [me?.id]);
  useEffect(() => {
    if (!s.notice) return;
    const key = s.notice.k + (s.notice.name || '');
    if (noticeShown.current === key) return;
    noticeShown.current = key;
    const txt = s.notice.k === 'invited' ? ct('ckCallInviteSent', { n: s.notice.name || '' })
      : s.notice.k === 'declinedPeer' ? ct('ckCallInviteDeclined', { n: s.notice.name || '' })
        : s.notice.k === 'peerLeft' ? ct('ckCallPeerLeft', { n: s.notice.name || '' })
          : s.notice.k === 'full' ? ct('ckCallFull') : '';
    if (txt) toast(txt);
    clearNotice();
  }, [s.notice]); // eslint-disable-line
  useEffect(() => {
    if (!s.error || errShown.current === s.error) return;
    errShown.current = s.error;
    toast(ct('ckCallMediaErr'));
    clearError();
  }, [s.error]); // eslint-disable-line

  const video = s.kind === 'video';
  const peers = useMemo(() => (s.peers || []).filter((p) => Number(p.id) !== Number(me?.id)), [s.peers, me?.id]);
  const many = peers.length > 1;
  // مع عدة مشاركين: نعرض المتحدث النشط (من إحصاءات WebRTC)، وإلا الأساسي
  const mainPeer = useMemo(() => {
    if (!many) return null;
    const byVoice = peers.find((p) => Number(p.id) === Number(s.speakerId));
    return byVoice || peers.find((p) => p.connected && p.stream && p.stream.getVideoTracks().length) || peers[0] || null;
  }, [many, peers, s.speakerId]);
  const mainId = many && mainPeer ? mainPeer.id : s.peer?.id;
  const remoteStream = many && mainPeer ? mainPeer.stream : remote;
  const remoteTrack = remoteStream ? remoteStream.getVideoTracks()[0] : null;
  const remoteLive = !!(remoteTrack && remoteTrack.readyState === 'live' && !remoteTrack.muted);
  const localCam = local ? local.getVideoTracks().find((t) => t.readyState === 'live') : null;
  const showRemote = video && remoteLive;
  const showSelf = video && !showRemote && !!localCam;        // كاميرتي أثناء الانتظار
  const showPip = video && showRemote && !!localCam;          // صورتي الصغيرة مع الفيديو
  // مكان صورة كاميرتي: أعلى يمين إطار الفيديو المعروض (مثل إنستغرام)، لا يخرج عن الشاشة أبداً
  const pipPos = useMemo(() => {
    const W = typeof window === 'undefined' ? 390 : window.innerWidth;
    const H = typeof window === 'undefined' ? 844 : window.innerHeight;
    const PW = 92, PH = 128;
    let left = W - PW - 12, top = 62;
    if (vidSize && vidSize.w && vidSize.h) {
      const sc = Math.min(W / vidSize.w, H / vidSize.h);
      const vw = vidSize.w * sc, vh = vidSize.h * sc;
      left = (W - vw) / 2 + vw - PW - 10;
      top = (H - vh) / 2 + 10;
    }
    return { left: Math.max(10, Math.min(left, W - PW - 10)), top: Math.max(58, Math.min(top, H - PH - 150)) };
  }, [vidSize]);
  const mainUser = many && mainPeer ? mainPeer.user : s.peer;
  const name = mainUser?.fullName || mainUser?.username || ct('ckCallSomeone');

  return (
    <div className={`ck-call ${showRemote ? 'vidmode' : ''} ${hideUi ? 'ui-hidden' : ''}`} dir="ltr"
      onClick={(e) => { if (e.target.closest('button') || e.target.closest('.ck-sheet') || e.target.closest('.ck-sheet-wrap')) return; setHideUi((v) => !v); }}>
      {s.peer?.avatarUrl
        ? <div className="ck-call-bg" style={{ backgroundImage: `url(${s.peer.avatarUrl})` }} />
        : <div className="ck-call-bg plain" />}
      <div className="ck-call-shade" />

      {showRemote && (
        <video className="ck-call-remotevid" muted playsInline
          ref={(el) => bindStream(el, remoteStream)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth) setVidSize({ w: v.videoWidth, h: v.videoHeight });
            v.play?.()?.catch?.(() => {});
          }} />
      )}
      {showSelf && (
        <video className="ck-call-selfvid" muted playsInline
          style={{ transform: s.facing === 'user' ? 'scaleX(-1)' : 'none' }}
          ref={(el) => bindStream(el, local)} onLoadedMetadata={(e) => e.currentTarget.play?.().catch(() => {})} />
      )}
      {showPip && (
        <video className="ck-call-localvid" muted playsInline
          style={{ left: pipPos.left, top: pipPos.top, transform: s.facing === 'user' ? 'scaleX(-1)' : 'none' }}
          ref={(el) => bindStream(el, local)}
          onClick={(e) => e.stopPropagation()} />
      )}

      {many && (
        <div className="ck-call-tiles">
          {peers.map((p) => (
            <span key={p.id} className={`ck-call-tile ${p.connected ? 'on' : ''} ${Number(p.id) === Number(s.speakerId) ? 'speaking' : ''}`}>
              <Avatar src={p.user?.avatarUrl} name={p.user?.username || '?'} size={26} />
              <b>{(p.user?.fullName || p.user?.username || '').slice(0, 10)}</b>
            </span>
          ))}
        </div>
      )}
      <div className="ck-call-top">
        <button className="ck-call-icon" onClick={() => setInviteOpen(true)} aria-label={ct('ckCallInvite')}><IInvitePeer size={25} /></button>
        <button className="ck-call-icon" onClick={() => setSetOpen(true)} aria-label={ct('ckCallMore')}><IDots size={24} /></button>
      </div>

      {!(showRemote || showSelf) && (
        <div className="ck-call-id">
          <Avatar src={s.peer?.avatarUrl} name={s.peer?.username || ''} size={104} className="ck-call-avatar" />
          <b>{name}</b>
          <span>{statusText(s)}</span>
        </div>
      )}
      {(showRemote || showSelf) && (
        <div className="ck-call-id mini">
          <b>{name}</b>
          <span>{statusText(s)}</span>
        </div>
      )}

      <CallSettingsSheet open={setOpen} onClose={() => setSetOpen(false)} s={s} />
      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} s={s} toast={toast} />

      {s.incoming ? (
        <div className="ck-call-bar incoming">
          <button className="ck-call-act end" onClick={declineCall} aria-label={ct('ckCallDecline')}><IEndCallBig size={30} /></button>
          <button className="ck-call-act accept" onClick={acceptCall} aria-label={ct('ckCallAccept')}>{video ? <ICamOn size={30} /> : <ICheck size={30} />}</button>
        </div>
      ) : (
        <div className="ck-call-bar">
          <button className={`ck-call-btn ${video && s.camOn ? 'on' : ''}`} onClick={() => toggleCam()}
            aria-label={ct('ckCallCamera')} aria-pressed={!!(video && s.camOn)}>
            {video && s.camOn ? <ICamOn size={27} /> : <ICamOff size={27} />}
          </button>
          <button className={`ck-call-btn ${s.muted ? 'off' : ''}`} onClick={() => setMuted()} aria-label={ct('ckCallMute')} aria-pressed={s.muted}>
            {s.muted ? <IMicOff size={27} /> : <IMicOn size={27} />}
          </button>
          <button className={`ck-call-btn ${s.speaker ? 'on' : ''}`} onClick={() => setSpeaker()} aria-label={ct('ckCallSpeaker')} aria-pressed={s.speaker}>
            {s.speaker ? <ISpkOn size={27} /> : <ISpkOff size={27} />}
          </button>
          <button className="ck-call-btn end" onClick={() => endCall('hangup')} aria-label={ct('ckCallEnd')}><IEndCall size={27} /></button>
        </div>
      )}

      <audio className="ck-call-audio" playsInline ref={(el) => bindStream(el, remote)} />
      {peers.map((p) => <PeerAudio key={p.id} stream={p.stream} />)}
    </div>
  );
}

function PeerAudio({ stream }) {
  const ref = useRef(null);
  useEffect(() => { bindStream(ref.current, stream); }, [stream]);
  return <audio className="ck-call-audio" playsInline ref={ref} />;
}

/** ورقة "الإعدادات" داخل المكالمة (تحسين الصوت) */
function CallSettingsSheet({ open, onClose, s }) {
  return (
    <KitSheet open={open} onClose={onClose} title={ct('ckCallSettings')} above noClose center>
      <div className="ck-set-wrap">
      <div className="ck-setrow">
        <span className="ck-setrow-ic"><ISparkle size={24} /></span>
        <span className="ck-setrow-txt">{ct('ckCallTouchUp')}</span>
        <button className={`ck-switch ${s.touchUp ? 'on' : ''}`} role="switch" aria-checked={!!s.touchUp}
          aria-label={ct('ckCallTouchUp')} onClick={() => setAudioTouchUp()}>
          <i />
        </button>
      </div>
      </div>
    </KitSheet>
  );
}

/** ورقة "دعوة أشخاص": قائمة حقيقية من محادثاتك ومقترحاتك ونتائج البحث */
function InviteSheet({ open, onClose, s, toast }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    setQ(''); setUsers(null);
    Promise.all([
      api('conversations').catch(() => ({ conversations: [] })),
      api('suggestions').catch(() => ({ users: [] })),
    ]).then(([c, sg]) => {
      const seen = new Set(); const out = [];
      for (const u of [...(c.conversations || []).map((x) => x.user), ...(sg.users || [])]) {
        if (u?.id && !seen.has(u.id)) { seen.add(u.id); out.push(u); }
      }
      setUsers(out);
    });
    return undefined;
  }, [open]);
  useEffect(() => {
    if (!open || !q.trim()) return undefined;
    const tm = setTimeout(() => api(`search/users?q=${encodeURIComponent(q)}`).then((r) => setUsers(r.users || [])).catch(() => {}), 250);
    return () => clearTimeout(tm);
  }, [q, open]);
  const inCall = new Set([s.peer?.id, ...(s.peers || []).map((p) => p.id)].filter(Boolean).map(Number));
  const list = (users || []).filter((u) => !inCall.has(Number(u.id)));
  const call = async (u) => {
    const ok = await inviteToCall(u);
    if (ok) { toast(ct('ckCallInviteSent', { n: u.fullName || u.username })); onClose(); }
  };
  return (
    <KitSheet open={open} onClose={onClose} title={ct('ckCallInvite')} above noClose center>
      <div className="ck-invite-search">
        <ISearch size={19} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ct('ckCallSearch')} dir="auto" />
      </div>
      <div className="ck-invite-list">
        {users === null ? <div className="ck-invite-load"><Spinner /></div> : list.length === 0 ? (
          <div className="ck-note">{ct('ckCallNoUsers')}</div>
        ) : list.map((u) => (
          <div className="ck-invite-row" key={u.id}>
            <Avatar src={u.avatarUrl} name={u.username} size={54} />
            <div className="ck-invite-txt">
              <b className="ellipsis">{u.fullName || u.username}</b>
              <span className="ellipsis">{u.username}</span>
            </div>
            <button className="ck-invite-btn" onClick={() => call(u)}>{ct('ckCallPill')}</button>
          </div>
        ))}
      </div>
    </KitSheet>
  );
}

/** يركَّب مرة واحدة في التطبيق: يشغّل حلقة الاستقبال ويُظهر شاشة المكالمة. */
export function CallCenter() {
  const s = useCallState();
  useEffect(() => startCallLoop(), []);
  return s.phase === 'idle' ? null : createPortal(<CallOverlay s={s} />, document.body);
}

/* ---------------- فقاعة سجل المكالمة ---------------- */
export function CallLogBubble({ text, mine }) {
  const d = parseCallLog(text) || {};
  const video = d.k === 'video';
  const titleMap = {
    started: video ? 'ckLogVideoStart' : 'ckLogAudioStart',
    ended: video ? 'ckLogVideoEnd' : 'ckLogAudioEnd',
    missed: video ? 'ckLogMissedVideo' : 'ckLogMissedAudio',
  };
  const arrow = d.d === 'ended' || d.d === 'missed';
  return (
    <div className={`ck-calllog-row ${mine ? 'mine' : ''}`}>
      <div className={`ck-calllog ${d.d === 'missed' ? 'missed' : ''}`}>
        <span className="ck-calllog-ico"><IPhoneFill size={26} arrow={arrow} /></span>
        <span className="ck-calllog-txt">
          <b>{ct(titleMap[d.d] || 'ckLogAudioStart')}</b>
          <i>{fmtClock(d.at)}</i>
        </span>
      </div>
    </div>
  );
}
