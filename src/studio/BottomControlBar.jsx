/* ============================================================================
   NEXORA — Bottom Control Bar (Arena-style bar directly below composer)
   Project selector · GitHub Repository & Branch selector · Diff & Checks link ·
   Settings button · Hide/collapse bar toggle.
   ============================================================================ */

import { useEffect, useRef, useState } from 'react';
import { useStudio } from './state.jsx';
import {
  IconFolder, IconGit, IconGear, IconX, IconChevronDown, IconPlus,
  IconCheck, IconRefresh, IconDiff, IconSliders, IconGitHub,
} from './icons.jsx';

export default function BottomControlBar() {
  const {
    projects, project, files,
    controlBarOpen, setControlBarOpen,
    createProject, openProject, updateProjectMeta,
    accounts, loadAccounts, branchCache, fetchRepoBranches, createRepoBranch, importRepo, pushBranch,
    projectDiff, openDiffView,
    openSettings, setTab, notify,
  } = useStudio();

  const [openMenu, setOpenMenu] = useState(null); // 'project' | 'branch' | null
  const [selectedRepo, setSelectedRepo] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [commitMsg, setCommitMsg] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [newProjName, setNewProjName] = useState('');
  const [showNewProj, setShowNewProj] = useState(false);
  const barRef = useRef(null);

  const linkedRepo = project?.meta?.repo || '';
  const linkedBranch = project?.meta?.branch || '';
  const ghConnected = Boolean(accounts?.github?.connected);
  const ghRepos = accounts?.github?.repos || [];
  const activeRepo = selectedRepo || linkedRepo || ghRepos[0]?.name || '';
  const repoInfo = activeRepo ? branchCache[activeRepo] : null;
  const branches = repoInfo?.branches || [];

  useEffect(() => {
    if (linkedRepo) setSelectedRepo(linkedRepo);
  }, [linkedRepo]);

  /* Close popovers on outside tap or Escape */
  useEffect(() => {
    if (!openMenu) return undefined;
    const onPointer = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setOpenMenu(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  /* Fetch real GitHub branches when the branch popover opens or repo changes */
  useEffect(() => {
    if (openMenu !== 'branch' || !ghConnected || !activeRepo) return;
    if (branchCache[activeRepo]) return;
    let alive = true;
    setLoadingBranches(true);
    fetchRepoBranches(activeRepo)
      .catch((e) => { if (alive) notify(e.detail || e.code || 'Could not load branches', 'error'); })
      .finally(() => { if (alive) setLoadingBranches(false); });
    return () => { alive = false; };
  }, [openMenu, ghConnected, activeRepo, branchCache, fetchRepoBranches, notify]);

  if (!controlBarOpen) {
    return (
      <div className="nxs-cbar-collapsed">
        <button
          type="button"
          className="nxs-cbar-restore"
          aria-label="Show control bar"
          onClick={() => setControlBarOpen(true)}
        >
          <IconSliders size={13} />
          <span>Controls</span>
        </button>
      </div>
    );
  }

  const activeProjects = (projects || []).filter((p) => !p.archived && p.status !== 'archived');
  const fileCount = Object.keys(files || {}).length;

  const handleSelectBranch = async (branchName, { pull = false } = {}) => {
    if (!activeRepo || !branchName) return;
    setBusyAction(`branch:${branchName}`);
    try {
      if (pull || !project || fileCount === 0) {
        await importRepo({ repo: activeRepo, ref: branchName, intoCurrent: Boolean(project && fileCount === 0) });
      } else {
        await updateProjectMeta(project.id, {
          repo: activeRepo,
          branch: branchName,
          defaultBranch: repoInfo?.defaultBranch || 'main',
        });
        notify(`Switched target branch to ${activeRepo}@${branchName}`, 'ok');
      }
      setOpenMenu(null);
    } catch (e) {
      notify(e.detail || e.code || 'Branch switch failed', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    const name = newBranch.trim();
    if (!activeRepo || !name) return;
    setBusyAction('create-branch');
    try {
      await createRepoBranch({
        repo: activeRepo,
        branch: name,
        from: linkedBranch || repoInfo?.defaultBranch || 'main',
      });
      setNewBranch('');
    } catch (err) {
      notify(err.detail || err.code || 'Could not create branch', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const handleQuickCommit = async (openPr = false) => {
    if (!project || !activeRepo || !fileCount) return;
    setBusyAction(openPr ? 'pr' : 'commit');
    try {
      const targetBranch = linkedBranch || repoInfo?.defaultBranch || 'main';
      const defaultBranch = repoInfo?.defaultBranch || 'main';
      const branchToPush = openPr && targetBranch === defaultBranch
        ? `nexora/${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`
        : targetBranch;
      await pushBranch({
        repo: activeRepo,
        branch: branchToPush,
        base: defaultBranch,
        message: commitMsg.trim() || `Update ${project.name}`,
        pr: openPr,
      });
      setCommitMsg('');
      setOpenMenu(null);
    } catch (err) {
      notify(err.detail || err.code || 'Commit failed', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const handleQuickCreateProject = async (e) => {
    e.preventDefault();
    const name = newProjName.trim() || 'New project';
    setShowNewProj(false);
    setNewProjName('');
    setOpenMenu(null);
    await createProject({ name, meta: { kind: 'project' } });
  };

  const branchLabel = linkedRepo
    ? `${linkedBranch || 'main'}`
    : (ghConnected ? 'Branch' : 'GitHub');

  return (
    <div className="nxs-cbar" ref={barRef} role="toolbar" aria-label="Workspace controls">
      <div className="nxs-cbar-left">
        {/* 1) Project selector */}
        <div className="nxs-cbar-anchor">
          <button
            type="button"
            className={`nxs-cbar-pill${openMenu === 'project' ? ' active' : ''}`}
            aria-label="Select project"
            aria-expanded={openMenu === 'project'}
            onClick={() => setOpenMenu(openMenu === 'project' ? null : 'project')}
          >
            <IconFolder size={13.5} />
            <span className="nxs-cbar-label">{project ? project.name : 'No project'}</span>
            <IconChevronDown size={12} />
          </button>

          {openMenu === 'project' && (
            <div className="nxs-pop nxs-pop-up" role="dialog" aria-label="Project selector">
              <div className="nxs-pop-head">
                <span className="nxs-pop-title">Project</span>
                <button
                  type="button"
                  className="nxs-mini-btn"
                  onClick={() => setShowNewProj((v) => !v)}
                >
                  <IconPlus size={12} /> New
                </button>
              </div>

              {showNewProj && (
                <form className="nxs-pop-inline" onSubmit={handleQuickCreateProject}>
                  <input
                    type="text"
                    placeholder="Project name..."
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="nxs-mini-btn primary">Create</button>
                </form>
              )}

              <div className="nxs-pop-list">
                {activeProjects.length === 0 ? (
                  <div className="nxs-pop-empty">No projects yet — send a prompt or create one above.</div>
                ) : (
                  activeProjects.slice(0, 20).map((p) => {
                    const isCurrent = project?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`nxs-pop-row${isCurrent ? ' selected' : ''}`}
                        onClick={() => { setOpenMenu(null); openProject(p.id); }}
                      >
                        <span className="nxs-pop-row-main">
                          <span className="nxs-pop-row-title" dir="auto">{p.name}</span>
                          {p.meta?.repo ? (
                            <span className="nxs-pop-row-sub">{p.meta.repo}</span>
                          ) : (p.fileCount ? (
                            <span className="nxs-pop-row-sub">{p.fileCount} file{p.fileCount === 1 ? '' : 's'}</span>
                          ) : null)}
                        </span>
                        {isCurrent && <IconCheck size={14} />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="nxs-pop-foot">
                <button
                  type="button"
                  className="nxs-pop-foot-btn"
                  onClick={() => {
                    setOpenMenu(null);
                    if (ghConnected) setTab('publish');
                    else openSettings('integrations');
                  }}
                >
                  <IconGitHub size={13} />
                  <span>{ghConnected ? 'Import from GitHub' : 'Connect GitHub repository'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2) GitHub Branch selector */}
        <div className="nxs-cbar-anchor">
          <button
            type="button"
            className={`nxs-cbar-pill${openMenu === 'branch' ? ' active' : ''}${linkedRepo ? ' linked' : ''}`}
            aria-label="Select GitHub branch"
            aria-expanded={openMenu === 'branch'}
            onClick={() => setOpenMenu(openMenu === 'branch' ? null : 'branch')}
          >
            <IconGit size={13.5} />
            <span className="nxs-cbar-label mono">{branchLabel}</span>
            <IconChevronDown size={12} />
          </button>

          {openMenu === 'branch' && (
            <div className="nxs-pop nxs-pop-up wide" role="dialog" aria-label="GitHub repository and branch">
              <div className="nxs-pop-head">
                <span className="nxs-pop-title">GitHub Branch</span>
                {ghConnected && (
                  <button
                    type="button"
                    className="nxs-icon-btn xs"
                    aria-label="Refresh branches"
                    title="Refresh repositories & branches"
                    onClick={async () => {
                      setLoadingBranches(true);
                      await loadAccounts().catch(() => {});
                      if (activeRepo) await fetchRepoBranches(activeRepo).catch(() => {});
                      setLoadingBranches(false);
                    }}
                  >
                    <IconRefresh size={13} />
                  </button>
                )}
              </div>

              {!ghConnected ? (
                <div className="nxs-pop-connect">
                  <p>Connect your GitHub account to browse repositories, switch branches, read files, commit changes, and open pull requests.</p>
                  <button
                    type="button"
                    className="nxs-btn primary full"
                    onClick={() => { setOpenMenu(null); openSettings('integrations'); }}
                  >
                    <IconGitHub size={15} /> Connect GitHub
                  </button>
                </div>
              ) : (
                <>
                  <div className="nxs-pop-field">
                    <label htmlFor="nxs-cbar-repo">Repository</label>
                    {ghRepos.length > 0 ? (
                      <select
                        id="nxs-cbar-repo"
                        aria-label="GitHub repository"
                        value={activeRepo}
                        onChange={(e) => setSelectedRepo(e.target.value)}
                      >
                        {linkedRepo && !ghRepos.some((r) => r.name === linkedRepo) && (
                          <option value={linkedRepo}>{linkedRepo}</option>
                        )}
                        {ghRepos.map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.name}{r.private ? ' (private)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="nxs-cbar-repo"
                        type="text"
                        placeholder="owner/repository"
                        value={selectedRepo}
                        onChange={(e) => setSelectedRepo(e.target.value)}
                        onBlur={() => { if (selectedRepo.includes('/')) fetchRepoBranches(selectedRepo).catch(() => {}); }}
                      />
                    )}
                  </div>

                  {activeRepo && (
                    <>
                      <div className="nxs-pop-subhead">Branches</div>
                      <div className="nxs-pop-list compact">
                        {loadingBranches ? (
                          <div className="nxs-pop-empty">Loading branches from GitHub…</div>
                        ) : branches.length === 0 ? (
                          <div className="nxs-pop-empty">No branches found.</div>
                        ) : (
                          branches.map((b) => {
                            const isCur = activeRepo === linkedRepo && b.name === linkedBranch;
                            return (
                              <div key={b.name} className={`nxs-pop-branch-row${isCur ? ' selected' : ''}`}>
                                <button
                                  type="button"
                                  className="nxs-pop-branch-pick"
                                  disabled={Boolean(busyAction)}
                                  onClick={() => handleSelectBranch(b.name, { pull: false })}
                                >
                                  <IconGit size={13} />
                                  <span className="mono">{b.name}</span>
                                  {b.name === repoInfo?.defaultBranch && <span className="nxs-tag">default</span>}
                                  {isCur && <IconCheck size={13} />}
                                </button>
                                <button
                                  type="button"
                                  className="nxs-mini-btn"
                                  disabled={Boolean(busyAction)}
                                  title={`Load files from ${b.name}`}
                                  onClick={() => handleSelectBranch(b.name, { pull: true })}
                                >
                                  {busyAction === `branch:${b.name}` ? '…' : 'Open'}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <form className="nxs-pop-inline" onSubmit={handleCreateBranch}>
                        <input
                          type="text"
                          aria-label="New branch name"
                          placeholder="Create new branch..."
                          value={newBranch}
                          onChange={(e) => setNewBranch(e.target.value)}
                        />
                        <button type="submit" className="nxs-mini-btn" disabled={!newBranch.trim() || Boolean(busyAction)}>
                          {busyAction === 'create-branch' ? '…' : 'Branch'}
                        </button>
                      </form>

                      {project && fileCount > 0 && (
                        <div className="nxs-pop-commit">
                          <input
                            type="text"
                            aria-label="Commit message"
                            placeholder="Commit message..."
                            value={commitMsg}
                            onChange={(e) => setCommitMsg(e.target.value)}
                          />
                          <div className="nxs-pop-commit-btns">
                            <button
                              type="button"
                              className="nxs-mini-btn primary"
                              disabled={Boolean(busyAction)}
                              onClick={() => handleQuickCommit(false)}
                            >
                              {busyAction === 'commit' ? 'Pushing…' : 'Commit & Push'}
                            </button>
                            <button
                              type="button"
                              className="nxs-mini-btn"
                              disabled={Boolean(busyAction)}
                              onClick={() => handleQuickCommit(true)}
                            >
                              {busyAction === 'pr' ? 'Opening…' : 'Open PR'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Optional live Diff pill whenever workspace has unreviewed changes */}
        {projectDiff?.hasChanges && (
          <button
            type="button"
            className="nxs-cbar-pill diff"
            aria-label="View All Changes"
            onClick={() => openDiffView(null, { all: true })}
          >
            <IconDiff size={13.5} />
            <span className="nxs-diff-add">+{projectDiff.totalAdded}</span>
            <span className="nxs-diff-del">-{projectDiff.totalRemoved}</span>
          </button>
        )}
      </div>

      <div className="nxs-cbar-right">
        {/* 3) Settings button */}
        <button
          type="button"
          className="nxs-cbar-icon"
          aria-label="Settings"
          title="Settings & Integrations"
          onClick={() => openSettings('models')}
        >
          <IconGear size={14.5} />
          <span className="nxs-cbar-settings-txt">Settings</span>
        </button>

        {/* 4) Close / hide bottom control bar */}
        <button
          type="button"
          className="nxs-cbar-icon close"
          aria-label="Hide control bar"
          title="Hide control bar"
          onClick={() => setControlBarOpen(false)}
        >
          <IconX size={14} />
        </button>
      </div>
    </div>
  );
}
