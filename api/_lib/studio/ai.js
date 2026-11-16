/* ============================================================================
   NEXORA Studio — model gateway
   ----------------------------------------------------------------------------
   One interface over the providers people actually deploy with:
     OpenAI · Anthropic · Google Gemini · OpenRouter · Groq · Cerebras ·
     Mistral · DeepSeek · xAI · GitHub Models · any OpenAI-compatible gateway
     (Ollama / vLLM / LiteLLM through STUDIO_AI_BASE_URL).

   Keys come from the server environment first (the same variables the NEXORA
   chat already uses) and can be overridden per account from the Studio settings.
   Nothing here fabricates an answer: if no provider can be reached the caller
   gets a typed error that the UI shows verbatim.
   ============================================================================ */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { studioQuery, studioOne, StudioError, nowIso } from './db.js';

/* ------------------------------ providers -------------------------------- */
/**
 * kind: 'openai' | 'gemini' | 'anthropic'
 * `models` is tried in order; the first model the provider accepts wins.
 */
export const PROVIDERS = [
  {
    id: 'openai', label: 'OpenAI', kind: 'openai',
    env: ['OPENAI_API_KEY'], base: () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.OPENAI_MODEL, 'gpt-4.1-mini', 'gpt-4o-mini'].filter(Boolean),
  },
  {
    id: 'anthropic', label: 'Anthropic', kind: 'anthropic',
    env: ['ANTHROPIC_API_KEY'], base: () => process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.ANTHROPIC_MODEL, 'claude-sonnet-4-5', 'claude-3-7-sonnet-latest'].filter(Boolean),
  },
  {
    id: 'gemini', label: 'Google Gemini', kind: 'gemini',
    env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'], base: () => 'https://generativelanguage.googleapis.com/v1beta',
    models: () => [process.env.STUDIO_MODEL, process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'].filter(Boolean),
  },
  {
    id: 'openrouter', label: 'OpenRouter', kind: 'openai',
    env: ['OPENROUTER_API_KEY'], base: () => 'https://openrouter.ai/api/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.OPENROUTER_MODEL, 'anthropic/claude-sonnet-4.5', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'].filter(Boolean),
    headers: () => ({ 'HTTP-Referer': process.env.APP_ORIGIN || 'https://nexora-social-2026.vercel.app', 'X-Title': 'NEXORA Studio' }),
  },
  {
    id: 'groq', label: 'Groq', kind: 'openai',
    env: ['GROQ_API_KEY'], base: () => 'https://api.groq.com/openai/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.GROQ_MODEL, 'llama-3.3-70b-versatile'].filter(Boolean),
  },
  {
    id: 'cerebras', label: 'Cerebras', kind: 'openai',
    env: ['CEREBRAS_API_KEY'], base: () => 'https://api.cerebras.ai/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.CEREBRAS_MODEL, 'llama3.3-70b'].filter(Boolean),
  },
  {
    id: 'mistral', label: 'Mistral', kind: 'openai',
    env: ['MISTRAL_API_KEY'], base: () => 'https://api.mistral.ai/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.MISTRAL_MODEL, 'codestral-latest', 'mistral-small-latest'].filter(Boolean),
  },
  {
    id: 'deepseek', label: 'DeepSeek', kind: 'openai',
    env: ['DEEPSEEK_API_KEY'], base: () => 'https://api.deepseek.com/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.DEEPSEEK_MODEL, 'deepseek-chat', 'deepseek-coder'].filter(Boolean),
  },
  {
    id: 'xai', label: 'xAI', kind: 'openai',
    env: ['XAI_API_KEY'], base: () => 'https://api.x.ai/v1',
    models: () => [process.env.STUDIO_MODEL, process.env.XAI_MODEL, 'grok-3-mini', 'grok-2-latest'].filter(Boolean),
  },
  {
    id: 'github', label: 'GitHub Models', kind: 'openai',
    env: ['GITHUB_MODELS_TOKEN', 'GH_MODELS_TOKEN'], base: () => 'https://models.github.ai/inference',
    models: () => [process.env.STUDIO_MODEL, process.env.GITHUB_MODEL, 'openai/gpt-4o-mini'].filter(Boolean),
  },
  {
    id: 'gateway', label: 'Custom gateway', kind: 'openai',
    env: ['STUDIO_AI_KEY'], base: () => process.env.STUDIO_AI_BASE_URL || '',
    models: () => [process.env.STUDIO_AI_MODEL || 'default'].filter(Boolean),
  },
  {
    id: 'pollinations', label: 'Pollinations (free)', kind: 'openai', keyless: true,
    env: [], base: () => 'https://text.pollinations.ai/openai',
    models: () => [process.env.POLLINATIONS_MODEL || 'openai'],
  },
];

export const providerMeta = (id) => PROVIDERS.find((p) => p.id === id) || null;

/* ------------------------------- key vault -------------------------------- */
function vaultKey() {
  const material = process.env.STUDIO_SECRET || process.env.JWT_SECRET || process.env.NEXORA_SECRET || 'nexora-studio-local';
  return createHash('sha256').update('nexora-studio:' + material).digest();
}

function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

function decrypt(blob) {
  try {
    const [v, iv, tag, data] = String(blob).split('.');
    if (v !== 'v1') return '';
    const d = createDecipheriv('aes-256-gcm', vaultKey(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch { return ''; }
}

export async function saveUserKey(ownerId, providerId, key, meta = {}) {
  const p = providerMeta(providerId);
  if (!p) throw new StudioError(400, 'unknown_provider');
  const k = String(key || '').trim();
  if (k.length < 8 || k.length > 500) throw new StudioError(400, 'invalid_key');
  const now = nowIso();
  const existing = await studioOne('select id from studio_keys where owner_id=$1 and provider=$2', [String(ownerId), p.id]);
  if (existing) {
    await studioQuery('update studio_keys set secret=$3, meta=$4, updated_at=$5 where id=$1 and owner_id=$2',
      [Number(existing.id), String(ownerId), encrypt(k), JSON.stringify({ ...meta, last4: k.slice(-4) }), now]);
  } else {
    await studioQuery('insert into studio_keys (owner_id, provider, secret, meta, created_at, updated_at) values ($1,$2,$3,$4,$5,$5)',
      [String(ownerId), p.id, encrypt(k), JSON.stringify({ ...meta, last4: k.slice(-4) }), now]);
  }
  return { provider: p.id, saved: true, last4: k.slice(-4) };
}

export async function deleteUserKey(ownerId, providerId) {
  await studioQuery('delete from studio_keys where owner_id=$1 and provider=$2', [String(ownerId), providerId]);
  return { provider: providerId, removed: true };
}

export async function userKeys(ownerId) {
  const rows = await studioQuery('select provider, secret, meta from studio_keys where owner_id=$1', [String(ownerId)]);
  const out = {};
  for (const r of rows) {
    const k = decrypt(r.secret);
    if (k) out[r.provider] = { key: k, meta: safeJson(r.meta) };
  }
  return out;
}

function safeJson(v) { if (typeof v === 'object' && v) return v; try { return JSON.parse(v || '{}'); } catch { return {}; } }

/** Environment key + per-user key, per provider. */
async function resolveKeys(ownerId) {
  const mine = ownerId ? await userKeys(ownerId) : {};
  const list = [];
  for (const p of PROVIDERS) {
    const fromUser = mine[p.id]?.key;
    const fromEnv = p.env.map((e) => process.env[e]).find(Boolean);
    const key = fromUser || fromEnv || '';
    if (!key && !p.keyless) continue;
    if (p.id === 'gateway' && !p.base()) continue;
    if (p.keyless && process.env.STUDIO_ALLOW_KEYLESS === '0') continue;
    list.push({ def: p, key, source: fromUser ? 'account' : (fromEnv ? 'server' : 'free') });
  }
  return list;
}

export async function providerStatus(ownerId) {
  let mine = {};
  try { mine = await userKeys(ownerId); } catch { mine = {}; }
  return PROVIDERS.map((p) => {
    const envKey = p.env.map((e) => process.env[e]).find(Boolean);
    const userKey = mine[p.id]?.key;
    return {
      id: p.id,
      label: p.label,
      kind: p.kind,
      keyless: Boolean(p.keyless),
      configured: Boolean(userKey || envKey || p.keyless) && !(p.id === 'gateway' && !p.base()),
      source: userKey ? 'account' : envKey ? 'server' : p.keyless ? 'free' : null,
      last4: mine[p.id]?.meta?.last4 || (envKey ? envKey.slice(-4) : null),
      models: p.models().slice(0, 3),
      base: p.id === 'gateway' ? (p.base() ? 'custom' : null) : undefined,
    };
  });
}

/* ------------------------------ HTTP helpers ------------------------------ */
async function readError(res) {
  const raw = await res.text().catch(() => '');
  let msg = raw.slice(0, 300);
  try {
    const j = JSON.parse(raw);
    msg = j?.error?.message || j?.message || j?.error || msg;
  } catch { /* plain text */ }
  return String(msg || '').replace(/\s+/g, ' ').slice(0, 240);
}

function classify(status, message) {
  const m = String(message || '').toLowerCase();
  if (status === 401 || status === 403 || /invalid.*(key|token)|unauthor|permission/.test(m)) return 'auth';
  if (status === 429 || /rate limit|quota|too many/.test(m)) return 'rate_limited';
  if (status === 402 || /billing|insufficient|credit/.test(m)) return 'billing';
  if (status === 404 || /model.*(not found|unsupported|does not exist)|invalid model/.test(m)) return 'model';
  if (status >= 500) return 'provider';
  return 'provider';
}

const parked = new Map(); // provider|model -> until
function isParked(id) { const t = parked.get(id); if (t && t > Date.now()) return true; if (t) parked.delete(id); return false; }
function park(id, ms) { parked.set(id, Date.now() + ms); }

/* --------------------------- OpenAI-compatible --------------------------- */
/* Images reach each provider in its own shape. Anything else is passed through
   untouched, so a provider without vision simply answers with its usual error. */
function messagesForProvider(messages, kind) {
  const hasImages = Array.isArray(messages) && messages.some((m) => Array.isArray(m.images) && m.images.length);
  if (!hasImages) return messages;
  if (kind === 'gemini') return messages;                       // mapped in callGemini
  if (kind === 'anthropic') {
    return messages.map((m) => (Array.isArray(m.images) && m.images.length
      ? {
        role: m.role,
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          ...m.images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.mime || 'image/jpeg', data: im.data } })),
        ],
      }
      : { role: m.role, content: m.content }));
  }
  return messages.map((m) => (Array.isArray(m.images) && m.images.length
    ? {
      role: m.role,
      content: [
        ...(m.content ? [{ type: 'text', text: m.content }] : []),
        ...m.images.map((im) => ({ type: 'image_url', image_url: { url: `data:${im.mime || 'image/jpeg'};base64,${im.data}` } })),
      ],
    }
    : { role: m.role, content: m.content }));
}

async function callOpenAICompatible({ def, key, model, base, messages, maxTokens, temperature, timeoutMs, signal, onDelta }) {
  const url = String(base).replace(/\/$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json', ...(def.headers ? def.headers() : {}) };
  if (key) headers.Authorization = 'Bearer ' + key;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: Boolean(onDelta),
    }),
    signal: anySignal(signal, timeoutMs),
  });
  if (!res.ok) {
    const msg = await readError(res);
    throw new ProviderError(classify(res.status, msg), res.status, msg);
  }
  if (!onDelta || !res.body) {
    const data = await res.json().catch(() => ({}));
    const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
    if (!text) throw new ProviderError('provider', res.status, 'empty response');
    return { text: String(text), model: data?.model || model, truncated: data?.choices?.[0]?.finish_reason === 'length' };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let acc = '';
  let finish = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const piece = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? '';
        if (j?.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
        if (piece) { acc += piece; onDelta(acc); }
      } catch { /* partial line */ }
    }
  }
  if (!acc.trim()) throw new ProviderError('provider', 200, 'empty stream');
  return { text: acc, model, truncated: finish === 'length' };
}

/* --------------------------------- Gemini -------------------------------- */
async function callGemini({ key, model, base, systemText, messages, maxTokens, temperature, timeoutMs, signal, onDelta }) {
  const url = `${String(base).replace(/\/$/, '')}/models/${encodeURIComponent(model)}:${onDelta ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${encodeURIComponent(key)}`;
  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        ...(m.content ? [{ text: m.content }] : []),
        ...(Array.isArray(m.images) ? m.images.map((im) => ({ inline_data: { mime_type: im.mime || 'image/jpeg', data: im.data } })) : []),
      ],
    })),
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: anySignal(signal, timeoutMs) });
  if (!res.ok) {
    const msg = await readError(res);
    throw new ProviderError(classify(res.status, msg), res.status, msg);
  }
  if (!onDelta || !res.body) {
    const data = await res.json().catch(() => ({}));
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) throw new ProviderError('provider', res.status, 'empty response');
    return { text, model, truncated: data?.candidates?.[0]?.finishReason === 'MAX_TOKENS' };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let acc = '';
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const cand = j?.candidates?.[0];
        const piece = (cand?.content?.parts || []).map((p) => p.text || '').join('');
        if (cand?.finishReason === 'MAX_TOKENS') truncated = true;
        if (piece) { acc += piece; onDelta(acc); }
      } catch { /* partial line */ }
    }
  }
  if (!acc.trim()) throw new ProviderError('provider', 200, 'empty stream');
  return { text: acc, model, truncated };
}

/* -------------------------------- Anthropic ------------------------------- */
async function callAnthropic({ key, model, base, systemText, messages, maxTokens, temperature, timeoutMs, signal, onDelta }) {
  const url = String(base).replace(/\/$/, '') + '/messages';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system: systemText, messages, max_tokens: maxTokens, temperature, stream: Boolean(onDelta) }),
    signal: anySignal(signal, timeoutMs),
  });
  if (!res.ok) {
    const msg = await readError(res);
    throw new ProviderError(classify(res.status, msg), res.status, msg);
  }
  if (!onDelta || !res.body) {
    const data = await res.json().catch(() => ({}));
    const text = (data?.content || []).map((c) => c.text || '').join('');
    if (!text) throw new ProviderError('provider', res.status, 'empty response');
    return { text, model, truncated: data?.stop_reason === 'max_tokens' };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let acc = '';
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        if (j.type === 'content_block_delta' && j.delta?.text) { acc += j.delta.text; onDelta(acc); }
        if (j.type === 'message_delta' && j.delta?.stop_reason === 'max_tokens') truncated = true;
      } catch { /* partial */ }
    }
  }
  if (!acc.trim()) throw new ProviderError('provider', 200, 'empty stream');
  return { text: acc, model, truncated };
}

class ProviderError extends Error {
  constructor(kind, status, detail) { super(kind + ' ' + status + ' ' + detail); this.kind = kind; this.status = status; this.detail = detail; }
}

function anySignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : null;
  if (!signal) return timeout || undefined;
  if (!timeout) return signal;
  return AbortSignal.any ? AbortSignal.any([signal, timeout]) : timeout;
}

/* ------------------------------ public chat ------------------------------- */
/**
 * Ask the best configured provider, with a real fallback chain.
 * @returns {Promise<{text:string, provider:string, model:string, truncated:boolean, latency:number}>}
 */
export async function studioChat({
  ownerId = null,
  instructions = '',
  messages = [],
  maxTokens = 8000,
  temperature = 0.25,
  timeoutMs = 100_000,
  budgetMs = 115_000,
  signal = null,
  onDelta = null,
  preferProvider = null,
  model = null,
}) {
  const started = Date.now();
  const keys = await resolveKeys(ownerId);
  if (!keys.length) {
    throw new StudioError(503, 'ai_not_configured',
      'no model provider is configured — add a key in Studio settings or set OPENAI_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY / ANTHROPIC_API_KEY on the server');
  }
  // preferred provider first, then the rest in a stable order
  keys.sort((a, b) => (a.def.id === preferProvider ? -1 : b.def.id === preferProvider ? 1 : 0));
  const failures = [];

  for (const { def, key } of keys) {
    if (Date.now() - started > budgetMs) break;
    const models = model && def.id === preferProvider ? [model] : def.models();
    for (const m of models) {
      if (Date.now() - started > budgetMs) break;
      if (isParked(def.id + '|' + m)) { failures.push(def.id + ':' + m + ':parked'); continue; }
      const remaining = Math.max(6000, Math.min(timeoutMs, budgetMs - (Date.now() - started)));
      try {
        const args = {
          key, model: m, base: def.base(), messages: messagesForProvider(messages, def.kind),
          systemText: instructions,
          maxTokens, temperature,
          timeoutMs: remaining, signal, onDelta,
        };
        const out = def.kind === 'gemini' ? await callGemini(args)
          : def.kind === 'anthropic' ? await callAnthropic(args)
            : await callOpenAICompatible({ ...args, def });
        return { ...out, provider: def.id, providerLabel: def.label, latency: Date.now() - started };
      } catch (e) {
        const kind = e.kind || (e.name === 'TimeoutError' ? 'timeout' : e.name === 'AbortError' ? 'aborted' : 'network');
        failures.push(`${def.id}:${m}:${kind}${e.status ? ':' + e.status : ''}${e.detail ? ': ' + e.detail : ''}`);
        if (kind === 'model' || kind === 'provider') { park(def.id + '|' + m, 60_000); continue; } // try the next model
        if (kind === 'rate_limited') { park(def.id + '|' + m, 90_000); break; }                    // next provider
        if (kind === 'auth' || kind === 'billing') { park(def.id + '|' + m, 600_000); break; }      // dead key
        break;                                                                                       // network: next provider
      }
    }
  }

  const detail = failures.join(' | ').slice(0, 800);
  const kinds = failures.map((f) => f.split(':')[2] || '');
  const code = kinds.includes('auth') ? 'ai_key_invalid'
    : kinds.includes('rate_limited') ? 'ai_rate_limited'
      : kinds.includes('aborted') ? 'ai_aborted'
        : 'ai_unreachable';
  throw new StudioError(502, code, detail || 'every provider failed');
}

/** Real connectivity probe used by the settings panel. */
export async function testProvider({ ownerId, providerId, key, model }) {
  const def = providerMeta(providerId);
  if (!def) throw new StudioError(400, 'unknown_provider');
  const keys = await resolveKeys(ownerId);
  const found = keys.find((k) => k.def.id === providerId);
  const useKey = key ? String(key).trim() : found?.key || '';
  if (!useKey && !def.keyless) throw new StudioError(400, 'key_required', 'pass a key to test this provider');
  const chosenModel = model || def.models()[0];
  const t0 = Date.now();
  const args = {
    key: useKey, model: chosenModel, base: def.base(),
    messages: [{ role: 'user', content: 'Reply with exactly: NEXORA_STUDIO_OK' }],
    systemText: 'You are a health check. Answer in five words or fewer.',
    maxTokens: 24, temperature: 0, timeoutMs: 20_000, signal: null, onDelta: null,
  };
  try {
    const out = def.kind === 'gemini' ? await callGemini(args)
      : def.kind === 'anthropic' ? await callAnthropic(args)
        : await callOpenAICompatible({ ...args, def });
    return { ok: true, provider: providerId, model: out.model, latencyMs: Date.now() - t0, reply: out.text.trim().slice(0, 120) };
  } catch (e) {
    return { ok: false, provider: providerId, model: chosenModel, latencyMs: Date.now() - t0, kind: e.kind || 'network', detail: String(e.detail || e.message || '').slice(0, 240) };
  }
}

/** Which provider will be used first — shown in the UI before a run. */
export async function primaryProvider(ownerId) {
  try {
    const keys = await resolveKeys(ownerId);
    if (!keys.length) return null;
    return { id: keys[0].def.id, label: keys[0].def.label, source: keys[0].source, model: keys[0].def.models()[0] };
  } catch { return null; }
}

/* ------------------------- secret helpers for integrations ---------------- */
export const encryptSecret = encrypt;
export const decryptSecret = decrypt;

/** Store a non-AI integration token (GitHub, Vercel, Google) in the same vault. */
export async function putIntegrationSecret(ownerId, name, value, extraMeta = {}) {
  const now = nowIso();
  const metaObj = { ...(extraMeta && typeof extraMeta === 'object' ? extraMeta : {}), last4: String(value).slice(-4) };
  const existing = await studioOne('select id from studio_keys where owner_id=$1 and provider=$2', [String(ownerId), name]);
  if (existing) {
    await studioQuery('update studio_keys set secret=$3, meta=$4, updated_at=$5 where id=$1 and owner_id=$2',
      [Number(existing.id), String(ownerId), encrypt(String(value)), JSON.stringify(metaObj), now]);
  } else {
    await studioQuery('insert into studio_keys (owner_id, provider, secret, meta, created_at, updated_at) values ($1,$2,$3,$4,$5,$5)',
      [String(ownerId), name, encrypt(String(value)), JSON.stringify(metaObj), now]);
  }
  return { saved: true, last4: String(value).slice(-4), method: metaObj.method || 'token' };
}

export async function getIntegrationSecret(ownerId, name) {
  const row = await studioOne('select secret, meta from studio_keys where owner_id=$1 and provider=$2', [String(ownerId), name]);
  if (!row) return null;
  const key = decrypt(row.secret);
  if (!key) return null;
  return { key, meta: safeJson(row.meta) };
}

export async function removeIntegrationSecret(ownerId, name) {
  await studioQuery('delete from studio_keys where owner_id=$1 and provider=$2', [String(ownerId), name]);
  return { removed: true };
}
