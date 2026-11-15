import { useState } from 'react';
import { useStudio } from './state.jsx';
import { zipFiles } from './preview/bundler.js';
import {
  IconRocket, IconGit, IconDownload, IconHistory, IconPlug, IconExternal, IconCheck, IconRefresh,
} from './icons.jsx';

function TokenForm({ provider, onConnect, label, placeholder }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <div>
      <div className="nxs-key-form">
        <input
          className="nxs-input"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
        <button
          className="nxs-btn sm primary"
          disabled={busy || token.trim().length < 10}
          onClick={async () => {
            setBusy(true); setError(null);
            try { await onConnect(provider, token.trim()); setToken(''); }
            catch (e) { setError(e.detail || e.code || 'rejected'); }
            finally { setBusy(false); }
          }}
        >
          {busy ? 'Checking…' : `Connect ${label}`}
        </button>
      </div>
      {error && <div className="nxs-faint" style={{ color: 'var(--red)', marginTop: 6, fontSize: 11.5 }}>{error}</div>}
    </div>
  );
}

export default function DeployPanel() {
  const {
    project, files, deployments, revisions, session, deployVercel, pushGithub,
    connectIntegration, disconnectIntegration, restoreRevision, notify,
    accounts, loadAccounts, importRepo, pushBranch, followVercelProject,
  } = useStudio();
  const [verifying, setVerifying] = useState(null);
  const [branch, setBranch] = useState('');
  const [base, setBase] = useState('');
  const [asPr, setAsPr] = useState(true);
  const [busyRepo, setBusyRepo] = useState(null);
  const [vercelTarget, setVercelTarget] = useState('');      // '' = a new project
  const [vercelProbe, setVercelProbe] = useState(null);

  const openRepository = async (fullName) => {
    if (!fullName || busyRepo) return;
    setBusyRepo(fullName);
    try {
      const data = await importRepo({ repo: fullName });
      notify(`Opened ${data.repo.full} — ${data.repo.imported} files`, 'ok');
    } catch (e) {
      notify(`Import failed: ${e.detail || e.code}`, 'error');
    } finally {
      setBusyRepo(null);
    }
  };

  const commitAndPr = async () => {
    const target = (repo || '').trim() || (project?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!/^[\w.-]+\/[\w.-]+$/.test(target) && !github.repos?.length) {
      notify('Type the repository as owner/name', 'warn');
      return;
    }
    setBusyRepo('push');
    try {
      await pushBranch({ repo: target, branch: branch.trim(), base: base.trim(), pr: asPr });
      setBranch('');
    } catch (e) {
      notify(`Push failed: ${e.detail || e.code}`, 'error');
    } finally {
      setBusyRepo(null);
    }
  };
  const [repo, setRepo] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [lastVercel, setLastVercel] = useState(null);
  const [lastGit, setLastGit] = useState(null);

  const github = accounts.github || session?.integrations?.github || { connected: false };
  const vercel = accounts.vercel || session?.integrations?.vercel || { connected: false };
  const verify = async (provider) => {
    setVerifying(provider);
    try { await loadAccounts(); notify(`${provider} connection checked`, 'ok'); }
    catch (e) { notify(`${provider}: ${e.detail || e.code}`, 'error'); }
    finally { setVerifying(null); }
  };
  const fileCount = Object.keys(files || {}).length;

  const exportZip = () => {
    if (!fileCount) { notify('Nothing to export yet', 'warn'); return; }
    const blob = zipFiles(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(project?.name || 'nexora-project').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const deploy = async () => {
    setDeploying(true);
    const result = await deployVercel({ existingProjectId: vercelTarget || null });
    setDeploying(false);
    if (result) setLastVercel(result);
  };

  const followProject = async () => {
    const chosen = (vercel.projects || []).find((p) => p.id === vercelTarget);
    if (!chosen) { notify('Choose a Vercel project first', 'warn'); return; }
    setVercelProbe({ busy: true, name: chosen.name });
    const state = await followVercelProject({ id: chosen.id, name: chosen.name });
    setVercelProbe(state ? { ...state, busy: false } : null);
  };

  const push = async () => {
    setPushing(true);
    const result = await pushGithub({ repo: repo.trim() || undefined, isPrivate });
    setPushing(false);
    if (result) setLastGit(result);
  };

  return (
    <div className="nxs-scroll-pad" style={{ overflowY: 'auto' }}>
      <div className="nxs-card">
        <h4><IconRocket size={14} style={{ color: 'var(--violet-2)' }} /> Vercel
          <span className={`nxs-chip ${vercel.connected ? 'ok' : 'warn'}`} style={{ marginInlineStart: 'auto' }}>
            {vercel.connected ? `connected${vercel.username ? ` · ${vercel.username}` : ''}` : (vercel.error || 'not connected')}
          </span>
        </h4>
        <p>Ship the project to a real URL. Static files are served directly; React/Vite projects are built by Vercel.</p>
        {vercel.connected && (
          <div className="nxs-result" style={{ marginTop: 0 }}>
            <div>
              account: <b>{vercel.username || 'vercel'}</b>{vercel.source ? ` · key from ${vercel.source === 'server' ? 'this deployment' : 'your account'}` : ''}
              {vercel.team ? ` · team ${vercel.team}` : ''}
              <button className="nxs-btn ghost sm" style={{ marginInlineStart: 8 }} onClick={() => verify('vercel')} disabled={verifying === 'vercel'}>
                <IconRefresh size={10} /> {verifying === 'vercel' ? 'checking…' : 're-check'}
              </button>
            </div>
            {Array.isArray(vercel.projects) && vercel.projects.length > 0 && (
              <div className="nxs-git-branch" style={{ marginTop: 8 }}>
                <select
                  className="nxs-input"
                  aria-label="Vercel project"
                  value={vercelTarget}
                  onChange={(e) => { setVercelTarget(e.target.value); setVercelProbe(null); }}
                  style={{ flex: '1 1 170px' }}
                >
                  <option value="">deploy as a new project</option>
                  {vercel.projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button className="nxs-btn ghost sm" onClick={followProject} disabled={!vercelTarget || vercelProbe?.busy}>
                  <IconRefresh size={10} /> {vercelProbe?.busy ? 'following…' : 'Follow to READY'}
                </button>
              </div>
            )}
            {vercelProbe && !vercelProbe.busy && (
              <div className="nxs-result">
                {vercelProbe.name}: <b>{vercelProbe.state || 'unknown'}</b>
                {vercelProbe.url && <> · <a href={vercelProbe.url} target="_blank" rel="noreferrer">live <IconExternal size={10} /></a></>}
                {vercelProbe.inspectorUrl && <> · <a href={vercelProbe.inspectorUrl} target="_blank" rel="noreferrer">inspect</a></>}
              </div>
            )}
          </div>
        )}
        {vercel.connected ? (
          <>
            <div className="row">
              <button className="nxs-btn primary" onClick={deploy} disabled={deploying || !fileCount}>
                <IconRocket size={12} /> {deploying ? 'Deploying…' : (vercelTarget ? 'Deploy into that project' : 'Deploy to production')}
              </button>
              <button className="nxs-btn ghost sm" onClick={() => disconnectIntegration('vercel')}>Disconnect</button>
            </div>
            {lastVercel && (
              <div className="nxs-result">
                {lastVercel.url
                  ? <>live: <a href={lastVercel.url} target="_blank" rel="noreferrer">{lastVercel.url} <IconExternal size={10} /></a><br /></>
                  : null}
                state: {lastVercel.status || lastVercel.state || 'queued'} {lastVercel.inspectorUrl && <a href={lastVercel.inspectorUrl} target="_blank" rel="noreferrer">inspect</a>}
              </div>
            )}
          </>
        ) : (
          <TokenForm provider="vercel" onConnect={connectIntegration} label="Vercel" placeholder="Vercel access token (vercel.com/account/tokens)" />
        )}
      </div>

      <div className="nxs-card">
        <h4><IconGit size={14} style={{ color: 'var(--violet-2)' }} /> GitHub
          <span className={`nxs-chip ${github.connected ? 'ok' : 'warn'}`} style={{ marginInlineStart: 'auto' }}>
            {github.connected ? `connected · ${github.login}` : (github.error || 'not connected')}
          </span>
        </h4>
        <p>Create a repository and push every file as one commit, so the project lives in version control.</p>
        {github.connected && (
          <div className="nxs-result" style={{ marginTop: 0 }}>
            <div>
              account: <b>{github.login}</b>{github.source ? ` · key from ${github.source === 'server' ? 'this deployment' : 'your account'}` : ''}
              <button className="nxs-btn ghost sm" style={{ marginInlineStart: 8 }} onClick={() => verify('github')} disabled={verifying === 'github'}>
                <IconRefresh size={10} /> {verifying === 'github' ? 'checking…' : 're-check'}
              </button>
            </div>
            {Array.isArray(github.repos) && github.repos.length > 0 && (
              <div className="nxs-repo-list">
                <span className="nxs-faint" style={{ fontSize: 11 }}>
                  repositories you can really open, edit and commit to:
                </span>
                {github.repos.slice(0, 8).map((r) => (
                  <div key={r.name} className="nxs-repo-row">
                    <button
                      className="nxs-repo-pick"
                      title="Use this repository for the next push"
                      onClick={() => { setRepo(r.name); if (r.defaultBranch) setBase(r.defaultBranch); }}
                    >
                      <b>{r.name.split('/')[1]}</b>
                      <span className="nxs-chip">{r.private ? 'private' : 'public'}</span>
                    </button>
                    <button
                      className="nxs-btn sm"
                      onClick={() => openRepository(r.name)}
                      disabled={busyRepo === r.name}
                      title="Download its files into a new Studio project"
                    >
                      {busyRepo === r.name ? 'opening…' : 'Open'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {github.connected ? (
          <>
            <div className="row">
              <input
                className="nxs-input grow"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder={`repo name (default: ${(project?.name || 'nexora-app').toLowerCase().replace(/[^a-z0-9]+/g, '-')})`}
              />
              <label className="nxs-chip" style={{ height: 34, gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                private
              </label>
              <button className="nxs-btn primary" onClick={push} disabled={pushing || !fileCount}>
                <IconGit size={12} /> {pushing ? 'Pushing…' : 'Push'}
              </button>
              <button className="nxs-btn ghost sm" onClick={() => disconnectIntegration('github')}>Disconnect</button>
            </div>
            <div className="nxs-git-branch">
              <input className="nxs-input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch (blank = nexora/<time>)" />
              <input className="nxs-input" value={base} onChange={(e) => setBase(e.target.value)} placeholder="base branch (default branch)" />
              <label className="nxs-chip" style={{ height: 34, gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={asPr} onChange={(e) => setAsPr(e.target.checked)} />
                pull request
              </label>
              <button className="nxs-btn primary" onClick={commitAndPr} disabled={busyRepo === 'push' || !fileCount}>
                <IconGit size={12} /> {busyRepo === 'push' ? 'committing…' : 'Commit'}
              </button>
            </div>
            {lastGit && (
              <div className="nxs-result">
                repo: <a href={lastGit.url} target="_blank" rel="noreferrer">{lastGit.repo} <IconExternal size={10} /></a><br />
                {lastGit.files} files · branch {lastGit.branch} · {lastGit.created ? 'created' : 'updated'}
                {lastGit.commitUrl && <> · <a href={lastGit.commitUrl} target="_blank" rel="noreferrer">commit</a></>}
              </div>
            )}
          </>
        ) : (
          <TokenForm provider="github" onConnect={connectIntegration} label="GitHub" placeholder="GitHub token with repo scope" />
        )}
      </div>

      <div className="nxs-card">
        <h4><IconDownload size={14} style={{ color: 'var(--violet-2)' }} /> Export</h4>
        <p>Download the project as a ZIP, ready for any host or your own machine.</p>
        <button className="nxs-btn" onClick={exportZip} disabled={!fileCount}>
          <IconDownload size={12} /> Download {fileCount} files
        </button>
      </div>

      <div className="nxs-card">
        <h4><IconHistory size={14} style={{ color: 'var(--violet-2)' }} /> Deployments</h4>
        {deployments.length === 0 && <p style={{ margin: 0 }}>No deployments yet.</p>}
        {deployments.map((d) => (
          <div key={d.id} className="nxs-result" style={{ marginTop: 8 }}>
            <b>{d.provider}</b> · {d.status}
            {d.url && <> · <a href={d.url} target="_blank" rel="noreferrer">{d.url}</a></>}
            <div className="nxs-faint">{d.createdAt ? new Date(d.createdAt).toLocaleString() : ''}</div>
          </div>
        ))}
      </div>

      <div className="nxs-card">
        <h4><IconPlug size={14} style={{ color: 'var(--violet-2)' }} /> Restore points</h4>
        <p>Every agent build and manual save keeps a snapshot. Restoring is instant and reversible.</p>
        {revisions.length === 0 && <p style={{ margin: 0 }}>No saves yet.</p>}
        {revisions.slice(0, 8).map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="nxs-mono" style={{ flex: 1, fontSize: 11, color: 'var(--text-2)' }}>{r.label || `revision ${r.id}`}</span>
            <span className="nxs-faint" style={{ fontSize: 10.5 }}>{r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : ''}</span>
            <button className="nxs-btn sm" onClick={() => restoreRevision(r.id)}><IconRefresh size={10} /> Restore</button>
          </div>
        ))}
      </div>

      <div className="nxs-card">
        <h4><IconCheck size={14} style={{ color: 'var(--green)' }} /> What is real here</h4>
        <p style={{ margin: 0 }}>
          Deployments call the Vercel API with your token; GitHub pushes real commits; restores write the
          snapshot back into the database. Nothing in this panel simulates success.
        </p>
      </div>
    </div>
  );
}
