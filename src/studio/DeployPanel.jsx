/* ============================================================================
   NEXORA — Publish & Connected Services Panel
   GitHub (OAuth + Token, repos, branches, file read, commit & PR) ·
   Vercel (OAuth + Token, projects, production/preview deploy, live status) ·
   Google Drive & Google Docs (OAuth + Token, read/create/edit Docs, manage Drive,
   export project as Doc or ZIP) · Local ZIP download · Deployment history.
   ============================================================================ */

import { useEffect, useState } from 'react';
import { useStudio } from './state.jsx';
import { request } from './api.js';
import { zipFiles } from './preview/bundler.js';
import {
  IconRocket, IconGit, IconGitHub, IconVercel, IconDrive, IconDoc,
  IconDownload, IconHistory, IconExternal, IconRefresh, IconPlus,
} from './icons.jsx';

function ConnectBlock({ provider, oauthConfigured, onOAuth, onConnect, label, placeholder }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);

  const handleOAuth = async () => {
    setBusy('oauth');
    setError(null);
    try {
      await onOAuth(provider);
    } catch (e) {
      setError(e.detail || e.code || 'OAuth could not start');
    } finally {
      setBusy('');
    }
  };

  const handleToken = async (e) => {
    e.preventDefault();
    if (token.trim().length < 10) return;
    setBusy('token');
    setError(null);
    try {
      await onConnect(provider, token.trim());
      setToken('');
    } catch (err) {
      setError(err.detail || err.code || 'Token rejected');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="nxs-connect-box">
      {oauthConfigured && (
        <button
          type="button"
          className="nxs-btn primary full"
          disabled={Boolean(busy)}
          onClick={handleOAuth}
        >
          {busy === 'oauth' ? 'Opening sign-in…' : `Sign in with ${label} (OAuth)`}
        </button>
      )}
      <form className="nxs-key-form" onSubmit={handleToken}>
        <input
          className="nxs-input"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
        <button
          type="submit"
          className={`nxs-btn sm${oauthConfigured ? '' : ' primary'}`}
          disabled={Boolean(busy) || token.trim().length < 10}
        >
          {busy === 'token' ? 'Verifying…' : `Connect ${label}`}
        </button>
      </form>
      {error && <div className="nxs-inline-err">{error}</div>}
    </div>
  );
}

export default function DeployPanel() {
  const {
    project, files, deployments, session,
    deployVercel, pushGithub,
    connectIntegration, connectOAuth, disconnectIntegration,
    notify, accounts, loadAccounts,
    branchCache, fetchRepoBranches, createRepoBranch,
    importRepo, pushBranch, followVercelProject,
    exportToDrive, openDocsModal,
  } = useStudio();

  const [verifying, setVerifying] = useState(null);
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('');
  const [base, setBase] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [asPr, setAsPr] = useState(true);
  const [isPrivate, setIsPrivate] = useState(true);
  const [busyRepo, setBusyRepo] = useState(null);
  const [pushing, setPushing] = useState(false);
  const [lastGit, setLastGit] = useState(null);
  const [newBranchName, setNewBranchName] = useState('');

  const [vercelTarget, setVercelTarget] = useState('');
  const [deployTarget, setDeployTarget] = useState('production');
  const [vercelProbe, setVercelProbe] = useState(null);
  const [recentDeploys, setRecentDeploys] = useState([]);
  const [deploying, setDeploying] = useState(false);
  const [lastVercel, setLastVercel] = useState(null);

  const [driveExporting, setDriveExporting] = useState(null);
  const [lastDrive, setLastDrive] = useState(null);

  const github = accounts?.github || session?.integrations?.github || { connected: false };
  const vercel = accounts?.vercel || session?.integrations?.vercel || { connected: false };
  const drive = accounts?.google || { connected: false };
  const oauth = session?.oauth || {};
  const fileCount = Object.keys(files || {}).length;

  useEffect(() => {
    if (project?.meta?.repo && !repo) setRepo(project.meta.repo);
    if (project?.meta?.defaultBranch && !base) setBase(project.meta.defaultBranch);
  }, [project?.meta?.repo, project?.meta?.defaultBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRepo = repo.trim() || project?.meta?.repo || '';
  const cachedBranches = activeRepo ? (branchCache[activeRepo]?.branches || []) : [];

  const verify = async (provider) => {
    setVerifying(provider);
    try {
      await loadAccounts();
      notify(`${provider} connection verified`, 'ok');
    } catch (e) {
      notify(`${provider}: ${e.detail || e.code}`, 'error');
    } finally {
      setVerifying(null);
    }
  };

  const openRepository = async (fullName, ref = '') => {
    if (!fullName || busyRepo) return;
    setBusyRepo(fullName);
    try {
      const data = await importRepo({ repo: fullName, ref });
      setRepo(data.repo.full);
      if (data.repo.ref) setBase(data.repo.ref);
    } catch (e) {
      notify(`Import failed: ${e.detail || e.code}`, 'error');
    } finally {
      setBusyRepo(null);
    }
  };

  const commitAndPr = async () => {
    const target = (repo || '').trim() || project?.meta?.repo || github.repos?.[0]?.name || '';
    if (!/^[\w.-]+\/[\w.-]+$/.test(target)) {
      notify('Select or enter a repository as owner/name', 'warn');
      return;
    }
    setBusyRepo('push');
    try {
      const res = await pushBranch({
        repo: target,
        branch: branch.trim(),
        base: base.trim(),
        message: commitMsg.trim() || undefined,
        pr: asPr,
      });
      if (res) setLastGit(res);
      setBranch('');
      setCommitMsg('');
    } catch (e) {
      notify(`Push failed: ${e.detail || e.code}`, 'error');
    } finally {
      setBusyRepo(null);
    }
  };

  const pushNewRepo = async () => {
    setPushing(true);
    try {
      const result = await pushGithub({
        repo: repo.includes('/') ? repo.split('/')[1] : (repo.trim() || undefined),
        isPrivate,
        message: commitMsg.trim() || undefined,
      });
      if (result) setLastGit(result);
    } finally {
      setPushing(false);
    }
  };

  const handleLoadBranches = async (targetRepo) => {
    const r = targetRepo || activeRepo;
    if (!r || !r.includes('/')) return;
    try {
      const info = await fetchRepoBranches(r);
      if (info?.defaultBranch && !base) setBase(info.defaultBranch);
    } catch (e) {
      notify(e.detail || e.code || 'Could not load branches', 'error');
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!activeRepo || !newBranchName.trim()) return;
    setBusyRepo('new-branch');
    try {
      const created = await createRepoBranch({
        repo: activeRepo,
        branch: newBranchName.trim(),
        from: base.trim() || undefined,
      });
      setBranch(created.branch);
      setNewBranchName('');
    } catch (err) {
      notify(err.detail || err.code || 'Branch creation failed', 'error');
    } finally {
      setBusyRepo(null);
    }
  };

  const deploy = async () => {
    setDeploying(true);
    const result = await deployVercel({ existingProjectId: vercelTarget || null, target: deployTarget });
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

  const loadRecentDeploys = async (projectId) => {
    try {
      const params = projectId ? `?id=${encodeURIComponent(projectId)}&limit=5` : '?limit=5';
      const data = await request(`studio/vercel/deployments${params}`, { timeout: 20_000 });
      setRecentDeploys(data.deployments || []);
    } catch (e) {
      notify(e.detail || e.code || 'Could not fetch Vercel deployments', 'error');
    }
  };

  const saveToDrive = async (as) => {
    if (!fileCount) { notify('Nothing to export yet', 'warn'); return; }
    setDriveExporting(as);
    try {
      let zipBase64 = null;
      if (as === 'zip') {
        const blob = zipFiles(files);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        }
        zipBase64 = btoa(binary);
      }
      const out = await exportToDrive({ as, zipBase64 });
      if (out) setLastDrive(out);
    } catch (e) {
      notify(`Drive export failed: ${e.detail || e.code}`, 'error');
    } finally {
      setDriveExporting(null);
    }
  };

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

  return (
    <div className="nxs-publish-scroll">
      {/* ============================= 1) GITHUB ============================ */}
      <div className="nxs-card">
        <div className="nxs-card-head">
          <h4><IconGitHub size={15} /> GitHub</h4>
          <span className={`nxs-status-pill ${github.connected ? 'ok' : 'off'}`}>
            {github.connected ? `Connected · @${github.login}` : 'Not connected'}
          </span>
        </div>
        <p>Open any repository, switch or create branches, commit file changes, and open pull requests.</p>

        {github.connected ? (
          <>
            <div className="nxs-result">
              <div className="nxs-result-line">
                <span>
                  Account: <b>@{github.login}</b>
                  {github.source ? ` (${github.source === 'oauth' ? 'OAuth' : github.source === 'server' ? 'server' : 'token'})` : ''}
                </span>
                <div className="nxs-row-gap">
                  <button type="button" className="nxs-mini-btn" onClick={() => verify('github')} disabled={verifying === 'github'}>
                    <IconRefresh size={11} /> {verifying === 'github' ? 'Checking…' : 'Refresh'}
                  </button>
                  {github.source !== 'server' && (
                    <button type="button" className="nxs-mini-btn ghost" onClick={() => disconnectIntegration('github')}>
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {Array.isArray(github.repos) && github.repos.length > 0 && (
                <div className="nxs-repo-list">
                  {github.repos.slice(0, 10).map((r) => (
                    <div key={r.name} className={`nxs-repo-row${activeRepo === r.name ? ' selected' : ''}`}>
                      <button
                        type="button"
                        className="nxs-repo-pick"
                        onClick={() => {
                          setRepo(r.name);
                          if (r.defaultBranch) setBase(r.defaultBranch);
                          handleLoadBranches(r.name);
                        }}
                      >
                        <b>{r.name}</b>
                        <span className="nxs-tag">{r.private ? 'private' : 'public'}</span>
                      </button>
                      <button
                        type="button"
                        className="nxs-btn sm"
                        onClick={() => openRepository(r.name, r.defaultBranch || '')}
                        disabled={busyRepo === r.name}
                      >
                        {busyRepo === r.name ? 'Opening…' : 'Open'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Branch picker & creation for selected repository */}
            {activeRepo && activeRepo.includes('/') && cachedBranches.length > 0 && (
              <div className="nxs-branch-box">
                <div className="nxs-row-gap wrap">
                  <span className="nxs-kicker">Branches on {activeRepo}</span>
                  {cachedBranches.slice(0, 8).map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      className={`nxs-filter-pill${branch === b.name ? ' active' : ''}`}
                      onClick={() => setBranch(b.name)}
                    >
                      <IconGit size={11} /> {b.name}
                    </button>
                  ))}
                </div>
                <form className="nxs-pop-inline" onSubmit={handleCreateBranch}>
                  <input
                    type="text"
                    placeholder="New branch name (e.g. feat/redesign)..."
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                  />
                  <button type="submit" className="nxs-mini-btn" disabled={!newBranchName.trim() || busyRepo === 'new-branch'}>
                    <IconPlus size={12} /> Create Branch
                  </button>
                </form>
              </div>
            )}

            {/* Commit & Pull Request controls */}
            <div className="nxs-git-branch">
              <input
                className="nxs-input"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repository"
                aria-label="Target repository"
              />
              <input
                className="nxs-input"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="branch (auto nexora/<time>)"
                aria-label="Target branch"
              />
              <input
                className="nxs-input"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="base branch (main)"
                aria-label="Base branch"
              />
              <input
                className="nxs-input"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message (optional)"
                aria-label="Commit message"
              />
              <label className="nxs-check-label">
                <input type="checkbox" checked={asPr} onChange={(e) => setAsPr(e.target.checked)} />
                <span>Open pull request</span>
              </label>
              <button
                type="button"
                className="nxs-btn primary sm"
                onClick={commitAndPr}
                disabled={busyRepo === 'push' || !fileCount}
              >
                <IconGit size={13} /> {busyRepo === 'push' ? 'Committing…' : 'Commit'}
              </button>
            </div>

            {/* Publish as a brand-new GitHub repository */}
            <div className="nxs-row-gap wrap" style={{ marginTop: 10 }}>
              <label className="nxs-check-label">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                <span>Private repo</span>
              </label>
              <button type="button" className="nxs-btn sm" onClick={pushNewRepo} disabled={pushing || !fileCount}>
                <IconGitHub size={13} /> {pushing ? 'Publishing…' : 'Publish as New Repo'}
              </button>
            </div>

            {lastGit && (
              <div className="nxs-result ok">
                {lastGit.pull ? (
                  <>
                    Opened pull request <a href={lastGit.pull.url} target="_blank" rel="noreferrer">#{lastGit.pull.number} <IconExternal size={11} /></a> on <b>{lastGit.repo}</b> ({lastGit.branch})
                  </>
                ) : (
                  <>
                    Pushed {lastGit.files} file(s) to{' '}
                    <a href={lastGit.url} target="_blank" rel="noreferrer">{lastGit.repo} <IconExternal size={11} /></a>
                    {lastGit.branch ? ` · ${lastGit.branch}` : ''}
                    {lastGit.commitUrl && <> · <a href={lastGit.commitUrl} target="_blank" rel="noreferrer">commit</a></>}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <ConnectBlock
            provider="github"
            oauthConfigured={Boolean(oauth.github?.configured)}
            onOAuth={connectOAuth}
            onConnect={connectIntegration}
            label="GitHub"
            placeholder="GitHub Personal Access Token (repo scope)"
          />
        )}
      </div>

      {/* ============================= 2) VERCEL ============================ */}
      <div className="nxs-card">
        <div className="nxs-card-head">
          <h4><IconVercel size={13} /> Vercel</h4>
          <span className={`nxs-status-pill ${vercel.connected ? 'ok' : 'off'}`}>
            {vercel.connected ? `Connected${vercel.username ? ` · ${vercel.username}` : ''}` : 'Not connected'}
          </span>
        </div>
        <p>Deploy static, React, Vite, and Next.js projects to Vercel and monitor live build status.</p>

        {vercel.connected ? (
          <>
            <div className="nxs-result">
              <div className="nxs-result-line">
                <span>
                  Account: <b>{vercel.username || 'Vercel'}</b>
                  {vercel.team ? ` · team ${vercel.team}` : ''}
                </span>
                <div className="nxs-row-gap">
                  <button type="button" className="nxs-mini-btn" onClick={() => loadRecentDeploys(vercelTarget)}>
                    Deployments
                  </button>
                  <button type="button" className="nxs-mini-btn" onClick={() => verify('vercel')} disabled={verifying === 'vercel'}>
                    <IconRefresh size={11} /> {verifying === 'vercel' ? 'Checking…' : 'Refresh'}
                  </button>
                  {vercel.source !== 'server' && (
                    <button type="button" className="nxs-mini-btn ghost" onClick={() => disconnectIntegration('vercel')}>
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {Array.isArray(vercel.projects) && vercel.projects.length > 0 && (
                <div className="nxs-row-gap wrap" style={{ marginTop: 10 }}>
                  <select
                    className="nxs-input"
                    aria-label="Vercel project"
                    value={vercelTarget}
                    onChange={(e) => { setVercelTarget(e.target.value); setVercelProbe(null); }}
                    style={{ flex: '1 1 180px' }}
                  >
                    <option value="">Deploy as a new project</option>
                    {vercel.projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="nxs-btn sm"
                    onClick={followProject}
                    disabled={!vercelTarget || vercelProbe?.busy}
                  >
                    <IconRefresh size={12} /> {vercelProbe?.busy ? 'Following…' : 'Follow to READY'}
                  </button>
                </div>
              )}

              {vercelProbe && !vercelProbe.busy && (
                <div className="nxs-result ok">
                  <b>{vercelProbe.name}</b> · <span className="mono">{vercelProbe.state || 'UNKNOWN'}</span>
                  {vercelProbe.url && (
                    <> · <a href={vercelProbe.url} target="_blank" rel="noreferrer">{vercelProbe.url} <IconExternal size={11} /></a></>
                  )}
                  {vercelProbe.inspectorUrl && (
                    <> · <a href={vercelProbe.inspectorUrl} target="_blank" rel="noreferrer">Logs</a></>
                  )}
                </div>
              )}

              {recentDeploys.length > 0 && (
                <div className="nxs-deploy-mini-list">
                  {recentDeploys.map((d) => (
                    <div key={d.id} className="nxs-deploy-mini-row">
                      <span className={`nxs-status-pill ${d.state === 'READY' ? 'ok' : d.state === 'ERROR' ? 'err' : 'off'}`}>
                        {d.state}
                      </span>
                      <span className="mono">{d.name}</span>
                      {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="nxs-inline-link">Open <IconExternal size={11} /></a>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="nxs-row-gap wrap" style={{ marginTop: 10 }}>
              <select
                className="nxs-input"
                aria-label="Deployment environment"
                value={deployTarget}
                onChange={(e) => setDeployTarget(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="production">Production</option>
                <option value="preview">Preview</option>
              </select>
              <button type="button" className="nxs-btn primary" onClick={deploy} disabled={deploying || !fileCount}>
                <IconRocket size={13} /> {deploying ? 'Deploying…' : (vercelTarget ? 'Deploy to Project' : 'Deploy to Vercel')}
              </button>
            </div>

            {lastVercel && (
              <div className="nxs-result ok">
                Status: <b className="mono">{lastVercel.status || lastVercel.state || 'QUEUED'}</b>
                {lastVercel.url && (
                  <> · <a href={lastVercel.url} target="_blank" rel="noreferrer">{lastVercel.url} <IconExternal size={11} /></a></>
                )}
                {lastVercel.inspectorUrl && (
                  <> · <a href={lastVercel.inspectorUrl} target="_blank" rel="noreferrer">Inspect</a></>
                )}
              </div>
            )}
          </>
        ) : (
          <ConnectBlock
            provider="vercel"
            oauthConfigured={Boolean(oauth.vercel?.configured)}
            onOAuth={connectOAuth}
            onConnect={connectIntegration}
            label="Vercel"
            placeholder="Vercel Access Token (vercel.com/account/tokens)"
          />
        )}
      </div>

      {/* ================== 3) GOOGLE DRIVE & GOOGLE DOCS =================== */}
      <div className="nxs-card">
        <div className="nxs-card-head">
          <h4><IconDrive size={15} /> Google Drive &amp; Google Docs</h4>
          <span className={`nxs-status-pill ${drive.connected ? 'ok' : 'off'}`}>
            {drive.connected ? `Connected${drive.email ? ` · ${drive.email}` : ''}` : 'Not connected'}
          </span>
        </div>
        <p>Browse and manage Drive files, create, read and edit Google Docs, attach documents to chat, or export your project.</p>

        {drive.connected ? (
          <>
            {Array.isArray(drive.files) && drive.files.length > 0 && (
              <div className="nxs-drive-chips">
                {drive.files.slice(0, 6).map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="nxs-file-chip">
                    <IconDoc size={12} /> <span>{f.name}</span>
                  </a>
                ))}
              </div>
            )}

            <div className="nxs-row-gap wrap" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="nxs-btn primary sm"
                onClick={() => saveToDrive('doc')}
                disabled={!fileCount || Boolean(driveExporting)}
              >
                <IconDoc size={13} /> {driveExporting === 'doc' ? 'Saving…' : 'Save as a Google Doc'}
              </button>
              <button
                type="button"
                className="nxs-btn sm"
                onClick={() => saveToDrive('zip')}
                disabled={!fileCount || Boolean(driveExporting)}
              >
                <IconDrive size={13} /> {driveExporting === 'zip' ? 'Uploading…' : 'Save .zip to Drive'}
              </button>
              <button
                type="button"
                className="nxs-btn sm"
                onClick={() => openDocsModal({ mode: 'docs' })}
              >
                <IconDoc size={13} /> Open Google Docs
              </button>
              <button
                type="button"
                className="nxs-btn sm"
                onClick={() => openDocsModal({ mode: 'drive' })}
              >
                <IconDrive size={13} /> Manage Drive
              </button>
              {drive.source !== 'server' && (
                <button type="button" className="nxs-mini-btn ghost" onClick={() => disconnectIntegration('google')}>
                  Disconnect
                </button>
              )}
            </div>

            {lastDrive && (
              <div className="nxs-result ok">
                Saved to Drive: <a href={lastDrive.url} target="_blank" rel="noreferrer">{lastDrive.name} <IconExternal size={11} /></a>
              </div>
            )}
          </>
        ) : (
          <ConnectBlock
            provider="google"
            oauthConfigured={Boolean(oauth.google?.configured)}
            onOAuth={connectOAuth}
            onConnect={connectIntegration}
            label="Google"
            placeholder="Google OAuth Access Token (Drive & Docs scopes)"
          />
        )}
      </div>

      {/* =========================== 4) ZIP EXPORT ========================== */}
      <div className="nxs-card">
        <div className="nxs-card-head">
          <h4><IconDownload size={15} /> Download Archive</h4>
        </div>
        <p>Export every workspace file as a standard ZIP archive ready to run locally or deploy anywhere.</p>
        <button type="button" className="nxs-btn sm" onClick={exportZip} disabled={!fileCount}>
          <IconDownload size={13} /> Download ZIP ({fileCount} file{fileCount === 1 ? '' : 's'})
        </button>
      </div>

      {/* ======================= 5) DEPLOYMENT HISTORY ====================== */}
      {deployments.length > 0 && (
        <div className="nxs-card">
          <div className="nxs-card-head">
            <h4><IconHistory size={15} /> Activity &amp; Deployments</h4>
          </div>
          <div className="nxs-deploy-mini-list">
            {deployments.slice(0, 10).map((d) => (
              <div key={d.id} className="nxs-deploy-mini-row">
                <b>{d.provider}</b>
                <span className="nxs-tag">{d.status || d.state}</span>
                {d.url && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="nxs-inline-link">
                    {d.url.replace(/^https?:\/\//, '')} <IconExternal size={11} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
