/* ============================================================================
   NEXORA — Live Multi-Step Agent Orchestration Card
   Displays the real execution pipeline (Planning → Orchestrating → Working →
   Completed), live streaming code as each file is written, written file chips,
   interruption/error diagnostics, and direct "View All Changes" access.
   ============================================================================ */

import { useEffect, useState } from 'react';
import { useStudio } from './state.jsx';
import {
  IconCheck, IconCode, IconDiff, IconStop, IconRefresh,
  IconChevronDown, IconShieldCheck, IconWarn,
} from './icons.jsx';

const STAGES = [
  { id: 'planning', label: 'Planning' },
  { id: 'orchestrating', label: 'Orchestrating' },
  { id: 'working', label: 'Working' },
  { id: 'completed', label: 'Completed' },
];

const STAGE_ORDER = { planning: 0, orchestrating: 1, working: 2, completed: 3 };

function formatElapsed(ms) {
  const sec = Math.max(0, Math.round(ms / 100) / 10);
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export default function AgentWindow() {
  const {
    agent, projectDiff, stopAgent, resumeBuild,
    setActiveFile, setOpenFiles, setTab, openDiffView, openChecksView, runChecks,
  } = useStudio();

  const [expanded, setExpanded] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!agent.running) return undefined;
    setExpanded(true);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [agent.running]);

  const writtenFiles = [...new Set(
    (agent.activity || []).filter((a) => a.kind === 'file').map((a) => a.path),
  )];
  const deletedFiles = [...new Set(
    (agent.activity || []).filter((a) => a.kind === 'delete').map((a) => a.path),
  )];

  const hasContent = agent.running
    || Boolean(agent.typing)
    || writtenFiles.length > 0
    || deletedFiles.length > 0
    || Boolean(agent.error)
    || agent.interrupted;

  if (!hasContent) return null;

  const phase = agent.running
    ? (agent.phase === 'idle' || !agent.phase ? 'working' : agent.phase)
    : (agent.error ? 'error' : agent.interrupted ? 'interrupted' : agent.stopped ? 'stopped' : 'completed');

  const activeIdx = STAGE_ORDER[phase] ?? (phase === 'completed' ? 3 : 2);
  const elapsedMs = agent.running && agent.started
    ? Math.max(0, now - agent.started)
    : (agent.durationMs || 0);

  let headline = 'Working';
  if (phase === 'planning') headline = 'Planning';
  else if (phase === 'orchestrating') {
    headline = agent.round > 1 ? `Orchestrating · Round ${agent.round}` : 'Orchestrating';
  } else if (phase === 'working') {
    headline = agent.typing?.path ? `Writing ${agent.typing.path}` : 'Working';
  } else if (phase === 'completed') {
    headline = 'Completed · Build finished';
  } else if (phase === 'interrupted') {
    headline = 'Build interrupted';
  } else if (phase === 'stopped') {
    headline = 'Stopped';
  } else if (phase === 'error') {
    headline = 'Execution failed';
  }

  const openFileInEditor = (path) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    setTab('code');
  };

  return (
    <section
      className={`nxs-agentwin phase-${phase}${agent.running ? ' running' : ''}`}
      aria-live="polite"
      aria-label="Agent execution status"
    >
      {/* Top status bar */}
      <div className="nxs-aw-head">
        <button
          type="button"
          className="nxs-aw-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className={`nxs-aw-dot ${phase}`} aria-hidden="true">
            {phase === 'completed' ? <IconCheck size={11} /> : phase === 'error' ? <IconWarn size={11} /> : null}
          </span>
          <span className="nxs-aw-title">{headline}</span>
          {elapsedMs > 0 && <span className="nxs-aw-time">{formatElapsed(elapsedMs)}</span>}
          <IconChevronDown size={14} className={`nxs-aw-chev${expanded ? ' open' : ''}`} />
        </button>

        <div className="nxs-aw-actions">
          {agent.running ? (
            <button type="button" className="nxs-mini-btn danger" onClick={stopAgent}>
              <IconStop size={12} /> Stop
            </button>
          ) : phase === 'interrupted' && agent.pending > 0 ? (
            <button type="button" className="nxs-mini-btn primary" onClick={resumeBuild}>
              <IconRefresh size={12} /> Continue build
            </button>
          ) : (writtenFiles.length > 0 || projectDiff?.hasChanges) ? (
            <>
              <button
                type="button"
                className="nxs-mini-btn"
                onClick={() => openDiffView(null, { all: true })}
              >
                <IconDiff size={12} /> View All Changes
              </button>
              <button
                type="button"
                className="nxs-mini-btn ghost"
                title="Run verification checks"
                onClick={() => { openChecksView(); runChecks({ includeServer: false }); }}
              >
                <IconShieldCheck size={12} /> Checks
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* 4-stage execution pipeline: Planning → Orchestrating → Working → Completed */}
      <div className="nxs-aw-stages" role="list" aria-label="Execution phases">
        {STAGES.map((st, idx) => {
          const isDone = phase === 'completed' || (agent.running && idx < activeIdx);
          const isCurrent = agent.running && idx === activeIdx;
          return (
            <div
              key={st.id}
              role="listitem"
              className={`nxs-aw-stage${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`}
            >
              <span className="nxs-aw-stage-pip" />
              <span className="nxs-aw-stage-name">{st.label}</span>
            </div>
          );
        })}
      </div>

      {expanded && (
        <div className="nxs-aw-body">
          {/* Live prose while planning/thinking */}
          {agent.running && agent.prose && !agent.typing && (
            <p className="nxs-aw-prose" dir="auto">{agent.prose.slice(-420)}</p>
          )}

          {/* Plan checklist summary */}
          {agent.plan?.steps?.length > 0 && agent.running && (
            <div className="nxs-aw-steps">
              {agent.plan.steps.slice(0, 5).map((step, i) => (
                <div key={i} className="nxs-aw-step">
                  <span className="nxs-aw-step-idx">{i + 1}</span>
                  <span dir="auto">{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Live streaming file window */}
          {agent.typing && (
            <div className="nxs-aw-code">
              <div className="nxs-aw-code-head">
                <span className="nxs-aw-code-path">
                  <IconCode size={13} />
                  <span>{agent.typing.path}</span>
                </span>
                <span className="nxs-aw-code-meta">
                  {agent.typing.text.split('\n').length} lines · streaming
                </span>
              </div>
              <pre><code>{agent.typing.text.slice(-3600)}</code></pre>
            </div>
          )}

          {/* Error diagnostics */}
          {agent.error && agent.error !== 'ai_not_configured' && (
            <div className="nxs-aw-error" role="alert">
              <IconWarn size={15} />
              <span>{agent.error}</span>
            </div>
          )}

          {/* Written & deleted file list */}
          {(writtenFiles.length > 0 || deletedFiles.length > 0) && (
            <div className="nxs-aw-files">
              {writtenFiles.map((path) => {
                const df = projectDiff?.files?.find((f) => f.path === path);
                return (
                  <button
                    key={path}
                    type="button"
                    className="nxs-aw-file"
                    onClick={() => openFileInEditor(path)}
                    title={`Open ${path} in editor`}
                  >
                    <IconCheck size={12} className="nxs-aw-file-ok" />
                    <span className="mono">{path}</span>
                    {df && (
                      <span className="nxs-aw-file-diff">
                        {df.added > 0 && <b className="add">+{df.added}</b>}
                        {df.removed > 0 && <b className="del">-{df.removed}</b>}
                      </span>
                    )}
                  </button>
                );
              })}
              {deletedFiles.map((path) => (
                <span key={`del-${path}`} className="nxs-aw-file deleted">
                  <span className="mono">{path}</span>
                  <span className="nxs-tag del">deleted</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
