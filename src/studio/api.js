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
