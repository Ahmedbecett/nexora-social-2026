import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from './state.jsx';
import { IconPlay, IconRefresh, IconTrash, IconWarn, IconSpark, IconTerminal } from './icons.jsx';

const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '');

function scriptOf(files, name) {
  try {
    const pkg = JSON.parse(files['package.json'] || '{}');
    return pkg.scripts?.[name] || null;
  } catch { return null; }
}

export default function TerminalPane() {
  const { terminal, runTerminal, clearTerminal, project, files, startDev, devServer, fixWithAI, agent } = useStudio();
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [histIndex, setHistIndex] = useState(-1);
  const logRef = useRef(null);

  const stack = project?.stack || 'static';
  const isWeb = stack === 'vite-react' || stack === 'next';
  const hasPkg = Boolean(files['package.json']);
  const testScript = scriptOf(files, 'test');

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [terminal.logs]);

  const run = (cmd, kind = 'exec') => {
    if (!cmd || terminal.running) return;
    setHistory((h) => [...h, cmd].slice(-40));
    setHistIndex(-1);
    runTerminal(cmd, kind);
    setCommand('');
  };

  const logLines = useMemo(() => stripAnsi(terminal.logs).split('\n').slice(-800), [terminal.logs]);

  return (
    <div className="nxs-term">
      <div className="nxs-panel-bar">
        <span className="nxs-kicker"><IconTerminal size={12} style={{ verticalAlign: -2 }} /> Terminal</span>
        <span className={`nxs-chip ${terminal.running ? 'warn' : 'ok'}`}>
          <span className={`nxs-dot ${terminal.running ? 'warn' : 'ok'}`} />
          {terminal.engine || 'engine'} {terminal.running ? '· running' : '· idle'}
        </span>
        <span className="spacer" />
        {hasPkg && (
          <button className="nxs-btn sm" disabled={terminal.running} onClick={() => run('npm install', 'install')}>
            <IconRefresh size={11} /> Install
          </button>
        )}
        {isWeb && (
          <button className="nxs-btn sm" disabled={terminal.running} onClick={() => run('npm run build', 'build')}>
            <IconPlay size={11} /> Build
          </button>
        )}
        {testScript && (
          <button className="nxs-btn sm" disabled={terminal.running} onClick={() => run('npm test', 'test')}>
            Test
          </button>
        )}
        <button className="nxs-btn sm" disabled={terminal.running || devServer.starting} onClick={() => startDev()}>
          <IconPlay size={11} /> Dev server
        </button>
        <button className="nxs-btn icon sm" title="Clear" onClick={clearTerminal}><IconTrash size={12} /></button>
      </div>

      <div className="nxs-term-log" ref={logRef}>
        {terminal.logs
          ? logLines.map((line, i) => {
            let cls = '';
            if (line.startsWith('$ ')) cls = 'cmd';
            else if (/^(✗|Error|error:|ERR!|npm ERR)/.test(line) || /\[exit [1-9]/.test(line)) cls = 'err';
            else if (/\[exit 0/.test(line)) cls = 'ok';
            return <span key={i} className={cls}>{line}{'\n'}</span>;
          })
          : (
            <div className="nxs-faint" style={{ lineHeight: 2 }}>
              {stack === 'static'
                ? 'Static project — no build step is required. Use the command line below, or start a dev server to serve the files for real.'
                : 'Run install / build / test, start the dev server, or type any shell command.'}
              {'\n'}Commands execute in an isolated project folder on the Studio host ({' '}
              <span className="nxs-chip">{terminal.engine || 'local runner'}</span> ) and the real output lands here.
            </div>
          )}
      </div>

      {terminal.error && (
        <div className="nxs-term-status" style={{ color: 'var(--red)', flexWrap: 'wrap' }}>
          <IconWarn size={12} /> {terminal.error}
          <button className="nxs-btn sm" style={{ marginInlineStart: 'auto' }} onClick={() => fixWithAI(terminal.logs)} disabled={agent.running}>
            <IconSpark size={11} /> Fix with AI
          </button>
        </div>
      )}

      <div className="nxs-term-input">
        <span className="prompt">{project ? project.name.slice(0, 14).replace(/\s+/g, '-') : 'studio'} $</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="npm run dev · ls -la · git status"
          disabled={terminal.running}
          spellCheck={false}
          aria-label="Terminal command"
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); run(command.trim()); }
            else if (e.key === 'ArrowUp') {
              e.preventDefault();
              const i = histIndex < 0 ? history.length - 1 : Math.max(0, histIndex - 1);
              if (history[i] !== undefined) { setHistIndex(i); setCommand(history[i]); }
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              const i = histIndex < 0 ? -1 : histIndex + 1;
              if (i >= history.length) { setHistIndex(-1); setCommand(''); }
              else { setHistIndex(i); setCommand(history[i]); }
            }
          }}
        />
        <button className="nxs-btn sm primary" disabled={terminal.running || !command.trim()} onClick={() => run(command.trim())}>
          Run
        </button>
      </div>

      <div className="nxs-term-status">
        <span>engine: {terminal.engine || '—'}</span>
        {terminal.runId && <span>run #{terminal.runId}</span>}
        {terminal.exitCode !== null && terminal.exitCode !== undefined && (
          <span style={{ color: terminal.exitCode === 0 ? 'var(--green)' : 'var(--red)' }}>exit {terminal.exitCode}</span>
        )}
        {terminal.durationMs ? <span>{terminal.durationMs} ms</span> : null}
        {terminal.command && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{terminal.command}</span>}
        {terminal.previewUrl && <a href={terminal.previewUrl} target="_blank" rel="noreferrer">preview ↗</a>}
      </div>
    </div>
  );
}
