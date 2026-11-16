import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from './state.jsx';
import { IconCheck, IconCode, IconEye, IconFile, IconSpark, IconStop, IconWarn } from './icons.jsx';

/* ============================================================================
   The running window
   ----------------------------------------------------------------------------
   Like the assistant's activity panel: the moment a build starts, a small live
   window opens over the workspace and shows, for real, what the agent is doing —
   the current step and round, a progress bar against the plan, the code of the
   file being written (streamed by the server while the model is still typing),
   and every file as it lands.

   It is part of the conversation — the card sits where the answer is being
   written, collapses when the run ends, and never floats over the composer.
   ============================================================================ */

const STEP_TEXT = {
  plan: 'Planning the build',
  create: 'Writing the files',
  continue: 'Writing the next files',
  edit: 'Editing the project',
  fix: 'Fixing the failure',
};

export default function AgentWindow() {
  const { agent, project, files, setTab, setActiveFile, stopAgent } = useStudio();
  const [collapsed, setCollapsed] = useState(false);
  const codeRef = useRef(null);

  /* a new run re-opens the card, a finished one folds it down to the summary */
  useEffect(() => {
    if (agent.running) setCollapsed(false);
  }, [agent.running, agent.started]);

  /* keep the streamed code in view */
  useEffect(() => {
    const el = codeRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [agent.typing?.text]);

  const written = useMemo(() => (agent.activity || []).filter((a) => a.kind === 'file'), [agent.activity]);
  const planned = agent.plan?.files?.length || 0;
  const plannedWritten = useMemo(() => {
    if (!planned) return written.length;
    const have = new Set(Object.keys(files || {}));
    return (agent.plan.files || []).filter((f) => have.has(f.path)).length;
  }, [agent.plan, files, planned, written.length]);

  const lastFile = written.length ? written[written.length - 1].path : null;
  const typing = agent.typing;
  const pct = planned ? Math.min(100, Math.round((plannedWritten / planned) * 100)) : null;

  if (!agent.started && !agent.running) return null;

  const title = agent.running
    ? (STEP_TEXT[agent.step] || 'Working')
    : agent.error ? 'Stopped with an error'
      : agent.interrupted ? 'Build interrupted'
        : 'Build finished';

  const openFile = (path) => {
    if (!path) return;
    setActiveFile(path);
    setTab('code');
  };

  return (
    <section className={`nxs-agentwin ${collapsed ? 'collapsed' : ''}`} aria-label="Agent activity" data-running={agent.running ? '1' : '0'}>
      <header className="nxs-aw-head">
        <span className={`nxs-dot ${agent.running ? 'live' : agent.error ? 'err' : agent.interrupted ? 'warn' : 'ok'}`} />
        <b>{title}</b>
        {agent.running && agent.round ? (
          <span className="nxs-chip violet">
            {agent.round}{agent.maxRounds ? `/${agent.maxRounds}` : ''}
          </span>
        ) : null}
        {!agent.running && !agent.error && (
          <span className="nxs-chip ok"><IconCheck size={10} /> {written.length} files</span>
        )}
        <button className="nxs-icon-btn" onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'Show the details' : 'Hide the details'} aria-label={collapsed ? 'Expand activity' : 'Collapse activity'}>
          <span className="nxs-caret">{collapsed ? '▸' : '▾'}</span>
        </button>
      </header>

      {!collapsed && (
        <>
          {pct !== null && (
            <div className="nxs-aw-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </div>
          )}

          <div className="nxs-aw-body">
            {typing && (
              <div className="nxs-aw-code">
                <div className="nxs-aw-code-head">
                  <IconFile size={11} /> <code>{typing.path}</code>
                  <span className="nxs-aw-caret" aria-hidden="true" />
                </div>
                <pre ref={codeRef}>{typing.text}</pre>
              </div>
            )}
            {written.length ? (
              <div className="nxs-aw-files">
                {written.slice(-8).reverse().map((a) => (
                  <button key={`${a.path}-${a.at}`} className="nxs-aw-file" onClick={() => openFile(a.path)} title="Open in the editor">
                    <IconCheck size={11} /><span>{a.path}</span>
                  </button>
                ))}
              </div>
            ) : !typing && (
              <div className="nxs-aw-idle">
                <IconSpark size={13} />
                <span>{agent.running ? 'Reading the request and planning the files…' : 'Nothing written yet.'}</span>
              </div>
            )}

            {agent.running && agent.prose && !typing && (
              <p className="nxs-aw-prose">{agent.prose.slice(-320)}</p>
            )}
            {!agent.running && agent.error && (
              <p className="nxs-aw-note err"><IconWarn size={12} /> {agent.error}</p>
            )}
            {!agent.running && !agent.error && (agent.lastNotes || []).length > 0 && (
              <p className="nxs-aw-note warn"><IconWarn size={12} /> {(agent.lastNotes || []).join(' · ')}</p>
            )}
          </div>

          <footer className="nxs-aw-foot">
            <button className="nxs-btn sm" onClick={() => openFile(typing?.path || lastFile || project?.entry)} disabled={!typing && !lastFile && !project?.entry}>
              <IconCode size={11} /> Code
            </button>
            <button className="nxs-btn sm" onClick={() => setTab('preview')}>
              <IconEye size={11} /> Preview
            </button>
            <span className="nxs-aw-count">{Object.keys(files || {}).length} files · {project?.stack || 'draft'}</span>
            {agent.running && (
              <button className="nxs-btn sm danger" onClick={stopAgent}><IconStop size={11} /> Stop</button>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
