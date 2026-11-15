import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from './state.jsx';
import { buildPreview, previewKind } from './preview/bundler.js';
import {
  IconRefresh, IconExternal, IconMonitor, IconTablet, IconPhone, IconTerminal,
  IconPlay, IconSquare, IconWarn, IconEye,
} from './icons.jsx';

const DEVICES = [
  { id: 'responsive', label: 'Responsive', icon: IconMonitor },
  { id: 'tablet', label: 'Tablet', icon: IconTablet },
  { id: 'phone', label: 'Phone', icon: IconPhone },
];

export default function PreviewPane() {
  const {
    files, project, previewNonce, previewMode, switchPreview,
    devServer, startDev, stopDev, consoleEntries, logConsole, setTab, agent,
  } = useStudio();
  const [built, setBuilt] = useState({ html: '', error: null, kind: 'empty', warnings: [] });
  const [building, setBuilding] = useState(false);
  const [device, setDevice] = useState('responsive');
  const [showConsole, setShowConsole] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const buildSeq = useRef(0);
  const filesRef = useRef(files);
  filesRef.current = files;

  const kind = useMemo(() => previewKind(files), [files]);

  const runBuild = useCallback(async () => {
    const seq = ++buildSeq.current;
    if (!Object.keys(filesRef.current).length) {
      setBuilt({ html: '', error: null, kind: 'empty', warnings: [] });
      return;
    }
    setBuilding(true);
    try {
      const result = await buildPreview(filesRef.current, { title: project?.name || 'Preview' });
      if (seq !== buildSeq.current) return;
      setBuilt({ html: result.html, error: null, kind: result.kind, warnings: result.warnings || [] });
      setFrameKey((k) => k + 1);
    } catch (e) {
      if (seq !== buildSeq.current) return;
      setBuilt((b) => ({ ...b, error: e.message || String(e), kind }));
    } finally {
      if (seq === buildSeq.current) setBuilding(false);
    }
  }, [kind, project?.name]);

  /* rebuild on file changes (debounced) and on demand */
  useEffect(() => {
    if (previewMode !== 'bundle') return;
    const timer = setTimeout(runBuild, 420);
    return () => clearTimeout(timer);
  }, [files, previewNonce, previewMode, runBuild]);

  /* console bridge from the preview iframe */
  useEffect(() => {
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.source !== 'nxs-preview') return;
      logConsole({ level: data.level || 'log', args: Array.isArray(data.args) ? data.args : [String(data.args)], at: Date.now() });
      if (data.level === 'error') setShowConsole(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [logConsole]);

  const refresh = () => {
    if (previewMode === 'server') setFrameKey((k) => k + 1);
    else runBuild();
  };

  const openExternal = () => {
    if (previewMode === 'server' && devServer.url) window.open(devServer.url, '_blank', 'noopener');
    else {
      const blob = new Blob([built.html], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    }
  };

  const errors = consoleEntries.filter((c) => c.level === 'error').length;
  const src = previewMode === 'server' ? devServer.url : null;
  const cannotPreview = kind === 'server' && previewMode === 'bundle';

  return (
    <div className="nxs-preview">
      <div className="nxs-preview-bar">
        <span className="nxs-url" title={src || 'Built in your browser — no server round-trip'}>
          <IconEye size={12} />
          {previewMode === 'server'
            ? (devServer.url || 'dev server not running')
            : kind === 'empty' ? 'no files yet' : `${kind} · built in browser`}
        </span>
        <div className="nxs-devices" role="group" aria-label="Preview width">
          {DEVICES.map((d) => {
            const Icon = d.icon;
            return (
              <button key={d.id} className={device === d.id ? 'on' : ''} title={d.label} onClick={() => setDevice(d.id)}>
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        <button className="nxs-btn icon sm" title="Reload preview" onClick={refresh}><IconRefresh size={13} /></button>
        <button className="nxs-btn icon sm" title="Open in a new tab" onClick={openExternal}><IconExternal size={13} /></button>
        {previewMode === 'server' ? (
          <button className="nxs-btn sm" onClick={stopDev} title="Stop the dev server"><IconSquare size={11} /> Stop</button>
        ) : (
          <button
            className="nxs-btn sm"
            title="Start a real dev server for this project"
            onClick={() => startDev()}
            disabled={devServer.starting || !Object.keys(files).length}
          >
            <IconPlay size={11} /> {devServer.starting ? 'Starting…' : 'Dev server'}
          </button>
        )}
        <button className={`nxs-btn icon sm ${showConsole ? 'primary' : ''}`} title="Console output" onClick={() => setShowConsole((v) => !v)}>
          <IconTerminal size={13} />
        </button>
      </div>

      <div className="nxs-frame-wrap">
        {previewMode === 'server' ? (
          devServer.url
            ? <iframe key={frameKey} className={`nxs-frame ${device}`} src={devServer.url} title="Dev server preview" />
            : (
              <div className="nxs-empty-state">
                <b>No dev server running</b>
                <span>{devServer.error || 'Start one to preview server-side apps (Node, Next.js) with real output.'}</span>
                <button className="nxs-btn primary" onClick={() => startDev()} disabled={devServer.starting}>
                  <IconPlay size={12} /> {devServer.starting ? 'Starting…' : 'Start dev server'}
                </button>
                <button className="nxs-btn ghost sm" onClick={() => switchPreview('bundle')}>Use the built preview instead</button>
              </div>
            )
        ) : built.error ? (
          <div className="nxs-frame-error">
            <b style={{ display: 'block', marginBottom: 6 }}>Preview build failed</b>
            {built.error}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="nxs-btn sm" onClick={() => setTab('code')} style={{ borderColor: 'rgba(251,113,133,.4)' }}>Open the code</button>
              <button className="nxs-btn sm" onClick={() => startDev()} style={{ borderColor: 'rgba(251,113,133,.4)' }}>Try a dev server</button>
            </div>
          </div>
        ) : cannotPreview ? (
          <div className="nxs-empty-state">
            <b>Server app</b>
            <span>This project needs Node to run (Next.js / server routes). Start the dev server or deploy it.</span>
            <button className="nxs-btn primary" onClick={() => startDev()} disabled={devServer.starting}>
              <IconPlay size={12} /> {devServer.starting ? 'Starting…' : 'Start dev server'}
            </button>
          </div>
        ) : kind === 'empty' ? (
          <div className="nxs-empty-state">
            <b>Nothing to preview yet</b>
            <span>Describe your app in the chat — the preview updates as files land.</span>
          </div>
        ) : (
          <iframe
            key={frameKey}
            className={`nxs-frame ${device}`}
            title="Live preview"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
            srcDoc={built.html}
          />
        )}
        {building && previewMode === 'bundle' && (
          <span className="nxs-chip violet" style={{ position: 'absolute', insetInlineEnd: 16, insetBlockStart: 58 }}>
            <span className="nxs-dot live" /> compiling
          </span>
        )}
      </div>

      {showConsole && (
        <div className="nxs-console">
          {consoleEntries.length === 0 && <div className="nxs-console-line"><span className="lv">info</span><span className="msg">Console output from the preview appears here.</span></div>}
          {consoleEntries.slice(-80).map((c, i) => (
            <div key={i} className={`nxs-console-line ${c.level}`}>
              <span className="lv">{c.level}</span>
              <span className="msg">{c.args.join(' ')}</span>
            </div>
          ))}
        </div>
      )}

      {!showConsole && errors > 0 && (
        <button className="nxs-term-status" onClick={() => setShowConsole(true)} style={{ color: 'var(--red)', justifyContent: 'flex-start' }}>
          <IconWarn size={12} /> {errors} console error{errors > 1 ? 's' : ''} in the preview — click to inspect
        </button>
      )}
      {built.warnings?.length > 0 && (
        <div className="nxs-term-status" title={built.warnings.join('\n')} style={{ color: 'var(--amber)' }}>
          <IconWarn size={12} /> {built.warnings[0]}{built.warnings.length > 1 ? ` (+${built.warnings.length - 1})` : ''}
        </div>
      )}
      {agent.running && (
        <div className="nxs-term-status">
          <span className="nxs-dot live" /> the agent is writing files — the preview follows automatically
        </div>
      )}
    </div>
  );
}
