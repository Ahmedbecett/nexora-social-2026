/* ============================================================================
   NEXORA — Diff & Checks Panel (Arena AI style)
   Real unified line-by-line diffs across all files, View All Changes toggle,
   per-file & per-hunk Accept / Reject wired to persistent storage, plus real
   compile, JSON/HTML static, runtime console, and server build/test Checks.
   ============================================================================ */

import { useEffect, useState } from 'react';
import { useStudio } from './state.jsx';
import { request } from './api.js';
import {
  IconDiff, IconShieldCheck, IconHistory, IconCheck, IconX, IconCode,
  IconRefresh, IconWarn, IconSpark, IconChevronDown, IconPlay,
} from './icons.jsx';

const STATUS_META = {
  added: { badge: 'A', label: 'Added', cls: 'added' },
  modified: { badge: 'M', label: 'Modified', cls: 'modified' },
  deleted: { badge: 'D', label: 'Deleted', cls: 'deleted' },
};

function FileDiffCard({
  file, defaultOpen = true, onOpenEditor, onAccept, onReject, onRejectHunk,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState('');
  const meta = STATUS_META[file.status] || STATUS_META.modified;

  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(''); }
  };

  return (
    <article className={`nxs-diff-card status-${meta.cls}`} data-diff-path={file.path}>
      <header className="nxs-diff-card-head">
        <button
          type="button"
          className="nxs-diff-file-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <IconChevronDown size={13} className={`nxs-diff-chev${open ? ' open' : ''}`} />
          <span className={`nxs-diff-badge ${meta.cls}`} title={meta.label}>{meta.badge}</span>
          <span className="nxs-diff-path mono">{file.path}</span>
          <span className="nxs-diff-counts">
            {file.added > 0 && <b className="add">+{file.added}</b>}
            {file.removed > 0 && <b className="del">-{file.removed}</b>}
          </span>
        </button>

        <div className="nxs-diff-card-actions">
          {file.status !== 'deleted' && (
            <button
              type="button"
              className="nxs-mini-btn ghost"
              title={`Open ${file.path} in Code editor`}
              onClick={() => onOpenEditor(file.path)}
            >
              <IconCode size={12} />
              <span>Open</span>
            </button>
          )}
          <button
            type="button"
            className="nxs-mini-btn ok"
            disabled={Boolean(busy)}
            aria-label={`Accept changes in ${file.path}`}
            onClick={() => run('accept', () => onAccept(file.path))}
          >
            <IconCheck size={12} />
            <span>{busy === 'accept' ? '…' : 'Accept'}</span>
          </button>
          <button
            type="button"
            className="nxs-mini-btn danger"
            disabled={Boolean(busy)}
            aria-label={`Reject changes in ${file.path}`}
            onClick={() => run('reject', () => onReject(file.path))}
          >
            <IconX size={12} />
            <span>{busy === 'reject' ? '…' : 'Reject'}</span>
          </button>
        </div>
      </header>

      {open && (
        <div className="nxs-diff-hunks">
          {file.hunks.length === 0 ? (
            <div className="nxs-diff-empty-file">Empty file ({meta.label.toLowerCase()}).</div>
          ) : (
            file.hunks.map((hunk) => (
              <div key={hunk.index} className="nxs-diff-hunk">
                <div className="nxs-diff-hunk-bar">
                  <span className="mono">{hunk.header}</span>
                  {file.status === 'modified' && (
                    <button
                      type="button"
                      className="nxs-diff-hunk-revert"
                      disabled={Boolean(busy)}
                      onClick={() => run(`h-${hunk.index}`, () => onRejectHunk(file.path, hunk.index))}
                    >
                      {busy === `h-${hunk.index}` ? 'Reverting…' : 'Reject hunk'}
                    </button>
                  )}
                </div>
                <div className="nxs-diff-table-wrap">
                  <table className="nxs-diff-table" aria-label={`Diff lines for ${file.path}`}>
                    <tbody>
                      {hunk.lines.slice(0, 400).map((ln, idx) => (
                        <tr key={idx} className={`nxs-diff-line ${ln.type}`}>
                          <td className="nxs-diff-ln">{ln.oldNo ?? ''}</td>
                          <td className="nxs-diff-ln">{ln.newNo ?? ''}</td>
                          <td className="nxs-diff-sign">
                            {ln.type === 'add' ? '+' : ln.type === 'del' ? '-' : ' '}
                          </td>
                          <td className="nxs-diff-code">{ln.line || ' '}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hunk.lines.length > 400 && (
                    <div className="nxs-diff-trunc">
                      Showing first 400 of {hunk.lines.length} lines — open the file in Code to view the rest.
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </article>
  );
}

export default function DiffChecksPanel({ mode = 'diff' }) {
  const {
    session, project, files, revisions,
    diffBaseline, projectDiff, diffFocusPath, setDiffFocusPath,
    viewAllChanges, setViewAllChanges,
    compareWithRevision, acceptFileChange, rejectFileChange, rejectFileHunk,
    acceptAllChanges, rejectAllChanges,
    checks, runChecks, fixWithAI, agent,
    setActiveFile, setOpenFiles, setTab, restoreRevision,
  } = useStudio();

  const [section, setSection] = useState(mode === 'checks' ? 'checks' : 'diff');
  const [confirmRejectAll, setConfirmRejectAll] = useState(false);
  const [serverRuns, setServerRuns] = useState([]);
  const [selectedBase, setSelectedBase] = useState('current');

  useEffect(() => {
    setSection(mode === 'checks' ? 'checks' : 'diff');
  }, [mode]);

  /* Auto-run lightweight checks the first time the Checks view opens on a project */
  useEffect(() => {
    if (section !== 'checks') return;
    if (checks.summary === 'idle' && !checks.running && Object.keys(files || {}).length > 0) {
      runChecks({ includeServer: false, quiet: true });
    }
    if (project?.id) {
      request(`studio/projects/${project.id}/runs`, { timeout: 15_000 })
        .then((d) => setServerRuns(d.runs || []))
        .catch(() => {});
    }
  }, [section, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileList = projectDiff?.files || [];
  const visibleFiles = (!viewAllChanges && diffFocusPath)
    ? fileList.filter((f) => f.path === diffFocusPath)
    : fileList;
  const totalWorkspaceFiles = Object.keys(files || {}).length;
  const runtimeReady = Boolean(session?.runtime?.ready);

  const handleOpenEditor = (path) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    setTab('code');
  };

  const handleBaselineSelect = async (val) => {
    setSelectedBase(val);
    if (val === 'current') return;
    if (val === 'empty') {
      await compareWithRevision('empty');
      setViewAllChanges(true);
      setDiffFocusPath(null);
      return;
    }
    const revId = Number(val);
    if (revId) {
      await compareWithRevision(revId);
      setViewAllChanges(true);
      setDiffFocusPath(null);
    }
  };

  const switchSection = (next) => {
    setSection(next);
    if (next === 'diff' || next === 'checks') setTab(next);
  };

  const failedLogs = (checks.items || [])
    .filter((i) => i.status === 'fail')
    .map((i) => `[${i.name}] ${i.detail}\n${i.logs || ''}`)
    .join('\n\n')
    .trim();

  return (
    <div className="nxs-dc">
      {/* Sub-navigation: Diff · Checks · Revisions */}
      <div className="nxs-dc-bar">
        <div className="nxs-dc-tabs" role="tablist" aria-label="Diff and Checks">
          <button
            type="button"
            role="tab"
            aria-selected={section === 'diff'}
            className={`nxs-dc-tab${section === 'diff' ? ' active' : ''}`}
            onClick={() => switchSection('diff')}
          >
            <IconDiff size={14} />
            <span>Diff</span>
            {fileList.length > 0 && <span className="nxs-dc-count">{fileList.length}</span>}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={section === 'checks'}
            className={`nxs-dc-tab${section === 'checks' ? ' active' : ''}`}
            onClick={() => switchSection('checks')}
          >
            <IconShieldCheck size={14} />
            <span>Checks</span>
            {checks.summary !== 'idle' && (
              <span className={`nxs-dc-dot ${checks.summary}`} aria-label={`Checks ${checks.summary}`} />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={section === 'history'}
            className={`nxs-dc-tab${section === 'history' ? ' active' : ''}`}
            onClick={() => switchSection('history')}
          >
            <IconHistory size={14} />
            <span>Revisions</span>
            {revisions?.length > 0 && <span className="nxs-dc-count">{revisions.length}</span>}
          </button>
        </div>

        {section === 'diff' && totalWorkspaceFiles > 0 && (
          <div className="nxs-dc-compare">
            <select
              aria-label="Diff baseline"
              value={selectedBase}
              onChange={(e) => handleBaselineSelect(e.target.value)}
            >
              <option value="current">Base: {diffBaseline?.label || 'Last snapshot'}</option>
              <option value="empty">View All Files (vs empty)</option>
              {(revisions || []).map((r) => (
                <option key={r.id} value={String(r.id)}>
                  Rev #{r.id} · {r.label || 'snapshot'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ============================= DIFF VIEW ============================ */}
      {section === 'diff' && (
        <div className="nxs-dc-body">
          {fileList.length === 0 ? (
            <div className="nxs-dc-empty">
              <div className="nxs-dc-empty-icon"><IconDiff size={22} /></div>
              <h3>No unreviewed changes</h3>
              <p>
                {totalWorkspaceFiles > 0
                  ? 'Every file matches the accepted baseline. Ask NEXORA to edit your project, compare against an earlier revision, or inspect all project files below.'
                  : 'Once NEXORA creates or edits files, every addition and deletion will appear here for review.'}
              </p>
              {totalWorkspaceFiles > 0 && (
                <div className="nxs-dc-empty-actions">
                  <button
                    type="button"
                    className="nxs-btn"
                    onClick={() => handleBaselineSelect('empty')}
                  >
                    <IconDiff size={14} /> View All Changes ({totalWorkspaceFiles} file{totalWorkspaceFiles === 1 ? '' : 's'})
                  </button>
                  <button
                    type="button"
                    className="nxs-btn ghost"
                    onClick={() => switchSection('checks')}
                  >
                    <IconShieldCheck size={14} /> Run Checks
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Review summary + bulk Accept All / Reject All */}
              <div className="nxs-diff-summary">
                <div className="nxs-diff-summary-stats">
                  <strong>{fileList.length} file{fileList.length === 1 ? '' : 's'} changed</strong>
                  <span className="nxs-diff-add">+{projectDiff.totalAdded}</span>
                  <span className="nxs-diff-del">-{projectDiff.totalRemoved}</span>
                </div>

                <div className="nxs-diff-summary-actions">
                  <button
                    type="button"
                    className={`nxs-mini-btn${viewAllChanges && !diffFocusPath ? ' active' : ''}`}
                    onClick={() => { setDiffFocusPath(null); setViewAllChanges(true); }}
                  >
                    View All Changes
                  </button>
                  <button
                    type="button"
                    className="nxs-mini-btn primary"
                    aria-label="Accept all changes"
                    onClick={() => { setConfirmRejectAll(false); acceptAllChanges(); }}
                  >
                    <IconCheck size={12} /> Accept All
                  </button>
                  {!confirmRejectAll ? (
                    <button
                      type="button"
                      className="nxs-mini-btn danger"
                      aria-label="Reject all changes"
                      onClick={() => setConfirmRejectAll(true)}
                    >
                      <IconX size={12} /> Reject All
                    </button>
                  ) : (
                    <span className="nxs-diff-confirm">
                      <button
                        type="button"
                        className="nxs-mini-btn danger solid"
                        onClick={() => { setConfirmRejectAll(false); rejectAllChanges(); }}
                      >
                        Confirm revert
                      </button>
                      <button type="button" className="nxs-mini-btn" onClick={() => setConfirmRejectAll(false)}>
                        Cancel
                      </button>
                    </span>
                  )}
                </div>
              </div>

              {/* File filter strip */}
              <div className="nxs-diff-strip" role="navigation" aria-label="Changed files">
                <button
                  type="button"
                  className={`nxs-diff-chip${viewAllChanges && !diffFocusPath ? ' active' : ''}`}
                  onClick={() => { setDiffFocusPath(null); setViewAllChanges(true); }}
                >
                  All ({fileList.length})
                </button>
                {fileList.map((f) => {
                  const meta = STATUS_META[f.status] || STATUS_META.modified;
                  const active = !viewAllChanges && diffFocusPath === f.path;
                  return (
                    <button
                      key={f.path}
                      type="button"
                      className={`nxs-diff-chip${active ? ' active' : ''}`}
                      onClick={() => {
                        setDiffFocusPath(f.path);
                        setViewAllChanges(false);
                      }}
                    >
                      <span className={`nxs-diff-badge sm ${meta.cls}`}>{meta.badge}</span>
                      <span className="mono">{f.path.split('/').pop()}</span>
                    </button>
                  );
                })}
              </div>

              {/* Unified diff cards */}
              <div className="nxs-diff-list">
                {(visibleFiles.length ? visibleFiles : fileList).map((file) => (
                  <FileDiffCard
                    key={file.path}
                    file={file}
                    defaultOpen
                    onOpenEditor={handleOpenEditor}
                    onAccept={acceptFileChange}
                    onReject={rejectFileChange}
                    onRejectHunk={rejectFileHunk}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============================ CHECKS VIEW =========================== */}
      {section === 'checks' && (
        <div className="nxs-dc-body">
          <div className="nxs-checks-head">
            <div className="nxs-checks-title">
              <strong>Automated Verification</strong>
              <span>
                {checks.running
                  ? 'Running checks…'
                  : checks.lastRunAt
                    ? `Last run ${new Date(checks.lastRunAt).toLocaleTimeString()}`
                    : 'Syntax, esbuild bundle, asset integrity & runtime'}
              </span>
            </div>
            <div className="nxs-checks-actions">
              <button
                type="button"
                className="nxs-mini-btn"
                disabled={checks.running || totalWorkspaceFiles === 0}
                onClick={() => runChecks({ includeServer: false })}
              >
                <IconRefresh size={12} /> {checks.running ? 'Checking…' : 'Run Checks'}
              </button>
              {runtimeReady && project && (
                <button
                  type="button"
                  className="nxs-mini-btn primary"
                  disabled={checks.running || totalWorkspaceFiles === 0}
                  onClick={async () => {
                    await runChecks({ includeServer: true });
                    request(`studio/projects/${project.id}/runs`, { timeout: 15_000 })
                      .then((d) => setServerRuns(d.runs || []))
                      .catch(() => {});
                  }}
                >
                  <IconPlay size={11} /> Run Build &amp; Tests
                </button>
              )}
              {failedLogs && !agent.running && (
                <button
                  type="button"
                  className="nxs-mini-btn primary"
                  onClick={() => fixWithAI(failedLogs)}
                >
                  <IconSpark size={12} /> Fix with AI
                </button>
              )}
            </div>
          </div>

          {checks.items.length === 0 ? (
            <div className="nxs-dc-empty">
              <div className="nxs-dc-empty-icon"><IconShieldCheck size={22} /></div>
              <h3>Ready to verify</h3>
              <p>Run real compilation, JSON/HTML asset validation, runtime error inspection, and test execution against your project files.</p>
              {totalWorkspaceFiles > 0 && (
                <button type="button" className="nxs-btn primary" onClick={() => runChecks({ includeServer: runtimeReady })}>
                  <IconShieldCheck size={14} /> Run Checks Now
                </button>
              )}
            </div>
          ) : (
            <div className="nxs-checks-list">
              {checks.items.map((item) => (
                <div key={item.id} className={`nxs-check-row status-${item.status}`}>
                  <div className="nxs-check-main">
                    <span className={`nxs-check-icon ${item.status}`} aria-label={item.status}>
                      {item.status === 'pass' ? <IconCheck size={13} />
                        : item.status === 'fail' ? <IconX size={13} />
                        : item.status === 'warn' ? <IconWarn size={13} />
                        : '…'}
                    </span>
                    <div className="nxs-check-text">
                      <div className="nxs-check-name">{item.name}</div>
                      <div className="nxs-check-detail">{item.detail}</div>
                    </div>
                    <span className="nxs-check-ms mono">
                      {item.status === 'running' ? 'running' : `${item.durationMs || 0}ms`}
                    </span>
                  </div>
                  {item.logs && (
                    <pre className="nxs-check-logs">{item.logs}</pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {serverRuns.length > 0 && (
            <div className="nxs-checks-runs">
              <h4>Recent Command Runs</h4>
              {serverRuns.slice(0, 6).map((r) => (
                <div key={r.id} className="nxs-run-row">
                  <span className={`nxs-dc-dot ${r.exitCode === 0 ? 'pass' : r.status === 'running' ? 'warn' : 'fail'}`} />
                  <code className="nxs-run-cmd">{r.command}</code>
                  <span className="nxs-run-meta">
                    {r.exitCode === 0 ? 'exit 0' : r.exitCode !== null ? `exit ${r.exitCode}` : r.status}
                    {r.durationMs ? ` · ${Math.round(r.durationMs)}ms` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================== REVISIONS VIEW ========================= */}
      {section === 'history' && (
        <div className="nxs-dc-body">
          {!revisions || revisions.length === 0 ? (
            <div className="nxs-dc-empty">
              <div className="nxs-dc-empty-icon"><IconHistory size={22} /></div>
              <h3>No revisions yet</h3>
              <p>Every AI update, accepted review, and manual save records a restore point you can diff against or roll back to.</p>
            </div>
          ) : (
            <div className="nxs-rev-list">
              {revisions.map((rev) => (
                <div key={rev.id} className="nxs-rev-row">
                  <div className="nxs-rev-info">
                    <div className="nxs-rev-label">{rev.label || `Revision #${rev.id}`}</div>
                    <div className="nxs-rev-date">
                      #{rev.id} · {rev.createdAt ? new Date(rev.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                  <div className="nxs-rev-actions">
                    <button
                      type="button"
                      className="nxs-mini-btn"
                      onClick={async () => {
                        await handleBaselineSelect(String(rev.id));
                        switchSection('diff');
                      }}
                    >
                      <IconDiff size={12} /> Diff
                    </button>
                    <button
                      type="button"
                      className="nxs-mini-btn"
                      onClick={() => restoreRevision(rev.id)}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
