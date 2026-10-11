/**
 * محرّك المكالمات — مكالمات صوتية ومرئية حقيقية (WebRTC) داخل التطبيق.
 * لا روابط خارجية ولا خادم إضافي: تبادل الإشارات (offer/answer/ICE) يمرّ
 * داخل المحادثة نفسها برسائل مرمّزة تُحذف تلقائياً بعد ثوانٍ، فلا تظهر في
 * الشات ولا تُنتج إشعارات ولا علامات "غير مقروء".
 *
 * - المتصل: يرسل عرضاً (offer) + تحديثات تراكمية كل ٤ ثوانٍ → الجهاز الآخر
 *   يرنّ فوراً إن كان التطبيق مفتوحاً، ويردّ بـ "ring" فيظهر "يُرن..." عند المتصل.
 * - المستقبل: يقبل → يرسل الجواب (answer) → الصوت/الفيديو يمرّ مباشرة بين الجهازين.
 * - السجل: رسالة مرئية واحدة لكل حدث (بدأت/انتهت/فائتة) يراها الطرفان كفقاعة مكالمة.
 */
import { api, getToken } from '../api.js';

export const MARK = '\u27e6NXCALL\u27e7';   // إشارات (مخفية عن الواجهة)
export const LOGMARK = '\u27e6NXLOG\u27e7'; // سجل المكالمة (فقاعة مرئية)
export const isCallSignal = (s) => typeof s === 'string' && s.startsWith(MARK);
export const isCallLog = (s) => typeof s === 'string' && s.startsWith(LOGMARK);
export function parseCallLog(s) {
  try { return JSON.parse(atob(s.slice(LOGMARK.length))); } catch { return null; }
}
export const makeCallLog = (k, d, at) => LOGMARK + btoa(JSON.stringify({ k, d, at: at || Date.now() }));

/* ---------------- أدوات ---------------- */
const DBG = [];
function dbg(...a) { try { DBG.push(a.map((x) => (typeof x === 'object' ? JSON.stringify(x).slice(0, 160) : String(x))).join(' ')); if (DBG.length > 300) DBG.shift(); } catch { /* ignore */ } }

const enc = (s) => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i++) o += String.fromCharCode(b[i]); return btoa(o); };
const dec = (t) => { const bin = atob(t); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); };
async function gzip(str) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('gzip');
    const w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(str)); w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  } catch { return null; }
}
async function gunzip(bytes) {
  try {
    const ds = new DecompressionStream('gzip');
    const w = ds.writable.getWriter(); w.write(bytes); w.close();
    return await new Response(ds.readable).text();
  } catch { return ''; }
}
/** تقليص SDP: نُبقي فقط السطور الضرورية ونحذف التوسعات/التعليقات الطويلة،
 *  ونقلّص الفيديو إلى VP8 (+rtx) حتى تبقى الإشارة في رسالة واحدة صغيرة. */
function slimSdp(sdp) {
  if (!sdp) return sdp;
  const KEEP = /^(v=|o=|s=|t=|a=group:|a=ice-ufrag:|a=ice-pwd:|a=fingerprint:|a=setup:|a=mid:|a=rtcp-mux|a=rtcp:|a=rtpmap:|a=fmtp:|a=sendrecv|a=recvonly|a=sendonly|a=inactive|a=maxptime:|a=ptime:|a=candidate:|a=end-of-candidates|m=)/;
  const lines = sdp.split(/\r?\n/).filter((l) => l && KEEP.test(l.trim()));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    out.push(line);
    if (!line.startsWith('m=video')) continue;
    // اجمع أنواع الحمولة المفيدة (VP8 + rtx المرتبط بها)
    const pts = line.split(' ').slice(3);
    const rtpmap = {}, fmtp = {};
    for (const l of lines) {
      const m1 = /^a=rtpmap:(\d+)\s+([^/]+)/.exec(l.trim());
      if (m1) rtpmap[m1[1]] = m1[2].toLowerCase();
      const m2 = /^a=fmtp:(\d+)\s+(.*)$/.exec(l.trim());
      if (m2) fmtp[m2[1]] = m2[2];
    }
    const keep = new Set(pts.filter((pt) => rtpmap[pt] === 'vp8' || rtpmap[pt] === 'rtx' && /apt=(\d+)/.test(fmtp[pt] || '') && rtpmap[/(\d+)/.exec(fmtp[pt])[1]] === 'vp8'));
    if (!keep.size) continue;
    out[out.length - 1] = `m=video ${line.split(' ').slice(1, 3).join(' ')} ${pts.filter((pt) => keep.has(pt)).join(' ')}`;
    for (let j = i + 1; j < lines.length && !lines[j].trim().startsWith('m='); j++) {
      const l = lines[j].trim();
      const mp = /^a=(rtpmap|fmtp):(\d+)/.exec(l);
      if (mp && !keep.has(mp[2])) { lines[j] = ''; }
    }
  }
  return out.filter(Boolean).join('\r\n') + '\r\n';
}

async function pack(str) {
  if (!str) return '';
  str = slimSdp(str);
  const g = await gzip(str);
  if (g) { let o = ''; for (let i = 0; i < g.length; i++) o += String.fromCharCode(g[i]); return 'z' + btoa(o); }
  return 'p' + enc(str);
}
async function unpack(tag) {
  if (!tag) return '';
  if (tag[0] === 'z') { const bin = atob(tag.slice(1)); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return gunzip(u); }
  return dec(tag.slice(1));
}

/* ---------------- الحالة ---------------- */
const IDLE = {
  phase: 'idle',      // idle | outgoing | incoming | connecting | connected | ended
  kind: 'audio',      // audio | video
  peer: null, incoming: false, outgoing: false, status: 'contacting',
  muted: false, camOn: false, peerCam: true, speaker: false, volume: 0.92,
  startedAt: 0, reason: '', error: '', facing: 'user', ringStamp: 0, duration: 0,
  groupId: '', peers: [], speakerId: 0, touchUp: true, notice: null, joining: 0,
};
let S = { ...IDLE };
const subs = new Set();
export const getCall = () => S;
export function subscribeCall(fn) { subs.add(fn); return () => { subs.delete(fn); }; }
function set(p) { S = { ...S, ...p }; subs.forEach((f) => { try { f(S); } catch { /* ignore */ } }); }

/* ---------------- داخلية ---------------- */
let pc = null, localStream = null, remoteStream = null;
let callId = null, peerId = null, signalPeer = null;
let pendingGroup = '', pendingList = null;
let meId = 0;
export function setMyId(id) { meId = Number(id) || 0; }
let groupId = '';                       // معرّف المكالمة الجماعية (نفسه عند كل المشاركين)
const extras = new Map();               // peerId -> { id, user, pc, remote, i, connected, pending }
const known = new Map();                // peerId -> { id, user } (مشاركون أُعلن عنهم ولم يُربطوا بعد)
let statsTimer = null;
let touchUpTrack = null, touchUpGraph = null;
let pendingOffer = null, queuedCand = [], addedCand = new Set(), seen = new Set();
let refreshTimer = null, timeoutTimer = null, ringTimeout = null, refreshes = 0;
let ringSent = false, busySent = false, connectedLogged = false, endLogged = false;
let lastScan = 0, loopStarted = false;
let audioCtx = null, ringTimer = null, wakeLock = null;

export const getStreams = () => ({ local: localStream, remote: remoteStream });

export const rtcConfig = () => {
  const extra = (() => { try { return JSON.parse(localStorage.getItem('nx_turn') || 'null'); } catch { return null; } })();
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (Array.isArray(extra) && extra.length) iceServers.push(...extra);
  return { iceServers, iceCandidatePoolSize: 4, bundlePolicy: 'max-bundle' };
};

/* ---------------- أصوات الرنين ---------------- */
function ctxAudio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; } }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
if (typeof document !== 'undefined') {
  const arm = () => { ctxAudio(); document.removeEventListener('pointerdown', arm); };
  document.addEventListener('pointerdown', arm, { once: true });
}
function beep(freq, dur, gain) {
  const c = ctxAudio(); if (!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = 0;
    o.connect(g); g.connect(c.destination);
    const t0 = c.currentTime;
    g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.06);
  } catch { /* ignore */ }
}
function stopTone() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } try { navigator.vibrate?.(0); } catch { /* ignore */ } }
function outgoingTone() {
  stopTone();
  beep(430, 0.5, 0.05);
  ringTimer = setInterval(() => beep(430, 0.5, 0.05), 3000);
}
function incomingTone() {
  stopTone();
  const cycle = () => { beep(660, 0.3, 0.13); setTimeout(() => beep(880, 0.3, 0.13), 360); };
  cycle(); ringTimer = setInterval(cycle, 1800);
  try { navigator.vibrate?.([400, 220, 400]); } catch { /* ignore */ }
}
async function grabWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request?.('screen'); } catch { wakeLock = null; }
}

/* ---------------- إرسال الإشارات ---------------- */
function scheduleDelete(id) {
  if (!id) return;
  setTimeout(() => { api(`message/${id}`, { method: 'DELETE' }).catch(() => {}); }, 7000);
}
async function send(to, t, extra = {}) {
  const body = { i: callId, t, k: S.kind, g: groupId || undefined, ...extra };
  const text = MARK + enc(JSON.stringify(body));
  if (text.length <= 1900) {
    dbg('tx', t, text.length);
    const r = await api(`messages/${to}`, { method: 'POST', body: { text } });
    scheduleDelete(r?.message?.id);
    return;
  }
  const parts = [];
  for (let i = 0; i < text.length; i += 1700) parts.push(text.slice(i, i + 1700));
  for (let i = 0; i < parts.length; i++) {
    const env = MARK + enc(JSON.stringify({ i: callId, t: 'part', k: S.kind, n: parts.length, p: i, x: parts[i] }));
    const r = await api(`messages/${to}`, { method: 'POST', body: { text: env } });
    scheduleDelete(r?.message?.id);
  }
}
async function readParts(peer, env) {
  const r = await api(`messages/${peer}?after=0`);
  const list = (r.messages || []).filter((m) => !m.mine && isCallSignal(m.text));
  const bucket = [];
  for (const m of list) {
    try {
      const e = JSON.parse(dec(m.text.slice(MARK.length)));
      if (e.t === 'part' && e.i === env.i && e.k === env.k && e.n === env.n) bucket[e.p] = e.x;
    } catch { /* ignore */ }
  }
  if (bucket.filter(Boolean).length !== env.n) return null;
  const full = bucket.join('');
  try { return JSON.parse(dec(full.slice(MARK.length))); } catch { return null; }
}

/* ---------------- الوسائط ---------------- */
async function getStream(kind, facing = 'user') {
  const constraints = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: kind === 'video'
      ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: facing }
      : false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}
function parseCandidates(sdp) {
  const out = [];
  let idx = -1; const mids = [];
  for (const raw of sdp.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('m=')) { mids.push(null); idx = mids.length - 1; }
    else if (line.startsWith('a=mid:') && idx >= 0) mids[idx] = line.slice(6);
    else if (line.startsWith('a=candidate:')) out.push({ candidate: line.slice(2), sdpMid: mids[idx], sdpMLineIndex: idx });
  }
  return out;
}
async function harvest(sdp) {
  if (!pc || !sdp) return;
  const cands = parseCandidates(sdp);
  if (!pc.remoteDescription) { queuedCand.push(...cands); return; }
  for (const c of cands) {
    if (!c.candidate || addedCand.has(c.candidate)) continue;
    addedCand.add(c.candidate);
    try { await pc.addIceCandidate(c); } catch { /* ignore */ }
  }
}
async function flushCandidates() {
  const list = queuedCand; queuedCand = [];
  for (const c of list) {
    if (!c.candidate || addedCand.has(c.candidate)) continue;
    addedCand.add(c.candidate);
    try { await pc.addIceCandidate(c); } catch { /* ignore */ }
  }
}
function newPeer() {
  if (pc) { try { pc.close(); } catch { /* ignore */ } }
  pc = new RTCPeerConnection(rtcConfig());
  remoteStream = new MediaStream();
  pc.ontrack = (e) => {
    const st = e.streams && e.streams[0];
    if (st) st.getTracks().forEach((tr) => { if (!remoteStream.getTracks().includes(tr)) remoteStream.addTrack(tr); });
    else if (!remoteStream.getTracks().includes(e.track)) remoteStream.addTrack(e.track);
    const tr = e.track;
    if (tr && tr.kind === 'video') {
      const bump = () => set({});
      try { tr.addEventListener('mute', bump); tr.addEventListener('unmute', bump); } catch { /* ignore */ }
    }
    set({});
  };
  pc.onconnectionstatechange = () => {
    const st = pc && pc.connectionState;
    dbg('pc', st, 'ice=' + (pc && pc.iceConnectionState), 'sig=' + (pc && pc.signalingState));
    if (st === 'connected') {
      stopTone();
      const first = !connectedLogged;
      set({ phase: 'connected', status: 'connected', startedAt: S.startedAt || Date.now() });
      if (first) {
        connectedLogged = true;
        if (S.outgoing) writeLog('started');
      }
    } else if (st === 'failed') {
      endCall('failed');
    } else if (st === 'disconnected') {
      set({ status: 'reconnecting' });
      setTimeout(() => { if (pc && pc.connectionState === 'disconnected') endCall('lost'); }, 9000);
    }
  };
  return pc;
}
async function attachLocal(kind) {
  if (!localStream) {
    try { localStream = await getStream(kind, S.facing); }
    catch (e) {
      if (kind !== 'video') throw e;
      localStream = await getStream('audio');   // تعذّر الفيديو → مكالمة صوتية
      set({ kind: 'audio', camOn: false });
    }
  }
  if (kind === 'video' && !localStream.getVideoTracks().length) {
    try {
      const vs = await getStream('video', S.facing);
      vs.getVideoTracks().forEach((t) => localStream.addTrack(t));
    } catch { /* يبقى صوتياً */ }
  }
  localStream.getTracks().forEach((tr) => {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === tr.kind);
    if (sender) sender.replaceTrack(tr);
    else pc.addTrack(tr, localStream);
  });
  set({}); // لتظهر كاميرتي في الشاشة فوراً
}
const rid = () => Math.random().toString(36).slice(2, 10);
const allPcs = () => [pc, ...[...extras.values()].map((l) => l.pc)].filter(Boolean);
function listPeers() {
  const out = [];
  if (peerId) out.push({ id: Number(peerId), user: S.peer, connected: S.phase === 'connected' });
  extras.forEach((l) => out.push({ id: l.id, user: l.user, connected: l.connected }));
  known.forEach((k) => { if (!out.some((x) => Number(x.id) === Number(k.id))) out.push({ id: k.id, user: k.user, connected: false, pending: true }); });
  return out;
}
function pushPeers() { set({ peers: listPeers() }); }
/** يضيف مساراتنا المحلية (صوت/كاميرا) إلى اتصال معيّن. */
function addLocalTo(p) {
  if (!p || !localStream) return;
  localStream.getTracks().forEach((tr) => {
    const sender = p.getSenders().find((x) => x.track && x.track.kind === tr.kind);
    if (sender) sender.replaceTrack(tr);
    else p.addTrack(tr, localStream);
  });
  if (!p.getTransceivers().some((x) => (x.sender && x.sender.track && x.sender.track.kind === 'video') || (x.receiver && x.receiver.track && x.receiver.track.kind === 'video'))) {
    try { p.addTransceiver('video', { direction: 'sendrecv' }); } catch { /* ignore */ }
  }
}
function newLegPc(user) {
  const p = new RTCPeerConnection(rtcConfig());
  const remote = new MediaStream();
  const leg = { id: Number(user.id), user, pc: p, remote, i: rid(), connected: false };
  p.ontrack = (e) => {
    const st = e.streams && e.streams[0];
    if (st) st.getTracks().forEach((tr) => { if (!remote.getTracks().includes(tr)) remote.addTrack(tr); });
    else if (!remote.getTracks().includes(e.track)) remote.addTrack(e.track);
    set({});
  };
  p.onconnectionstatechange = () => {
    leg.connected = p.connectionState === 'connected';
    if (p.connectionState === 'failed') dropLeg(leg.id);
    pushPeers();
    if (leg.connected) { dbg('leg-connected', leg.id); announce(leg.id); startStats(); }
  };
  return leg;
}
/** يُعلن للمشاركين الآخرين أن يدعوا العضو الجديد (حلقة كاملة بين الجميع). */
async function announce(newPeerId) {
  const metas = listPeers();
  for (const leg of extras.values()) {
    if (Number(leg.id) === Number(newPeerId)) continue;
    try { await send(leg.id, 'dial', { u: Number(newPeerId), n: nameOf(newPeerId), lst: metas.map((m) => ({ id: m.id, u: m.user?.username, f: m.user?.fullName })) }); } catch { /* ignore */ }
  }
  if (peerId && Number(peerId) !== Number(newPeerId)) {
    try { await send(peerId, 'dial', { u: Number(newPeerId), n: nameOf(newPeerId), lst: metas.map((m) => ({ id: m.id, u: m.user?.username, f: m.user?.fullName })) }); } catch { /* ignore */ }
  }
}
const nameOf = (id) => (extras.get(Number(id))?.user?.fullName || extras.get(Number(id))?.user?.username || known.get(Number(id))?.user?.username || '');

/** دعوة مشارك جديد إلى المكالمة الجارية (ساق WebRTC مستقلة معه). */
export async function inviteToCall(user) {
  if (!user || !localStream) return false;
  const id = Number(user.id);
  if (id === Number(peerId) || extras.has(id)) return false;
  if (extras.size >= 3) { set({ notice: { k: 'full' } }); return false; }
  try {
    known.set(id, { id, user });
    const leg = newLegPc({ ...user, id });
    extras.set(id, leg);
    pushPeers();
    addLocalTo(leg.pc);
    const offer = await leg.pc.createOffer();
    await leg.pc.setLocalDescription(offer);
    await waitIceFor(leg.pc);
    await send(id, 'offer', { i: leg.i, d: await pack(leg.pc.localDescription.sdp), grp: 1, g: groupId, nm: user, k: S.kind });
    set({ notice: { k: 'invited', name: user.fullName || user.username } });
    startStats();
    return true;
  } catch { dropLeg(id); return false; }
}
function waitIceFor(p, ms = 3500) {
  return new Promise((resolve) => {
    if (p.iceGatheringState === 'complete') return resolve();
    const t = setTimeout(resolve, ms);
    p.onicegatheringstatechange = () => { if (p.iceGatheringState === 'complete') { clearTimeout(t); resolve(); } };
  });
}
function dropLeg(id) {
  const leg = extras.get(Number(id));
  if (!leg) return;
  try { leg.pc.close(); } catch { /* ignore */ }
  extras.delete(Number(id));
  known.delete(Number(id));
  pushPeers();
}
/** قبول ساق قادمة من مشارك آخر في نفس المكالمة (بلا رنين). */
async function joinLeg(env, from, user) {
  const sdp = env.d ? await unpack(env.d) : '';
  if (!sdp) return;
  try {
    const leg = newLegPc({ ...(user || {}), id: from });
    leg.i = env.i;                      // نردّ بنفس معرّف الساق
    extras.set(Number(from), leg);
    if (user) known.set(Number(from), { id: Number(from), user });
    pushPeers();
    addLocalTo(leg.pc);
    await leg.pc.setRemoteDescription({ type: 'offer', sdp });
    await flushCandFor(leg.pc, sdp);
    const answer = await leg.pc.createAnswer();
    await leg.pc.setLocalDescription(answer);
    await waitIceFor(leg.pc);
    await send(from, 'answer', { i: leg.i, d: await pack(leg.pc.localDescription.sdp), grp: 1, g: groupId });
    startStats();
  } catch { dropLeg(from); }
}
/** إضافة مرشّحات مضمّنة في SDP معيّن إلى اتصال معيّن. */
async function flushCandFor(p, sdp) {
  for (const c of parseCandidates(sdp)) {
    if (!c.candidate) continue;
    try { await p.addIceCandidate(c); } catch { /* ignore */ }
  }
}
/** كل الأقران المرتبطين + الأساسي (لأوامر الكاميرا والصوت). */
function forEachPc(fn) { allPcs().forEach((p) => { try { fn(p); } catch { /* ignore */ } }); }

/** تحسين الصوت (Audio Touch Up): تنقية + ضغط + وضوح — على مسار الميكروفون الحقيقي. */
async function buildTouchUp() {
  if (touchUpTrack) return touchUpTrack;
  const ctx = ctxAudio();
  if (!ctx || !localStream) return null;
  try {
    const src = ctx.createMediaStreamSource(localStream);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 95;
    const air = ctx.createBiquadFilter(); air.type = 'peaking'; air.frequency.value = 2700; air.gain.value = 3.5; air.Q.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26; comp.knee.value = 18; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
    const gain = ctx.createGain(); gain.gain.value = 1.35;
    const dest = ctx.createMediaStreamDestination();
    src.connect(hp); hp.connect(air); air.connect(comp); comp.connect(gain); gain.connect(dest);
    touchUpGraph = { src, hp, air, comp, gain, dest };
    touchUpTrack = dest.stream.getAudioTracks()[0] || null;
  } catch { touchUpTrack = null; }
  return touchUpTrack;
}
function destroyTouchUp() {
  try {
    Object.values(touchUpGraph || {}).forEach((n) => { try { n.disconnect(); } catch { /* ignore */ } });
  } catch { /* ignore */ }
  touchUpGraph = null;
  touchUpTrack = null;
}
async function applyAudioTrack() {
  const t = (S.touchUp && touchUpTrack) ? touchUpTrack : localStream?.getAudioTracks()[0];
  if (!t) return;
  forEachPc((p) => {
    const sender = p.getSenders().find((x) => x.track && x.track.kind === 'audio');
    if (sender) sender.replaceTrack(t);
  });
}
export async function setAudioTouchUp(on) {
  const v = typeof on === 'boolean' ? on : !S.touchUp;
  set({ touchUp: v });
  if (v) { await buildTouchUp(); } else { await applyAudioTrack(); destroyTouchUp(); }
  await applyAudioTrack();
  return v;
}
/** المتحدث النشط: من إحصاءات WebRTC الحقيقية (مستوى صوت كل مشارك). */
function startStats() {
  if (statsTimer) return;
  statsTimer = setInterval(async () => {
    const all = [];
    if (pc && peerId) all.push([Number(peerId), pc]);
    extras.forEach((l) => all.push([l.id, l.pc]));
    if (all.length < 2) { if (S.speakerId) set({ speakerId: 0 }); return; }
    let best = { id: 0, level: 0.02 };
    for (const [id, p] of all) {
      try {
        const st = await p.getStats();
        st.forEach((r) => {
          if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio') && typeof r.audioLevel === 'number' && r.audioLevel > best.level) best = { id, level: r.audioLevel };
        });
      } catch { /* ignore */ }
    }
    if (best.id !== S.speakerId) set({ speakerId: best.id });
  }, 900);
}

/** قناة الفيديو في هذا الاتصال (إن وُجدت) — تُستعمل لتشغيل/إطفاء الكاميرا. */
function videoChannel() {
  if (!pc) return null;
  return pc.getTransceivers().find((t) => t.sender && t.sender.track && t.sender.track.kind === 'video')
    || pc.getTransceivers().find((t) => t.receiver && t.receiver.track && t.receiver.track.kind === 'video')
    || null;
}
/** المتصل يضمن وجود قناة فيديو منذ البداية (بلا أي مسار وهمي) ليصبح
 *  تشغيل الكاميرا لاحقاً فورياً دون إعادة تفاوض. */
function ensureVideoChannel() {
  if (!pc || videoChannel()) return;
  try { pc.addTransceiver('video', { direction: 'sendrecv' }); } catch { /* ignore */ }
}
function startRefreshLoop(mode) {
  clearTimeout(refreshTimer);
  const step = async () => {
    if (!pc || S.phase === 'idle' || S.phase === 'ended' || pc.connectionState === 'connected' || refreshes > 14) {
      refreshTimer = null; return;
    }
    try {
      refreshes += 1;
      if (mode === 'answer') await send(peerId, 'answer', { d: await pack(pc.localDescription.sdp), i: callId });
      else await send(peerId, 'ice', { d: await pack(pc.localDescription.sdp) });
      dbg('refresh', mode, refreshes);
    } catch { /* ignore */ }
    refreshTimer = setTimeout(step, 4200 + Math.random() * 2600);
  };
  refreshTimer = setTimeout(step, 3800 + Math.random() * 2200);
}

/* ---------------- سجل المكالمة (مرئي للطرفين) ---------------- */
async function writeLog(d) {
  if (!peerId) return;
  if (d !== 'started' && endLogged) return;
  if (d !== 'started') endLogged = true;
  try { await api(`messages/${peerId}`, { method: 'POST', body: { text: makeCallLog(S.kind, d, Date.now()) } }); } catch { /* ignore */ }
}

/* ---------------- الواجهة العامة ---------------- */
export async function startCall(peer, kind = 'audio', opts = {}) {
  if (S.phase !== 'idle') return;
  peerId = peer.id; callId = rid(); groupId = rid();
  extras.forEach((l) => { try { l.pc.close(); } catch { /* ignore */ } });
  extras.clear(); known.clear();
  seen = new Set(); addedCand = new Set(); queuedCand = []; pendingOffer = null; refreshes = 0;
  ringSent = false; busySent = false; connectedLogged = false; endLogged = false;
  set({
    ...IDLE, phase: 'outgoing', kind, peer, incoming: false, outgoing: true,
    camOn: kind === 'video', speaker: kind === 'video', facing: 'user',
    status: opts.active ? 'ringing' : 'contacting',
  });
  try {
    outgoingTone();
    grabWakeLock();
    newPeer();
    await attachLocal(kind);
    ensureVideoChannel();
    if (S.touchUp) { await buildTouchUp(); await applyAudioTrack(); }
    set({ groupId, peers: listPeers() });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send(peerId, 'offer', { d: await pack(pc.localDescription.sdp), g: groupId });
    startRefreshLoop('ice');
    timeoutTimer = setTimeout(() => { if (S.phase === 'outgoing' || S.phase === 'connecting') endCall('noanswer'); }, 60000);
  } catch (e) {
    cleanup(); resetIds();
    set({ ...IDLE, phase: 'idle', error: e?.name === 'NotAllowedError' ? 'perm' : 'media' });
  }
}

export async function acceptCall() {
  if (S.phase !== 'incoming' || !pendingOffer) return;
  stopTone();
  set({ phase: 'connecting', status: 'connecting', incoming: false });
  try {
    grabWakeLock();
    groupId = pendingGroup || rid();
    newPeer();
    await attachLocal(S.kind);
    known.clear();
    if (pendingList?.length) pendingList.forEach((m) => { if (Number(m.id) !== Number(peerId)) known.set(Number(m.id), { id: Number(m.id), user: { id: Number(m.id), username: m.u, fullName: m.f } }); });
    if (S.touchUp) { await buildTouchUp(); await applyAudioTrack(); }
    set({ groupId, peers: listPeers() });
    await pc.setRemoteDescription({ type: 'offer', sdp: pendingOffer });
    pendingOffer = null;
    await flushCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await send(peerId, 'answer', { d: await pack(pc.localDescription.sdp), i: callId });
    startRefreshLoop('answer');
    timeoutTimer = setTimeout(() => { if (S.phase === 'connecting') endCall('failed'); }, 45000);
  } catch (e) {
    endCall(e?.name === 'NotAllowedError' ? 'perm' : 'media');
  }
}

export async function declineCall() {
  stopTone();
  const to = peerId;
  if (to) { try { await send(to, 'decline'); } catch { /* ignore */ } }
  pendingOffer = null; pendingGroup = ''; pendingList = null;
  cleanup(); resetIds();
  set({ ...IDLE, phase: 'ended', status: 'declined', reason: 'declined' });
  setTimeout(() => { if (S.phase === 'ended') set({ ...IDLE }); }, 1500);
}

export async function endCall(reason = 'hangup') {
  if (S.phase === 'idle' || S.phase === 'ended') return;
  const wasConnected = S.phase === 'connected';
  const mine = S.outgoing;
  const to = peerId;
  if (to && reason === 'hangup') { try { await send(to, 'bye'); } catch { /* ignore */ } }
  for (const leg of extras.values()) { try { await send(leg.id, 'bye', { i: leg.i }); } catch { /* ignore */ } }
  if (mine) {
    if (wasConnected) await writeLog('ended');
    else await writeLog('missed');
  }
  cleanup(); resetIds();
  set({ ...IDLE, phase: 'ended', status: reason, reason });
  setTimeout(() => { if (S.phase === 'ended') set({ ...IDLE }); }, 1700);
}

function resetIds() { peerId = null; signalPeer = null; pendingOffer = null; set({ peers: [], speakerId: 0 }); }
function cleanup() {
  stopTone();
  try { wakeLock?.release?.(); } catch { /* ignore */ }
  wakeLock = null;
  clearInterval(refreshTimer); refreshTimer = null;
  clearTimeout(timeoutTimer); timeoutTimer = null;
  clearTimeout(ringTimeout); ringTimeout = null;
  clearInterval(statsTimer); statsTimer = null;
  extras.forEach((l) => { try { l.pc.close(); } catch { /* ignore */ } });
  extras.clear(); known.clear();
  groupId = '';
  try { pc?.close(); } catch { /* ignore */ }
  pc = null;
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null; remoteStream = null;
  queuedCand = []; addedCand = new Set();
  destroyTouchUp();
}

/* ---------------- أوامر داخل المكالمة ---------------- */
export function setMuted(v) {
  const m = typeof v === 'boolean' ? v : !S.muted;
  localStream?.getAudioTracks().forEach((t) => { t.enabled = !m; });
  set({ muted: m });
  try { navigator.vibrate?.(12); } catch { /* ignore */ }
  return m;
}
export async function toggleCam() {
  if (!localStream || !pc) return false;
  const tx = videoChannel();
  const live = localStream.getVideoTracks().find((t) => t.readyState === 'live');
  const on = live ? !S.camOn : true;
  if (!tx && on) return false;                       // لا قناة فيديو في هذا الاتصال
  if (on) {
    try {
      const vs = await getStream('video', S.facing);
      const cam = vs.getVideoTracks()[0];
      if (live) { live.stop(); localStream.removeTrack(live); }
      localStream.addTrack(cam);
      if (tx) await tx.sender.replaceTrack(cam);
      for (const p of allPcs()) {
        const sender = p.getSenders().find((x) => x.track && x.track.kind === 'video');
        if (sender) await sender.replaceTrack(cam).catch(() => {});
      }
      await applyAudioTrack();
      set({ kind: 'video', camOn: true, speaker: true });
      try { send(peerId, 'cam1', { k: 'video' }); } catch { /* ignore */ }
      try { navigator.vibrate?.(12); } catch { /* ignore */ }
      return true;
    } catch {
      set({ error: 'media' });                       // لا إذن كاميرا → رسالة واضحة
      return false;
    }
  }
  if (live) { live.stop(); localStream.removeTrack(live); }
  try { if (tx) await tx.sender.replaceTrack(null); } catch { /* ignore */ }
  for (const p of allPcs()) {
    const sender = p.getSenders().find((x) => x.track && x.track.kind === 'video');
    if (sender) await sender.replaceTrack(null).catch(() => {});
  }
  set({ camOn: false });
  try { send(peerId, 'cam1x', { k: 'video' }); } catch { /* ignore */ }
  try { navigator.vibrate?.(12); } catch { /* ignore */ }
  return false;
}

export async function switchCamera() {
  const next = S.facing === 'user' ? 'environment' : 'user';
  try {
    const cur = localStream?.getVideoTracks().find((t) => t.readyState === 'live');
    const tx = videoChannel();
    if (cur && tx) {
      const vs = await getStream('video', next);
      const cam = vs.getVideoTracks()[0];
      await tx.sender.replaceTrack(cam);
      localStream.removeTrack(cur); cur.stop(); localStream.addTrack(cam);
      set({ facing: next });
    }
    return next;
  } catch { return S.facing; }
}
export function setSpeaker(v) {
  const s = typeof v === 'boolean' ? v : !S.speaker;
  set({ speaker: s });
  try {
    const el = document.getElementById('nx-call-audio');
    if (el?.setSinkId && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((ds) => {
        const outs = ds.filter((d) => d.kind === 'audiooutput');
        const wanted = s
          ? outs.find((d) => /speaker|loud|مكبر/i.test(d.label)) || outs.find((d) => d.deviceId === 'default')
          : outs.find((d) => /earpiece|communication|سماعة|écouteur/i.test(d.label));
        if (wanted) el.setSinkId(wanted.deviceId).catch(() => {});
      }).catch(() => {});
    }
    el?.play?.().catch(() => {});
  } catch { /* ignore */ }
  return s;
}
export function setVolume(v) { set({ volume: Math.max(0, Math.min(1, Number(v) || 0)) }); }
export function clearError() { if (S.error) set({ error: '' }); }

/* ---------------- الاستقبال ---------------- */
function envOf(text) {
  if (!isCallSignal(text)) return null;
  try { return JSON.parse(dec(text.slice(MARK.length))); } catch { return null; }
}

async function handleSignal(env, from) {
  const sameCall = env.i === callId;
  const sdp = env.d ? await unpack(env.d) : '';
  if (sdp) await harvest(sdp);
  switch (env.t) {
    case 'offer': {
      // دعوة إلى مكالمة جماعية قائمة (ساق إضافية بلا رنين)
      if (env.grp && S.phase !== 'idle' && env.g && env.g === groupId && !extras.has(Number(from))) {
        await joinLeg(env, from, env.nm || signalPeer);
        break;
      }
      if (env.r) {
        if (pc && pc.signalingState === 'stable' && sdp) {
          await pc.setRemoteDescription({ type: 'offer', sdp });
          await flushCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await send(from, 'answer', { d: await pack(pc.localDescription.sdp) });
          set({ kind: 'video' });
        }
        break;
      }
      if (S.phase === 'idle') {
        callId = env.i; peerId = from; pendingOffer = sdp;
        pendingGroup = env.g || ''; pendingList = env.lst || null;
        ringSent = false; busySent = false; endLogged = false; connectedLogged = false; refreshes = 0;
        set({
          ...IDLE, phase: 'incoming', incoming: true, outgoing: false, status: 'incoming',
          kind: env.k === 'video' ? 'video' : 'audio', peerCam: env.k === 'video',
          peer: signalPeer || { id: from, username: '' },
          camOn: env.k === 'video', speaker: env.k === 'video', ringStamp: Date.now(),
        });
        incomingTone();
        try { await send(from, 'ring'); ringSent = true; } catch { /* ignore */ }
        ringTimeout = setTimeout(() => { if (S.phase === 'incoming') declineCall(); }, 45000);
      } else if (S.phase === 'incoming' && sameCall) {
        pendingOffer = sdp;
      } else if (!sameCall && !busySent && !ringSent) {
        if (S.phase === 'outgoing' && !ringSent) { /* لا شيء */ }
        busySent = true;
        try {
          const r = await api(`messages/${from}`, { method: 'POST', body: { text: MARK + enc(JSON.stringify({ i: env.i, t: 'busy', k: env.k })) } });
          scheduleDelete(r?.message?.id);
        } catch { /* ignore */ }
      }
      break;
    }
    case 'answer': {
      const leg = [...extras.values()].find((l) => l.i === env.i);
      if (leg && sdp) {
        try {
          await leg.pc.setRemoteDescription({ type: 'answer', sdp });
          await flushCandFor(leg.pc, sdp);
        } catch { /* ignore */ }
        break;
      }
      if (pc && sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription({ type: 'answer', sdp });
          await flushCandidates();
          set({ phase: 'connecting', status: 'connecting' });
        } else await harvest(sdp);
      }
      break;
    }
    case 'ice': if (sdp) await harvest(sdp); break;
    case 'syn': {
      const leg = [...extras.values()].find((l) => l.i === env.i);
      if (leg && sdp) await flushCandFor(leg.pc, sdp);
      else if (sdp) await harvest(sdp);
      break;
    }
    case 'dial': {
      if (S.phase === 'idle' || !env.u) break;
      if (env.lst) env.lst.forEach((m) => { if (Number(m.id) !== Number(meId)) known.set(Number(m.id), { id: Number(m.id), user: { id: Number(m.id), username: m.u, fullName: m.f } }); });
      pushPeers();
      if (!extras.has(Number(env.u)) && Number(env.u) !== Number(peerId)) {
        inviteToCall({ id: Number(env.u), username: env.n || '', fullName: env.n || '' }).catch(() => {});
      }
      break;
    }
    case 'cam1': if (sameCall) set({ kind: 'video', peerCam: true }); break;
    case 'cam1x': if (sameCall) set({ peerCam: false }); break;   // كاميرا الطرف أُطفئت
    case 'ring': if (S.phase === 'outgoing') set({ status: 'ringing' }); break;
    case 'busy': if (sameCall && (S.phase === 'outgoing' || S.phase === 'connecting')) endCall('busy'); break;
    case 'decline': {
      const leg = [...extras.values()].find((l) => l.i === env.i);
      if (leg) { dropLeg(leg.id); set({ notice: { k: 'declinedPeer', name: leg.user?.fullName || leg.user?.username } }); break; }
      if (sameCall && S.phase !== 'idle' && S.phase !== 'ended') endCall('declined');
      break;
    }
    case 'bye': {
      const leg = [...extras.values()].find((l) => l.i === env.i);
      if (leg) {
        const who = leg.user?.fullName || leg.user?.username || '';
        dropLeg(leg.id);
        if (S.phase === 'connected' && who) set({ notice: { k: 'peerLeft', name: who } });
        break;
      }
      if (sameCall && S.phase !== 'idle' && S.phase !== 'ended') endCall('remote');
      break;
    }
    default: break;
  }
}

async function poll() {
  if (!getToken()) return;
  lastScan = Date.now();
  let convs = [];
  try { const r = await api('conversations'); convs = r.conversations || []; } catch { return; }
  const targets = [];
  const watching = new Set([peerId, ...extras.keys(), ...known.keys()].filter(Boolean).map(Number));
  for (const c of convs) {
    if (!c.last || c.last.mine) continue;
    const age = Date.now() - new Date(c.last.createdAt).getTime();
    if (isCallSignal(c.last.text) && age < 60000) targets.push([c.last, c.user]);
    else if (watching.has(Number(c.user.id))) targets.push([c.last, c.user]);
  }
  for (const [last, user] of targets) {
    let env = envOf(last.text);
    if (!env) continue;
    if (env.t === 'part') { try { env = await readParts(user.id, env); } catch { env = null; } if (!env) continue; }
    let key = `${last.createdAt}|${last.text.length}|${last.text.slice(-40)}`;
    if (env.t === 'part') key = `${last.createdAt}|full`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 400) seen = new Set([...seen].slice(-200));
    signalPeer = user;
    dbg('rx', env.t, String(env.i).slice(0, 6));
    try { await handleSignal(env, user.id); } catch (e) { dbg('rx-err', env.t, e?.message); }
  }
  // مكالمة واردة اختفت إشارتها (انتهت من الطرف الآخر قبل أن نراها)
  if (S.phase === 'incoming' && peerId && Date.now() - S.ringStamp > 8000) {
    const c = convs.find((x) => Number(x.user.id) === Number(peerId));
    const fresh = c && c.last && !c.last.mine && isCallSignal(c.last.text)
      && (Date.now() - new Date(c.last.createdAt).getTime() < 60000);
    if (!fresh) declineCall();
  }
}

let loopTimer = null;
export function startCallLoop() {
  if (loopStarted) return () => {};
  loopStarted = true;
  const tick = async () => {
    if (!loopStarted) return;
    const busyCall = S.phase !== 'idle';
    if (!(document.visibilityState === 'hidden' && !busyCall && Date.now() - lastScan < 5000)) {
      try { await poll(); } catch { /* ignore */ }
    }
    loopTimer = setTimeout(tick, busyCall ? 1200 : 3000);
  };
  tick();
  return () => { loopStarted = false; clearTimeout(loopTimer); };
}

/** قائمة المشاركين الحالية (للعرض) */
export const getPeersList = () => listPeers();
export function clearNotice() { if (S.notice) set({ notice: null }); }

/* hook للتطوير فقط — يُحذف تلقائياً في نسخة الإنتاج */
if (import.meta.env && import.meta.env.DEV) {
  window.__nxCall = { getCall, getStreams, startCall, acceptCall, endCall, toggleCam, switchCamera, setMuted, setSpeaker, inviteToCall, setAudioTouchUp, getPeersList, dbg: () => DBG };
}
