/**
 * واجهة المكالمات: شاشة كاملة (خلفية ضبابية + أفاتار + الحالة + شريط الصوت
 * الجانبي + شريط الأزرار السفلي) وفق تصميم إنستغرام، إضافة إلى فقاعات سجل
 * المكالمة داخل المحادثة.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp, Avatar } from '../components.jsx';
import {
  getCall, subscribeCall, startCallLoop, clearError, acceptCall, declineCall, endCall,
  setMuted, toggleCam, setSpeaker, switchCamera, getStreams, parseCallLog,
} from './call.js';
import { ct, fmtClock } from './callText.js';

/* ---------------- أيقونات ---------------- */
const Svg = ({ size = 26, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...rest}>{children}</svg>
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
      <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
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
  if (stream) { try { el.play?.(); } catch { /* ignore */ } }
}

function CallOverlay({ s }) {
  const { toast } = useApp();
  const [menu, setMenu] = useState(false);
  const { local, remote } = getStreams();
  useTick(s.phase === 'connected');
  const errShown = useRef('');
  useEffect(() => {
    if (!s.error || errShown.current === s.error) return;
    errShown.current = s.error;
    toast(ct('ckCallMediaErr'));
    clearError();
  }, [s.error]); // eslint-disable-line

  const video = s.kind === 'video';
  const remoteTrack = remote ? remote.getVideoTracks()[0] : null;
  const remoteLive = !!(remoteTrack && remoteTrack.readyState === 'live' && !remoteTrack.muted);
  const localCam = local ? local.getVideoTracks().find((t) => t.readyState === 'live') : null;
  const showRemote = video && remoteLive && s.peerCam !== false;   // فيديو الطرف الآخر (يتوقف فوراً إذا أطفأ كاميرته)
  const showSelf = video && !showRemote && !!localCam;        // كاميرتي أثناء الانتظار
  const showPip = video && showRemote && !!localCam;          // صورتي الصغيرة مع الفيديو
  const name = s.peer?.fullName || s.peer?.username || ct('ckCallSomeone');

  return (
    <div className="ck-call" dir="ltr">
      {s.peer?.avatarUrl
        ? <div className="ck-call-bg" style={{ backgroundImage: `url(${s.peer.avatarUrl})` }} />
        : <div className="ck-call-bg plain" />}
      <div className="ck-call-shade" />

      {showRemote && (
        <video className="ck-call-remotevid" muted playsInline autoPlay
          ref={(el) => bindStream(el, remote)} onLoadedMetadata={(e) => e.currentTarget.play?.().catch(() => {})} />
      )}
      {showSelf && (
        <video className="ck-call-selfvid" muted playsInline autoPlay
          style={{ transform: s.facing === 'user' ? 'scaleX(-1)' : 'none' }}
          ref={(el) => bindStream(el, local)} onLoadedMetadata={(e) => e.currentTarget.play?.().catch(() => {})} />
      )}
      {showPip && (
        <video className="ck-call-localvid" muted playsInline autoPlay
          style={{ transform: s.facing === 'user' ? 'scaleX(-1)' : 'none' }}
          ref={(el) => bindStream(el, local)} />
      )}

      <button className="ck-call-more" onClick={() => setMenu((v) => !v)} aria-label={ct('ckCallMore')}><IDots size={26} /></button>

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

      {menu && (
        <div className="ck-call-menu">
          <button onClick={() => { setSpeaker(!s.speaker); setMenu(false); }}>
            {s.speaker ? <ISpkOn size={20} /> : <IDeviceWaves size={20} />}<span>{ct('ckCallSpeaker')}</span>
          </button>
          {video && (
            <button onClick={() => { switchCamera(); setMenu(false); }}>
              <ICamOn size={20} /><span>{ct('ckCallSwitchCam')}</span>
            </button>
          )}
          <button onClick={() => { endCall('hangup'); setMenu(false); }}>
            <IEndCall size={20} /><span>{ct('ckCallEnd')}</span>
          </button>
        </div>
      )}

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

      <audio id="nx-call-audio" autoPlay playsInline ref={(el) => bindStream(el, remote)} />
    </div>
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
