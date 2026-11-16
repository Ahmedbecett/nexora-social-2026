/* NEXORA Studio — API client (JSON + SSE). */

import { api as platformApi, getToken, setToken } from '../api.js';

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export class StudioApiError extends Error {
  constructor(code, status, detail) {
    super(code || 'request_failed');
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/* ---------------------------------------------------------------------------
   Guest sessions
   ---------------------------------------------------------------------------
   The Studio opens without an account. The server hands out a signed guest
   credential; it is kept in this browser and sent on every request, so the
   projects of one visitor are never mixed with another's. Once the visitor
   links a NEXORA account the credential is dropped and the account takes over.
   --------------------------------------------------------------------------- */
const GUEST_KEY = 'nxs_guest_token';
const MODE_KEY = 'nxs_studio_mode';

export function getGuestToken() {
  try { return localStorage.getItem(GUEST_KEY) || ''; } catch { return ''; }
}

export function setGuestToken(token) {
  try {
    if (token) localStorage.setItem(GUEST_KEY, token);
    else localStorage.removeItem(GUEST_KEY);
  } catch { /* private mode */ }
}

/** 'guest' (default) or 'account' — which workspace the Studio is showing. */
export function getStudioMode() {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === 'guest' || saved === 'account') return saved;
  } catch { /* private mode */ }
  return getToken() ? 'account' : 'guest';
}

export function setStudioMode(mode) {
  try { localStorage.setItem(MODE_KEY, mode === 'account' ? 'account' : 'guest'); } catch { /* private mode */ }
}

function authHeaders(extra = {}) {
  if (getStudioMode() === 'account') {
    const t = getToken();
    return { ...extra, ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  }
  const g = getGuestToken();
  return { ...extra, 'X-Studio-Mode': 'guest', ...(g ? { 'X-Studio-Guest': g } : {}) };
}

export async function request(path, { method = 'GET', body, timeout = 60_000 } = {}) {
  const ctrl = timeout ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/${path}`, {
      method,
      signal: ctrl?.signal,
      headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    throw new StudioApiError('network', 0, e?.name === 'AbortError' ? 'timeout' : 'network');
  }
  if (timer) clearTimeout(timer);
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new StudioApiError(data.error || 'request_failed', res.status, data.detail);
  return data;
}

/**
 * POST that answers with a text/event-stream. Calls `onEvent(event, data)` for
 * every frame and resolves when the stream ends.
 */
export async function streamRequest(path, body, { onEvent, signal, timeout = 0 } = {}) {
  const ctrl = new AbortController();
  const abort = () => { try { ctrl.abort(); } catch { /* already */ } };
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  const timer = timeout ? setTimeout(abort, timeout) : null;
  let res;
  try {
    res = await fetch(`${API_BASE}/api/${path}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify(body || {}),
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (ctrl.signal.aborted) throw new StudioApiError('aborted', 0, 'aborted');
    throw new StudioApiError('network', 0, 'network');
  }
  if (!res.ok) {
    if (timer) clearTimeout(timer);
    let data = {};
    try { data = await res.json(); } catch { /* not json */ }
    throw new StudioApiError(data.error || 'request_failed', res.status, data.detail);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new StudioApiError('stream_unsupported', 0, 'this browser cannot read streams');
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        const lines = frame.split('\n');
        let event = 'message';
        const dataLines = [];
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let payload = {};
        try { payload = JSON.parse(dataLines.join('\n')); } catch { payload = {}; }
        if (event === 'end') return;
        if (onEvent) onEvent(event, payload);
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener?.('abort', abort);
  }
}

/* --------------------------------- auth --------------------------------- */
export async function studioSession() {
  let data = await request('studio/session', { timeout: 20_000 });
  if (!data?.authenticated && getStudioMode() === 'account') {
    /* the account session is gone (signed out or expired): fall back to the
       guest workspace instead of showing a sign-in wall */
    setStudioMode('guest');
    data = await request('studio/session', { timeout: 20_000 });
  }
  if (data?.guest) {
    setStudioMode('guest');
    if (data.guestToken) setGuestToken(data.guestToken);
  } else if (data?.authenticated) {
    setStudioMode('account');
  }
  return data;
}

/**
 * Link the guest workspace to an account: the server moves every guest-owned
 * project, message, revision, run, deployment and key to the account owner.
 */
export async function claimGuestSession(accountToken) {
  const guest = getGuestToken();
  if (!guest) throw new StudioApiError('no_guest_session', 400, 'there is no guest workspace to link');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  let res;
  try {
    res = await fetch(`${API_BASE}/api/studio/claim`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountToken}`,
        'X-Studio-Guest': guest,
      },
      body: JSON.stringify({ guestToken: guest }),
    });
  } catch (e) {
    clearTimeout(timer);
    throw new StudioApiError('network', 0, e?.name === 'AbortError' ? 'timeout' : 'network');
  }
  clearTimeout(timer);
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new StudioApiError(data.error || 'request_failed', res.status, data.detail);
  return data;
}

/** What the guest workspace holds right now (used by the "link account" hint). */
export async function guestWorkspaceSummary() {
  const guest = getGuestToken();
  if (!guest) return null;
  try {
    const res = await fetch(`${API_BASE}/api/studio/projects`, {
      headers: { 'X-Studio-Mode': 'guest', 'X-Studio-Guest': guest },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { projects: data?.projects || [] };
  } catch {
    return null;
  }
}

/* ------------------------- NEXORA account sign-in ------------------------ */
/* The account endpoints are the platform ones: signing in here gives the
   Studio the same credential the rest of NEXORA uses. */
export async function signInToAccount(identifier, password) {
  const data = await platformApi('auth/login', {
    method: 'POST', body: { identifier, password }, token: null, timeout: 30_000,
  });
  if (data?.token) setToken(data.token);
  return data;
}

export async function registerAccount({ fullName, username, email, password }) {
  const data = await platformApi('auth/register', {
    method: 'POST', body: { fullName, username, email, password }, token: null, timeout: 30_000,
  });
  if (data?.token) setToken(data.token);
  return data;
}
