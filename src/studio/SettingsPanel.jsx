/* ============================================================================
   NEXORA — Account, Models, Integrations (OAuth + Token) & Runtime Settings
   ============================================================================ */

import { useState } from 'react';
import { setToken } from '../api.js';
import { useStudio } from './state.jsx';
import {
  IconX, IconCheck, IconGitHub, IconVercel, IconDrive, IconDoc,
  IconSun, IconMoon, IconLogout, IconRefresh, IconSpark,
} from './icons.jsx';

function ProviderRow({ p, active, onSelect, onSave, onRemove, onTest }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const test = async () => {
    setBusy(true);
    setResult(null);
    try { setResult(await onTest(p.id, undefined, p.defaultModel || p.models?.[0])); }
    catch (e) { setResult({ ok: false, error: e.detail || e.code }); }
    finally { setBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = await onSave(p.id, key.trim());
      setResult(r.test);
      if (r.test?.ok) { setKey(''); setOpen(false); }
    } catch (err) {
      setResult({ ok: false, error: err.detail || err.code });
    } finally {
      setBusy(false);
    }
  };

  const latency = result?.latency ?? result?.latencyMs;

  return (
    <div className={`nxs-provider${active ? ' active' : ''}`}>
      <div className="nxs-provider-main">
        <span className={`nxs-status-dot ${p.configured ? 'on' : ''}`} />
        <div className="nxs-provider-info">
          <div className="nxs-provider-title">
            <b>{p.label}</b>
            {(p.free || p.keyless) && <span className="nxs-tag">free</span>}
            {p.vision && <span className="nxs-tag">vision</span>}
            {active && <span className="nxs-status-pill ok">Selected</span>}
          </div>
          <small>
            {(p.models || []).slice(0, 3).join(' · ')}
            {p.source === 'account' ? ' · your encrypted key' : p.source === 'server' ? ' · server key' : ''}
            {p.last4 ? ` (••••${p.last4})` : ''}
          </small>
        </div>
        <div className="nxs-provider-acts">
          {p.configured && !active && (
            <button type="button" className="nxs-mini-btn primary" onClick={() => onSelect(p)}>
              Use
            </button>
          )}
          {p.configured && (
            <button type="button" className="nxs-mini-btn" onClick={test} disabled={busy}>
              {busy ? '…' : 'Test'}
            </button>
          )}
          {!p.free && !p.keyless && (
            <button type="button" className="nxs-mini-btn" onClick={() => setOpen((v) => !v)}>
              {open ? 'Cancel' : p.configured ? 'Key' : 'Add Key'}
            </button>
          )}
          {p.source === 'account' && (
            <button type="button" className="nxs-mini-btn danger" onClick={() => onRemove(p.id)}>
              Remove
            </button>
          )}
        </div>
      </div>

      {open && (
        <form className="nxs-key-form" onSubmit={save}>
          <input
            className="nxs-input"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`Paste ${p.label} API key...`}
            spellCheck={false}
          />
          <button type="submit" className="nxs-btn sm primary" disabled={busy || key.trim().length < 8}>
            {busy ? 'Verifying…' : 'Save & Verify'}
          </button>
        </form>
      )}

      {result && (
        <div className={`nxs-probe-msg ${result.ok ? 'ok' : 'err'}`}>
          {result.ok
            ? `Verified · ${result.model || p.label}${latency ? ` (${latency}ms)` : ''}`
            : `Failed · ${result.error || result.detail || result.kind || 'no response'}`}
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const {
    settingsOpen, setSettingsOpen, settingsTab, setSettingsTab,
    session, boot, theme, setTheme,
    modelPref, setModelPref,
    saveKey, removeKey, testModel,
    accounts, loadAccounts,
    connectIntegration, connectOAuth, disconnectIntegration,
    openDocsModal, notify,
  } = useStudio();

  const [tokens, setTokens] = useState({ github: '', vercel: '', google: '' });
  const [busy, setBusy] = useState(null);

  if (!settingsOpen) return null;

  const user = session?.user;
  const providers = session?.ai?.providers || [];
  const runtime = session?.runtime;
  const storage = session?.storage;
  const oauth = session?.oauth || {};

  const handleConnectToken = async (provider) => {
    const val = String(tokens[provider] || '').trim();
    if (val.length < 10) return;
    setBusy(provider);
    try {
      await connectIntegration(provider, val);
      setTokens((t) => ({ ...t, [provider]: '' }));
      notify(`Connected ${provider}`, 'ok');
    } catch (e) {
      notify(`${provider}: ${e.detail || e.code}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleOAuth = async (provider) => {
    setBusy(`oauth:${provider}`);
    try {
      await connectOAuth(provider);
    } catch (e) {
      notify(e.detail || e.code || 'OAuth could not start', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    try { localStorage.removeItem('nx_me'); } catch { /* ignore */ }
    setSettingsOpen(false);
    boot();
  };

  const integrationCards = [
    {
      id: 'github',
      title: 'GitHub',
      icon: <IconGitHub size={16} />,
      desc: 'Connect repositories, switch and create branches, read & commit files, and open pull requests.',
      placeholder: 'GitHub Personal Access Token (ghp_... with repo scope)',
      status: accounts?.github || session?.integrations?.github || { connected: false },
      who: accounts?.github?.login ? `@${accounts.github.login}` : '',
      oauthCfg: oauth.github,
    },
    {
      id: 'google',
      title: 'Google Drive & Google Docs',
      icon: <span className="nxs-dual-ico"><IconDrive size={15} /><IconDoc size={15} /></span>,
      desc: 'Browse and manage Google Drive files, read, create & edit real Google Docs, and export projects.',
      placeholder: 'Google OAuth Access Token (drive & documents scopes)',
      status: accounts?.google || { connected: false },
      who: accounts?.google?.email || accounts?.google?.name || '',
      oauthCfg: oauth.google,
      extraAction: accounts?.google?.connected ? () => { setSettingsOpen(false); openDocsModal({ mode: 'docs' }); } : null,
      extraLabel: 'Open Docs & Drive',
    },
    {
      id: 'vercel',
      title: 'Vercel',
      icon: <IconVercel size={14} />,
      desc: 'Deploy web projects to production or preview URLs and monitor real-time deployment status.',
      placeholder: 'Vercel Access Token (vercel.com/account/tokens)',
      status: accounts?.vercel || session?.integrations?.vercel || { connected: false },
      who: accounts?.vercel?.username || '',
      oauthCfg: oauth.vercel,
    },
  ];

  return (
    <div
      className="nxs-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={() => setSettingsOpen(false)}
    >
      <div className="nxs-modal wide" onClick={(e) => e.stopPropagation()}>
        <header className="nxs-modal-head">
          <h2 className="nxs-serif">Settings</h2>
          <button type="button" className="nxs-icon-btn" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
            <IconX size={17} />
          </button>
        </header>

        <div className="nxs-modal-tabs" role="tablist">
          {[
            ['account', 'Account'],
            ['integrations', 'Integrations'],
            ['models', 'Models'],
            ['runtime', 'Runtime'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={settingsTab === id}
              className={`nxs-modal-tab${settingsTab === id ? ' active' : ''}`}
              onClick={() => setSettingsTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="nxs-modal-body">
          {/* =========================== ACCOUNT TAB ========================= */}
          {settingsTab === 'account' && (
            <div className="nxs-settings-stack">
              <div className="nxs-card">
                <div className="nxs-account-card">
                  <div className="nxs-account-avatar">
                    {user?.avatarUrl
                      ? <img src={user.avatarUrl} alt="" />
                      : String(user?.fullName || user?.username || 'N').charAt(0).toUpperCase()}
                  </div>
                  <div className="nxs-account-meta">
                    <strong>{user?.fullName || user?.username || 'NEXORA User'}</strong>
                    <span>@{user?.username || 'user'}{session?.dev ? ' · Local Studio Workspace' : ''}</span>
                  </div>
                  {!session?.dev && (
                    <button type="button" className="nxs-btn sm" onClick={handleSignOut}>
                      <IconLogout size={13} /> Sign out
                    </button>
                  )}
                </div>
              </div>

              <div className="nxs-card">
                <h4>Appearance</h4>
                <p>Choose NEXORA’s signature warm cream editorial canvas or low-light dark theme.</p>
                <div className="nxs-theme-switch">
                  <button
                    type="button"
                    className={`nxs-theme-opt${theme === 'cream' ? ' active' : ''}`}
                    onClick={() => setTheme('cream')}
                  >
                    <IconSun size={15} />
                    <span>Warm Cream</span>
                    {theme === 'cream' && <IconCheck size={14} />}
                  </button>
                  <button
                    type="button"
                    className={`nxs-theme-opt${theme === 'dark' ? ' active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <IconMoon size={15} />
                    <span>Warm Dark</span>
                    {theme === 'dark' && <IconCheck size={14} />}
                  </button>
                </div>
              </div>

              <div className="nxs-card">
                <h4><IconSpark size={14} /> NEXORA Classic Assistant</h4>
                <p>Switch to the classic NEXORA multi-tool assistant (voice, translation, image prompts) anytime.</p>
                <button
                  type="button"
                  className="nxs-btn sm"
                  onClick={() => {
                    setSettingsOpen(false);
                    window.dispatchEvent(new Event('nxs-open-chat'));
                  }}
                >
                  Open Classic Assistant
                </button>
              </div>
            </div>
          )}

          {/* ======================== INTEGRATIONS TAB ======================= */}
          {settingsTab === 'integrations' && (
            <div className="nxs-settings-stack">
              {integrationCards.map((c) => {
                const isConn = Boolean(c.status?.connected);
                const oauthOn = Boolean(c.oauthCfg?.configured);
                return (
                  <div key={c.id} className="nxs-card">
                    <div className="nxs-card-head">
                      <h4>{c.icon} {c.title}</h4>
                      <span className={`nxs-status-pill ${isConn ? 'ok' : 'off'}`}>
                        {isConn ? `Connected${c.who ? ` · ${c.who}` : ''}` : 'Not connected'}
                      </span>
                    </div>
                    <p>{c.desc}</p>

                    {isConn ? (
                      <div className="nxs-row-gap wrap">
                        {c.extraAction && (
                          <button type="button" className="nxs-btn primary sm" onClick={c.extraAction}>
                            {c.extraLabel}
                          </button>
                        )}
                        <button
                          type="button"
                          className="nxs-btn sm"
                          onClick={() => loadAccounts()
                            .then(() => notify(`${c.title} verified`, 'ok'))
                            .catch((e) => notify(e.detail || e.code, 'error'))}
                        >
                          <IconRefresh size={12} /> Verify
                        </button>
                        {c.status?.source !== 'server' && (
                          <button type="button" className="nxs-btn sm ghost" onClick={() => disconnectIntegration(c.id)}>
                            Disconnect
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="nxs-connect-box">
                        {oauthOn && (
                          <button
                            type="button"
                            className="nxs-btn primary sm"
                            disabled={busy === `oauth:${c.id}`}
                            onClick={() => handleOAuth(c.id)}
                          >
                            {busy === `oauth:${c.id}` ? 'Opening OAuth…' : `Sign in with ${c.title} (OAuth)`}
                          </button>
                        )}
                        <form
                          className="nxs-key-form"
                          onSubmit={(e) => { e.preventDefault(); handleConnectToken(c.id); }}
                        >
                          <input
                            className="nxs-input"
                            type="password"
                            value={tokens[c.id] || ''}
                            onChange={(e) => setTokens((t) => ({ ...t, [c.id]: e.target.value }))}
                            placeholder={c.placeholder}
                            spellCheck={false}
                          />
                          <button
                            type="submit"
                            className={`nxs-btn sm${oauthOn ? '' : ' primary'}`}
                            disabled={busy === c.id || (tokens[c.id] || '').trim().length < 10}
                          >
                            {busy === c.id ? 'Checking…' : 'Connect'}
                          </button>
                        </form>
                        {!oauthOn && c.oauthCfg?.callbackUrl && (
                          <details className="nxs-oauth-hint">
                            <summary>Configure one-click OAuth app</summary>
                            <div>
                              Set <code className="mono">{c.oauthCfg.envHint}</code> on the server with callback URL{' '}
                              <code className="mono">{c.oauthCfg.callbackUrl}</code>.
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="nxs-footnote">
                Every OAuth token and API key is verified against the real provider API, encrypted with AES-256-GCM at rest, and never returned to the browser.
              </p>
            </div>
          )}

          {/* ============================ MODELS TAB ========================= */}
          {settingsTab === 'models' && (
            <div className="nxs-settings-stack">
              <div className="nxs-models-intro">
                <p>
                  Connect API keys for your preferred AI models. Keys are encrypted per account and verified with a live probe.
                </p>
                {modelPref?.provider && (
                  <button
                    type="button"
                    className="nxs-mini-btn"
                    onClick={() => { setModelPref({ provider: '', model: '' }); notify('Using automatic model selection'); }}
                  >
                    Auto-select
                  </button>
                )}
              </div>
              {providers.map((p) => (
                <ProviderRow
                  key={p.id}
                  p={p}
                  active={modelPref?.provider === p.id}
                  onSelect={(chosen) => {
                    setModelPref({ provider: chosen.id, model: chosen.defaultModel || chosen.models?.[0] || '' });
                    notify(`Selected ${chosen.label}`, 'ok');
                  }}
                  onSave={saveKey}
                  onRemove={removeKey}
                  onTest={testModel}
                />
              ))}
            </div>
          )}

          {/* =========================== RUNTIME TAB ========================= */}
          {settingsTab === 'runtime' && (
            <div className="nxs-settings-stack">
              <div className="nxs-card">
                <div className="nxs-card-head">
                  <h4>Code Execution Sandbox</h4>
                  <span className={`nxs-status-pill ${runtime?.ready ? 'ok' : 'off'}`}>
                    {runtime?.engine || 'preview-only'}
                  </span>
                </div>
                <p>{runtime?.note || 'In-browser esbuild bundler handles instant React/HTML/CSS previews.'}</p>
                <div className="nxs-result mono">
                  Engine: {runtime?.engine || 'none'} · Dev server: {runtime?.canDevServer ? 'enabled' : 'browser preview'}
                  {runtime?.workdir ? ` · ${runtime.workdir}` : ''}
                </div>
              </div>

              <div className="nxs-card">
                <div className="nxs-card-head">
                  <h4>Database Storage</h4>
                  <span className={`nxs-status-pill ${storage?.ok ? 'ok' : 'err'}`}>
                    {storage?.ok ? 'Connected' : 'Error'}
                  </span>
                </div>
                <p>All conversations, projects, archived chats, revisions, deployments, and model metrics persist server-side.</p>
                <div className="nxs-result mono">
                  {storage?.label || 'Storage'}{storage?.hint ? ` — ${storage.hint}` : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
