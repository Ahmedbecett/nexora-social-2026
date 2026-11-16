/* ============================================================================
   NEXORA Studio — OAuth 2.0 integration flows (GitHub, Google Drive/Docs, Vercel)
   ----------------------------------------------------------------------------
   Real OAuth 2.0 authorization + code exchange + token refresh, paired with
   direct access-token storage so every integration works whether the deployment
   configures OAuth app client IDs or the user pastes a personal token.
   ============================================================================ */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { StudioError } from './db.js';
import { putIntegrationSecret, getIntegrationSecret } from './ai.js';

const STATE_TTL_MS = 15 * 60 * 1000;

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

function stateSecret() {
  return process.env.STUDIO_SECRET || process.env.JWT_SECRET || process.env.NEXORA_SECRET || 'nexora-studio-local';
}

function b64uEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function b64uDecode(str) {
  return Buffer.from(String(str || ''), 'base64url').toString('utf8');
}

function signPayload(encoded) {
  return createHmac('sha256', 'nexora-oauth:' + stateSecret()).update(encoded).digest('base64url');
}

export function createOAuthState({ ownerId, provider, redirectUri, returnOrigin = '' }) {
  const payload = b64uEncode(JSON.stringify({
    ownerId: String(ownerId),
    provider: String(provider),
    redirectUri: String(redirectUri),
    returnOrigin: String(returnOrigin || '').slice(0, 200),
    nonce: randomBytes(12).toString('hex'),
    iat: Date.now(),
  }));
  return `${payload}.${signPayload(payload)}`;
}

export function verifyOAuthState(state, expectedProvider) {
  const raw = String(state || '');
  const dot = raw.indexOf('.');
  if (dot < 1) throw new StudioError(400, 'oauth_state_invalid', 'Invalid OAuth state parameter.');
  const payload = raw.slice(0, dot);
  const givenSig = raw.slice(dot + 1);
  const expectedSig = signPayload(payload);
  const a = Buffer.from(givenSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new StudioError(400, 'oauth_state_invalid', 'OAuth state signature check failed.');
  }
  let parsed;
  try { parsed = JSON.parse(b64uDecode(payload)); } catch {
    throw new StudioError(400, 'oauth_state_invalid', 'Malformed OAuth state payload.');
  }
  if (!parsed?.ownerId || !parsed?.provider || !parsed?.iat) {
    throw new StudioError(400, 'oauth_state_invalid', 'Incomplete OAuth state.');
  }
  if (expectedProvider && parsed.provider !== expectedProvider) {
    throw new StudioError(400, 'oauth_state_mismatch', 'OAuth provider mismatch.');
  }
  if (Date.now() - Number(parsed.iat) > STATE_TTL_MS) {
    throw new StudioError(400, 'oauth_state_expired', 'The OAuth sign-in window expired — please try again.');
  }
  return parsed;
}

function oauthConfig(provider) {
  if (provider === 'github') {
    const clientId = process.env.GITHUB_STUDIO_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '';
    const clientSecret = process.env.GITHUB_STUDIO_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
    return {
      provider: 'github',
      label: 'GitHub',
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      configured: Boolean(clientId.trim() && clientSecret.trim()),
      scopes: ['repo', 'read:user'],
      envHint: 'GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET',
    };
  }
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_STUDIO_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_STUDIO_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    return {
      provider: 'google',
      label: 'Google Drive & Docs',
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      configured: Boolean(clientId.trim() && clientSecret.trim()),
      scopes: GOOGLE_SCOPES.split(' '),
      envHint: 'GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET',
    };
  }
  if (provider === 'vercel') {
    const clientId = process.env.VERCEL_STUDIO_CLIENT_ID || process.env.VERCEL_CLIENT_ID || '';
    const clientSecret = process.env.VERCEL_STUDIO_CLIENT_SECRET || process.env.VERCEL_CLIENT_SECRET || '';
    const slug = (process.env.VERCEL_INTEGRATION_SLUG || '').trim();
    return {
      provider: 'vercel',
      label: 'Vercel',
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      slug,
      configured: Boolean(clientId.trim() && clientSecret.trim()),
      scopes: ['deployments', 'projects', 'user'],
      envHint: 'VERCEL_CLIENT_ID & VERCEL_CLIENT_SECRET',
    };
  }
  throw new StudioError(400, 'unknown_provider', `Unsupported OAuth provider: ${provider}`);
}

export function resolveBaseUrl(headers = {}, explicitOrigin = '') {
  const fromEnv = (process.env.STUDIO_OAUTH_BASE || '').trim().replace(/\/+$/, '');
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  if (explicitOrigin && /^https?:\/\/[^/\s]+$/i.test(explicitOrigin)) return explicitOrigin.replace(/\/+$/, '');
  const fwdHost = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
  const fwdProto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim()
    || (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fwdHost) ? 'http' : 'https');
  if (fwdHost) return `${fwdProto}://${fwdHost}`;
  return 'http://localhost:5173';
}

export function oauthProvidersStatus(headers = {}) {
  const base = resolveBaseUrl(headers);
  return ['github', 'google', 'vercel'].reduce((acc, id) => {
    const cfg = oauthConfig(id);
    acc[id] = {
      configured: cfg.configured,
      label: cfg.label,
      scopes: cfg.scopes,
      callbackUrl: `${base}/api/studio/oauth/${id}/callback`,
      envHint: cfg.envHint,
    };
    return acc;
  }, {});
}

export function startOAuth(ownerId, provider, { headers = {}, origin = '' } = {}) {
  const id = provider === 'docs' || provider === 'drive' ? 'google' : String(provider || '').toLowerCase();
  const cfg = oauthConfig(id);
  if (!cfg.configured) {
    throw new StudioError(
      400,
      'oauth_not_configured',
      `${cfg.label} OAuth client is not set on this server (${cfg.envHint}). Connect directly with an access token below, or set those environment variables.`,
    );
  }
  const base = resolveBaseUrl(headers, origin);
  const redirectUri = `${base}/api/studio/oauth/${id}/callback`;
  const returnOrigin = /^https?:\/\/[^/\s]+$/i.test(origin) ? origin : base;
  const state = createOAuthState({ ownerId, provider: id, redirectUri, returnOrigin });

  let url;
  if (id === 'github') {
    const u = new URL('https://github.com/login/oauth/authorize');
    u.searchParams.set('client_id', cfg.clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('scope', 'repo read:user');
    u.searchParams.set('state', state);
    u.searchParams.set('allow_signup', 'true');
    url = u.toString();
  } else if (id === 'google') {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.searchParams.set('client_id', cfg.clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', GOOGLE_SCOPES);
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('include_granted_scopes', 'true');
    u.searchParams.set('prompt', 'consent');
    u.searchParams.set('state', state);
    url = u.toString();
  } else if (id === 'vercel') {
    if (cfg.slug) {
      const u = new URL(`https://vercel.com/integrations/${encodeURIComponent(cfg.slug)}/new`);
      u.searchParams.set('state', state);
      url = u.toString();
    } else {
      const u = new URL('https://vercel.com/oauth/authorize');
      u.searchParams.set('client_id', cfg.clientId);
      u.searchParams.set('redirect_uri', redirectUri);
      u.searchParams.set('state', state);
      url = u.toString();
    }
  }
  return { provider: id, url, redirectUri };
}

async function exchangeCode(provider, code, redirectUri) {
  const cfg = oauthConfig(provider);
  if (!cfg.configured) throw new StudioError(400, 'oauth_not_configured', `${cfg.label} OAuth is not configured.`);

  if (provider === 'github') {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'NEXORA-Studio/1.0' },
      body: JSON.stringify({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) {
      throw new StudioError(400, 'oauth_exchange_failed', data.error_description || data.error || `GitHub HTTP ${r.status}`);
    }
    const meRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${data.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'NEXORA-Studio/1.0' },
    });
    const me = await meRes.json().catch(() => ({}));
    return {
      secret: data.access_token,
      meta: { method: 'oauth', login: me.login || '', scope: data.scope || '' },
      account: me.login || 'GitHub',
    };
  }

  if (provider === 'google') {
    const body = new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) {
      throw new StudioError(400, 'oauth_exchange_failed', data.error_description || data.error || `Google HTTP ${r.status}`);
    }
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const about = await aboutRes.json().catch(() => ({}));
    const email = about.user?.emailAddress || '';
    const expiresAt = data.expires_in ? Date.now() + (Number(data.expires_in) - 60) * 1000 : 0;
    const payload = data.refresh_token
      ? JSON.stringify({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt,
          scope: data.scope || GOOGLE_SCOPES,
        })
      : data.access_token;
    return {
      secret: payload,
      meta: { method: 'oauth', email, name: about.user?.displayName || '', scope: data.scope || GOOGLE_SCOPES, hasRefresh: Boolean(data.refresh_token) },
      account: email || about.user?.displayName || 'Google',
    };
  }

  if (provider === 'vercel') {
    const body = new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: redirectUri,
    });
    const r = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) {
      throw new StudioError(400, 'oauth_exchange_failed', data.error_description || data.error || `Vercel HTTP ${r.status}`);
    }
    const meRes = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const me = await meRes.json().catch(() => ({}));
    const username = me.user?.username || me.username || '';
    const secret = data.team_id
      ? JSON.stringify({ accessToken: data.access_token, teamId: data.team_id })
      : data.access_token;
    return {
      secret,
      meta: { method: 'oauth', username, teamId: data.team_id || '' },
      account: username || 'Vercel',
    };
  }

  throw new StudioError(400, 'unknown_provider');
}

/**
 * Unpack an encrypted credential that may be a plain token string or an OAuth
 * JSON bundle, automatically refreshing Google tokens when expired.
 */
export async function resolveGoogleAccessToken(ownerId) {
  const saved = ownerId ? await getIntegrationSecret(ownerId, 'google').catch(() => null) : null;
  if (!saved?.key) return null;
  const method = saved.meta?.method || 'account';
  const raw = String(saved.key).trim();
  if (!raw.startsWith('{')) return { token: raw, source: method === 'oauth' ? 'oauth' : 'account' };
  let cred;
  try { cred = JSON.parse(raw); } catch { return { token: raw, source: 'account' }; }
  if (!cred?.accessToken) return null;
  if (!cred.refreshToken || !cred.expiresAt || Date.now() < Number(cred.expiresAt)) {
    return { token: cred.accessToken, source: 'oauth' };
  }
  const cfg = oauthConfig('google');
  if (!cfg.configured) return { token: cred.accessToken, source: 'oauth' };
  try {
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cred.refreshToken,
      grant_type: 'refresh_token',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.access_token) {
      const updated = {
        ...cred,
        accessToken: data.access_token,
        expiresAt: data.expires_in ? Date.now() + (Number(data.expires_in) - 60) * 1000 : cred.expiresAt,
      };
      await putIntegrationSecret(ownerId, 'google', JSON.stringify(updated), saved.meta || {});
      return { token: updated.accessToken, source: 'oauth' };
    }
  } catch { /* fall through to existing token */ }
  return { token: cred.accessToken, source: 'oauth' };
}

export function unpackTokenBundle(raw) {
  const s = String(raw || '').trim();
  if (!s) return { token: '', teamId: '' };
  if (!s.startsWith('{')) return { token: s, teamId: '' };
  try {
    const parsed = JSON.parse(s);
    return { token: String(parsed.accessToken || parsed.token || ''), teamId: String(parsed.teamId || '') };
  } catch {
    return { token: s, teamId: '' };
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderCallbackHtml({ ok, provider, account = '', error = '', returnOrigin = '' }) {
  const safeOrigin = /^https?:\/\/[^/\s]+$/i.test(returnOrigin) ? returnOrigin : '/';
  const payload = JSON.stringify({ source: 'nexora-oauth', ok: Boolean(ok), provider, account, error });
  const targetOrigin = /^https?:\/\/[^/\s]+$/i.test(returnOrigin) ? JSON.stringify(returnOrigin) : '"*"';
  const title = ok ? 'Connected to NEXORA' : 'Connection failed';
  const body = ok
    ? `Connected ${escapeHtml(account || provider)} to NEXORA. This window will close automatically.`
    : escapeHtml(error || 'Authorization was cancelled or could not be completed.');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf9f5;color:#1a1915;font-family:system-ui,-apple-system,sans-serif;padding:24px;box-sizing:border-box}
  .card{max-width:420px;width:100%;background:#fff;border:1px solid #e5e1d8;border-radius:16px;padding:28px;text-align:center;box-shadow:0 4px 20px rgba(26,25,21,.06)}
  h1{font-family:Georgia,serif;font-weight:500;font-size:24px;margin:0 0 10px}
  p{font-size:14px;line-height:1.55;color:#57534e;margin:0 0 20px}
  a{display:inline-block;padding:10px 18px;border-radius:999px;background:#1a1915;color:#faf9f5;text-decoration:none;font-size:13px;font-weight:500}
  .err{color:#b91c1c}
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p class="${ok ? '' : 'err'}">${body}</p>
    <a href="${escapeHtml(safeOrigin)}">Return to NEXORA</a>
  </div>
  <script>
    (function(){
      var msg = ${payload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(msg, ${targetOrigin});
          if (msg.ok) setTimeout(function(){ window.close(); }, 500);
          return;
        }
      } catch (e) {}
      if (msg.ok && ${JSON.stringify(safeOrigin)} !== '/') {
        setTimeout(function(){ window.location.replace(${JSON.stringify(safeOrigin + '/?oauth=' + encodeURIComponent(provider) + '&status=ok')}); }, 700);
      }
    })();
  </script>
</body>
</html>`;
}

export async function completeOAuth(provider, query = {}) {
  const id = String(provider || '').toLowerCase();
  if (query.error) {
    return {
      __html: renderCallbackHtml({
        ok: false,
        provider: id,
        error: String(query.error_description || query.error).slice(0, 260),
      }),
      status: 400,
    };
  }
  const code = String(query.code || '').trim();
  if (!code) {
    return {
      __html: renderCallbackHtml({ ok: false, provider: id, error: 'Missing authorization code.' }),
      status: 400,
    };
  }
  try {
    const state = verifyOAuthState(query.state, id);
    const exchanged = await exchangeCode(id, code, state.redirectUri);
    await putIntegrationSecret(state.ownerId, id, exchanged.secret, exchanged.meta);
    return {
      __html: renderCallbackHtml({
        ok: true,
        provider: id,
        account: exchanged.account,
        returnOrigin: state.returnOrigin,
      }),
      status: 200,
    };
  } catch (e) {
    return {
      __html: renderCallbackHtml({
        ok: false,
        provider: id,
        error: e?.detail || e?.message || 'OAuth verification failed.',
      }),
      status: e?.status || 400,
    };
  }
}
