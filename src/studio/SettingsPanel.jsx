import { useState } from 'react';
import { useStudio } from './state.jsx';
import { IconX, IconCheck, IconPlug, IconGear, IconWarn, IconSpark } from './icons.jsx';

function ProviderRow({ p, onSave, onRemove, onTest }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const test = async () => {
    setBusy(true); setResult(null);
    try { setResult(await onTest(p.id, undefined, p.models?.[0])); }
    catch (e) { setResult({ ok: false, detail: e.detail || e.code }); }
    finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await onSave(p.id, key.trim());
      setResult(r.test);
      if (r.test?.ok) { setKey(''); setOpen(false); }
    } catch (e) { setResult({ ok: false, detail: e.detail || e.code }); }
    finally { setBusy(false); }
  };

  return (
    <div className="nxs-provider" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className={`nxs-dot ${p.configured ? 'ok' : ''}`} />
        <div className="info">
          <b>{p.label}{p.keyless && <span className="nxs-chip" style={{ marginInlineStart: 6 }}>free</span>}</b>
          <small>
            {(p.models || []).join(' · ')}
            {p.source === 'account' && ' · your key'}
            {p.source === 'server' && ' · server key'}
            {p.last4 && ` · ••••${p.last4}`}
          </small>
        </div>
        <button className="nxs-btn sm" onClick={() => setOpen((v) => !v)}>{open ? 'Cancel' : p.configured ? 'Replace key' : 'Add key'}</button>
        {p.configured && <button className="nxs-btn sm" onClick={test} disabled={busy}>{busy ? '…' : 'Test'}</button>}
        {p.source === 'account' && <button className="nxs-btn sm danger" onClick={() => onRemove(p.id)}>Remove</button>}
      </div>
      {open && (
        <div className="nxs-key-form">
          <input className="nxs-input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={`${p.label} API key`} spellCheck={false} />
          <button className="nxs-btn sm primary" onClick={save} disabled={busy || key.trim().length < 8}>{busy ? 'Checking…' : 'Save & test'}</button>
        </div>
      )}
      {result && (
        <div style={{ marginTop: 7, fontSize: 11.5, color: result.ok ? 'var(--green)' : 'var(--red)' }}>
          {result.ok
            ? `✓ ${result.provider} answered with ${result.model} in ${result.latencyMs} ms`
            : `✗ ${result.kind || 'failed'}: ${result.detail || 'no answer'}`}
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const {
    settingsOpen, setSettingsOpen, session, saveKey, removeKey, testModel,
    connectIntegration, disconnectIntegration, notify, accounts, loadAccounts,
  } = useStudio();
  const [tab, setTab] = useState('models');
  const [tokens, setTokens] = useState({ github: '', vercel: '' });
  const [busy, setBusy] = useState(null);

  if (!settingsOpen) return null;
  const providers = session?.ai?.providers || [];
  const runtime = session?.runtime;
  const storage = session?.storage;

  const connect = async (provider) => {
    setBusy(provider);
    try {
      await connectIntegration(provider, tokens[provider].trim());
      setTokens((t) => ({ ...t, [provider]: '' }));
      notify(`${provider} connected`);
    } catch (e) { notify(`${provider}: ${e.detail || e.code}`, 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div className="nxs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
      <div className="nxs-modal" role="dialog" aria-modal="true" aria-label="Studio settings">
        <div className="nxs-modal-head">
          <IconGear size={16} />
          <b>Studio settings</b>
          <button className="nxs-btn icon sm" onClick={() => setSettingsOpen(false)}><IconX size={14} /></button>
        </div>

        <div className="nxs-tabs" style={{ background: 'transparent', borderBottom: '1px solid var(--line)' }}>
          {[['models', 'Models'], ['integrations', 'Integrations'], ['runtime', 'Runtime']].map(([id, label]) => (
            <button key={id} className={`nxs-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="nxs-modal-body">
          {tab === 'models' && (
            <>
              <p className="nxs-muted" style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 0 }}>
                The Studio talks to the model provider you connect here. Server keys (set on the deployment)
                are used automatically; a key saved here belongs to your account only, encrypted at rest.
                Order is OpenAI → Anthropic → Gemini → OpenRouter → the other providers → the free
                fallback, and every failure is reported as it happens.
              </p>
              {providers.map((p) => (
                <ProviderRow key={p.id} p={p} onSave={saveKey} onRemove={removeKey} onTest={testModel} />
              ))}
              <div className="nxs-card" style={{ marginTop: 12 }}>
                <h4><IconSpark size={13} /> Custom gateway</h4>
                <p style={{ margin: 0 }}>
                  Point the Studio at any OpenAI-compatible server (Ollama, vLLM, LiteLLM) by setting
                  <code className="nxs-mono"> STUDIO_AI_BASE_URL</code>,
                  <code className="nxs-mono"> STUDIO_AI_KEY</code> and
                  <code className="nxs-mono"> STUDIO_AI_MODEL</code> on the deployment.
                </p>
              </div>
            </>
          )}

          {tab === 'integrations' && (
            <>
              {['github', 'vercel'].map((provider) => {
                const st = accounts[provider] || session?.integrations?.[provider] || { connected: false };
                return (
                  <div className="nxs-card" key={provider}>
                    <h4>
                      <IconPlug size={13} /> {provider === 'github' ? 'GitHub' : 'Vercel'}
                      <span className={`nxs-chip ${st.connected ? 'ok' : 'warn'}`} style={{ marginInlineStart: 'auto' }}>
                        {st.connected
                          ? `connected · ${st.login || st.username || 'account'}${st.source === 'server' ? ' (deployment key)' : ''}`
                          : (st.error || 'not connected')}
                      </span>
                    </h4>
                    <p>
                      {provider === 'github'
                        ? 'Used to create repositories and push commits from the Publish tab.'
                        : 'Used to deploy the project and return a live URL.'}
                    </p>
                    {st.connected ? (
                      <div className="row">
                        <button className="nxs-btn sm" onClick={() => loadAccounts().then(() => notify('Connection verified', 'ok')).catch((e) => notify(e.detail || e.code, 'error'))}>
                          Verify now
                        </button>
                        <button className="nxs-btn ghost sm" onClick={() => disconnectIntegration(provider)}>Disconnect</button>
                        {provider === 'github' && Array.isArray(st.repos) && (
                          <span className="nxs-faint" style={{ fontSize: 11 }}>{st.repos.length} recent repos reachable</span>
                        )}
                        {provider === 'vercel' && Array.isArray(st.projects) && (
                          <span className="nxs-faint" style={{ fontSize: 11 }}>{st.projects.length} projects reachable</span>
                        )}
                      </div>
                    ) : (
                      <div className="nxs-key-form">
                        <input
                          className="nxs-input"
                          type="password"
                          value={tokens[provider]}
                          onChange={(e) => setTokens((t) => ({ ...t, [provider]: e.target.value }))}
                          placeholder={provider === 'github' ? 'GitHub token (repo scope)' : 'Vercel access token'}
                          spellCheck={false}
                        />
                        <button
                          className="nxs-btn sm primary"
                          disabled={busy === provider || tokens[provider].trim().length < 10}
                          onClick={() => connect(provider)}
                        >
                          {busy === provider ? 'Checking…' : 'Connect'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="nxs-faint" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                Tokens are verified with a real API call before they are stored, and encrypted with the
                deployment secret. They are never sent back to the browser.
              </p>
            </>
          )}

          {tab === 'runtime' && (
            <>
              <div className="nxs-card">
                <h4><IconCheck size={13} /> Execution</h4>
                <p style={{ marginBottom: 6 }}>{runtime?.note || 'Runtime information unavailable.'}</p>
                <div className="nxs-result">
                  engine: {runtime?.engine} · dev servers: {runtime?.canDevServer ? 'yes' : 'no'}
                  {runtime?.workdir && <><br />workdir: {runtime.workdir}</>}
                </div>
              </div>
              <div className="nxs-card">
                <h4><IconCheck size={13} /> Storage</h4>
                <div className="nxs-result">
                  {storage?.label || 'unknown'} · {storage?.ok ? 'connected' : 'unavailable'}
                  {storage?.error && <><br />{storage.error}</>}
                </div>
                <p style={{ marginTop: 8, marginBottom: 0 }}>
                  Projects, chat history, revisions and runs are stored server-side and reload with the project.
                </p>
              </div>
              <div className="nxs-card">
                <h4><IconSpark size={13} /> NEXORA assistant</h4>
                <p style={{ marginBottom: 8 }}>The general NEXORA chat (writing, research, documents) is one click away.</p>
                <button className="nxs-btn sm" onClick={() => { setSettingsOpen(false); window.dispatchEvent(new Event('nxs-open-chat')); }}>
                  Open NEXORA Chat
                </button>
              </div>
              {session?.dev && (
                <div className="nxs-card" style={{ borderColor: 'rgba(251,191,36,.3)' }}>
                  <h4><IconWarn size={13} /> Local workspace</h4>
                  <p style={{ margin: 0 }}>
                    This is the local Studio server (<code className="nxs-mono">npm run studio</code>): a single-user
                    workspace with SQLite storage and the local executor. Sign in with a NEXORA account to use the
                    deployed instance instead.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="nxs-modal-foot">
          <button className="nxs-btn" onClick={() => setSettingsOpen(false)}>Done</button>
        </div>
      </div>
    </div>
  );
}
