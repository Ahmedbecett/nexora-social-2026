/* NEXORA Studio — API client (JSON + SSE). */

import { getToken, setToken } from '../api.js';

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export class StudioApiError extends Error {
  constructor(code, status, detail) {
    super(code || 'request_failed');
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function authHeaders(extra = {}) {
  const t = getToken();
  return { ...extra, ...(t ? { Authorization: `Bearer ${t}` } : {}) };
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
  return request('studio/session', { timeout: 20_000 });
}

export async function loginWithPassword(username, password) {
  const data = await request('auth/login', { method: 'POST', body: { username, password }, timeout: 25_000 });
  if (data?.token) setToken(data.token);
  return data;
}

/* ---------------------------- OAuth helper ------------------------------- */
export async function launchOAuth(provider, { onComplete, onError } = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const data = await request(`studio/oauth/${encodeURIComponent(provider)}/start`, {
    method: 'POST',
    body: { origin },
    timeout: 20_000,
  });
  if (!data?.url) throw new StudioApiError('oauth_failed', 500, 'No authorization URL returned.');
  if (typeof window === 'undefined') return data;

  const isNarrow = window.innerWidth < 680;
  if (isNarrow) {
    window.location.assign(data.url);
    return data;
  }

  const w = 560;
  const h = 680;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const popup = window.open(data.url, `nexora_oauth_${provider}`, `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  if (!popup) {
    window.location.assign(data.url);
    return data;
  }

  let settled = false;
  const cleanup = () => {
    window.removeEventListener('message', onMsg);
    if (poll) window.clearInterval(poll);
  };
  const onMsg = (ev) => {
    const msg = ev?.data;
    if (!msg || msg.source !== 'nexora-oauth') return;
    if (msg.provider && msg.provider !== data.provider) return;
    settled = true;
    cleanup();
    try { popup.close(); } catch { /* ignore */ }
    if (msg.ok) onComplete?.(msg);
    else onError?.(msg.error || 'OAuth authorization failed.');
  };
  window.addEventListener('message', onMsg);
  const poll = window.setInterval(() => {
    if (popup.closed) {
      cleanup();
      if (!settled) onComplete?.({ provider: data.provider, closed: true });
    }
  }, 600);
  return data;
}
