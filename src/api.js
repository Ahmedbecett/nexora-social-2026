import { put } from '@vercel/blob/client';

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export const WEB_URL = import.meta.env.VITE_WEB_URL || 'https://nexora-social-2026.vercel.app';

let token = localStorage.getItem('nx_token') || null;
export const getToken = () => token;
export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('nx_token', t); else localStorage.removeItem('nx_token');
}

/* ---------------- saved accounts (multi-account) ---------------- */
const ACC_KEY = 'nx_accounts';
export function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACC_KEY)) || []; } catch { return []; }
}
function saveAccounts(list) { localStorage.setItem(ACC_KEY, JSON.stringify(list.slice(0, 10))); }
export function upsertAccount(user, tk) {
  if (!user) return;
  const prev = getAccounts();
  const old = prev.find((a) => a.id === user.id);
  const entry = { id: user.id, username: user.username, fullName: user.fullName, avatarUrl: user.avatarUrl, verified: user.verified, token: tk === undefined ? old?.token || null : tk };
  saveAccounts(old ? prev.map((a) => (a.id === user.id ? entry : a)) : [entry, ...prev]);
}
export function forgetAccount(id) { saveAccounts(getAccounts().filter((a) => a.id !== id)); }
export function dropAccountToken(id) { saveAccounts(getAccounts().map((a) => (a.id === id ? { ...a, token: null } : a))); }
// one-time migration from the single-account storage
(() => {
  try {
    const me = JSON.parse(localStorage.getItem('nx_me') || 'null');
    if (token && me && !getAccounts().some((a) => a.id === me.id)) upsertAccount(me, token);
  } catch { /* ignore */ }
})();

const listeners = new Set();
export const onUnauthorized = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

export async function api(path, { method = 'GET', body, signal, token: tk } = {}) {
  const auth = tk !== undefined ? tk : token;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/${path}`, {
      method, signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('network', 0);
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    if (res.status === 401 && token && auth === token && !path.startsWith('auth/')) listeners.forEach((fn) => fn());
    throw new ApiError(data.error || 'server_error', res.status);
  }
  return data;
}

/* ---------------- media helpers ---------------- */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = reject;
    img.src = url;
  });
}

/** Resize + recompress an image to JPEG (max side `max` px). */
export async function compressImage(file, max = 1440, quality = 0.86) {
  if (file.type === 'image/gif') return { blob: file, w: null, h: null };
  const { img, url } = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  return { blob, w, h };
}

/** Grab a poster frame + dimensions from a video file. */
export function videoInfo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    let done = false;
    const finish = (val) => { if (!done) { done = true; URL.revokeObjectURL(url); resolve(val); } };
    v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch { finish({ w: v.videoWidth, h: v.videoHeight, poster: null }); } };
    v.onseeked = () => {
      try {
        const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => finish({ w: v.videoWidth, h: v.videoHeight, duration: v.duration, poster: b }), 'image/jpeg', 0.8);
      } catch { finish({ w: v.videoWidth, h: v.videoHeight, poster: null }); }
    };
    v.onerror = () => finish({ w: null, h: null, poster: null });
    setTimeout(() => finish({ w: v.videoWidth || null, h: v.videoHeight || null, poster: null }), 8000);
  });
}

async function uploadBlob(blob, contentType, onProgress) {
  const { clientToken, pathname } = await api('upload/token', { method: 'POST', body: { contentType } });
  const r = await put(pathname, blob, {
    access: 'public', token: clientToken, contentType,
    multipart: blob.size > 8 * 1024 * 1024,
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
  });
  return r.url;
}

/** Upload an image or video file. Returns {url, type, w, h, poster}. */
export async function uploadMedia(file, onProgress) {
  if (file.type.startsWith('video/')) {
    const info = await videoInfo(file);
    let poster = null;
    if (info.poster) poster = await uploadBlob(info.poster, 'image/jpeg');
    const type = ['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type) ? file.type : 'video/mp4';
    const url = await uploadBlob(file, type, onProgress);
    return { url, type: 'video', w: info.w, h: info.h, poster };
  }
  const { blob, w, h } = await compressImage(file);
  const url = await uploadBlob(blob, blob.type || 'image/jpeg', onProgress);
  return { url, type: 'image', w, h };
}
