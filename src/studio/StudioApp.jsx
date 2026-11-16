import { useEffect, useMemo, useState } from 'react';
import { StudioProvider, useStudio } from './state.jsx';
import { loginWithPassword } from './api.js';
import ProjectsPanel from './ProjectsPanel.jsx';
import ChatPanel from './ChatPanel.jsx';
import Workspace from './Workspace.jsx';
import AgentWindow from './AgentWindow.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import {
  IconPlus, IconGear, IconSpark, IconSave, IconRocket, IconCommand,
  IconEye, IconCode, IconTerminal, IconPlay, IconLayers, IconWarn, IconRefresh, IconMenu, IconX,
} from './icons.jsx';
import './studio.css';

const STACK_LABEL = { static: 'HTML/CSS/JS', 'vite-react': 'React', node: 'Node', next: 'Next.js' };

/* --------------------------------- gate ---------------------------------- */
function AuthGate() {
  const { boot } = useStudio();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await loginWithPassword(username.trim(), password);
      await boot();
    } catch (err) {
      setError(err.code === 'invalid_credentials' ? 'Wrong username or password.' : (err.detail || err.code || 'Sign-in failed'));
    } finally { setBusy(false); }
  };

  return (
    <div className="nxs">
      <div className="nxs-auth">
        <form className="nxs-auth-card" onSubmit={submit}>
          <div className="nxs-brand" style={{ marginBottom: 16 }}>
            <span className="nxs-mark">N</span>
            <div><b>NEXORA Studio</b><small>AI APP BUILDER</small></div>
          </div>
          <h2>Sign in to build</h2>
          <p>Your projects, keys and deployments are tied to your NEXORA account.</p>
          {error && <div className="nxs-error-box">{error}</div>}
          <div className="field">
            <label htmlFor="nxs-user">Username</label>
            <input id="nxs-user" className="nxs-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="nxs-pass">Password</label>
            <input id="nxs-pass" className="nxs-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="nxs-btn primary" style={{ width: '100%', marginTop: 6 }} disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="nxs-btn ghost"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => window.dispatchEvent(new CustomEvent('nxs-open-chat'))}
          >
            Create an account / other sign-in options
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------- palette --------------------------------- */
function Palette() {
  const {
    paletteOpen, setPaletteOpen, projects, openProject, createProject, saveNow,
    setTab, setSettingsOpen, setActiveFile, files, startDev, fixWithAI, terminal, agent,
  } = useStudio();
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);

  const commands = useMemo(() => {
    const base = [
      { id: 'new', label: 'New project', icon: IconPlus, run: () => createProject({}) },
      { id: 'save', label: 'Save project (restore point)', icon: IconSave, run: () => saveNow() },
      { id: 'preview', label: 'Go to Preview', icon: IconEye, run: () => setTab('preview') },
      { id: 'code', label: 'Go to Code', icon: IconCode, run: () => setTab('code') },
      { id: 'terminal', label: 'Go to Terminal', icon: IconTerminal, run: () => setTab('terminal') },
      { id: 'publish', label: 'Go to Publish', icon: IconRocket, run: () => setTab('publish') },
      { id: 'dev', label: 'Start dev server', icon: IconPlay, run: () => startDev() },
      { id: 'fix', label: 'Fix last failure with AI', icon: IconWarn, run: () => fixWithAI(terminal.logs), disabled: !terminal.error || agent.running },
      { id: 'settings', label: 'Open settings', icon: IconGear, run: () => setSettingsOpen(true) },
    ];
    const filesCmds = Object.keys(files || {}).map((path) => ({
      id: `file:${path}`, label: `Open ${path}`, icon: IconCode, run: () => { setActiveFile(path); setTab('code'); },
    }));
    const projCmds = (projects || []).map((p) => ({
      id: `proj:${p.id}`, label: `Switch to ${p.name}`, icon: IconLayers, run: () => openProject(p.id),
    }));
    return [...base, ...filesCmds, ...projCmds];
  }, [agent.running, createProject, files, fixWithAI, openProject, projects, saveNow, setActiveFile, setSettingsOpen, setTab, startDev, terminal.error, terminal.logs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? commands.filter((c) => c.label.toLowerCase().includes(term)) : commands;
    return list.slice(0, 40);
  }, [commands, q]);

  useEffect(() => { setIndex(0); }, [q, paletteOpen]);
  if (!paletteOpen) return null;

  const exec = (cmd) => {
    if (!cmd || cmd.disabled) return;
    setPaletteOpen(false);
    setQ('');
    cmd.run();
  };

  return (
    <div className="nxs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPaletteOpen(false); }}>
      <div className="nxs-modal nxs-palette" style={{ background: 'transparent', border: 0, boxShadow: 'none' }}>
        <input
          className="nxs-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search commands, files and projects…"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, filtered.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); exec(filtered[index]); }
            if (e.key === 'Escape') setPaletteOpen(false);
          }}
        />
        <div className="nxs-palette-list">
          {filtered.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                className={`nxs-palette-item ${i === index ? 'on' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => exec(c)}
                disabled={c.disabled}
              >
                <Icon size={13} />
                <span>{c.label}</span>
                {i === index && <kbd>↵</kbd>}
              </button>
            );
          })}
          {filtered.length === 0 && <div className="nxs-palette-item">No match</div>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- topbar ---------------------------------- */
function TopBar() {
  const {
    project, renameProject, createProject, setSettingsOpen, session, dirty, saving,
    sidebarOpen, setSidebarOpen, panelOpen, setPanelOpen, tab, files,
  } = useStudio();
  const [name, setName] = useState(project?.name || '');
  useEffect(() => { setName(project?.name || ''); }, [project?.id, project?.name]);

  const commit = () => {
    const next = name.trim();
    if (project && next && next !== project.name) renameProject(project.id, next);
  };

  const fileCount = Object.keys(files || {}).length;
  const state = saving ? 'saving' : Object.keys(dirty || {}).length ? 'editing' : 'saved';

  return (
    <header className="nxs-top">
      <button
        className="nxs-icon-btn"
        aria-label="Projects"
        aria-expanded={sidebarOpen ? 'true' : 'false'}
        title="Projects"
        onClick={() => { setSidebarOpen(!sidebarOpen); if (!sidebarOpen) setPanelOpen(false); }}
      >
        <IconMenu size={15} />
      </button>

      <button className="nxs-brand" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} title="Command palette (Ctrl/⌘ K)">
        <span className="nxs-mark">N</span>
        <span className="nxs-brand-text">
          <b>NEXORA</b>
          <small>STUDIO</small>
        </span>
      </button>

      <div className="nxs-proj-title">
        {project ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            aria-label="Project name"
            placeholder="Project name"
          />
        ) : <span className="nxs-faint">New project</span>}
      </div>

      <div className="nxs-top-actions">
        {project && (
          <span className={`nxs-status ${state === 'saved' ? 'ok' : 'warn'}`} title={state === 'saved' ? 'Everything is saved' : 'Changes are being saved'}>
            <span className="nxs-dot" /> <span className="nxs-status-text">{state}</span>
          </span>
        )}
        {project && fileCount > 0 && (
          <button
            className={`nxs-artifact-btn ${panelOpen ? 'on' : ''}`}
            onClick={() => setPanelOpen(!panelOpen)}
            aria-expanded={panelOpen ? 'true' : 'false'}
            title={panelOpen ? 'Back to the conversation' : 'Open the build'}
          >
            {tab === 'code' ? <IconCode size={13} /> : tab === 'terminal' ? <IconTerminal size={13} /> : tab === 'publish' ? <IconRocket size={13} /> : <IconEye size={13} />}
            <span>{tab === 'code' ? 'Code' : tab === 'terminal' ? 'Terminal' : tab === 'publish' ? 'Publish' : 'Preview'}</span>
            <span className="nxs-artifact-count">{fileCount}</span>
          </button>
        )}
        <button className="nxs-icon-btn hide-mobile" onClick={() => createProject({})} title="New project" aria-label="New project">
          <IconPlus size={15} />
        </button>
        <button className="nxs-icon-btn" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Settings">
          <IconGear size={15} />
        </button>
        <span className="nxs-avatar" title={session?.user?.username || 'workspace'}>
          {session?.user?.avatarUrl
            ? <img src={session.user.avatarUrl} alt="" />
            : (session?.user?.username || 'N').slice(0, 1).toUpperCase()}
        </span>
      </div>
    </header>
  );
}

/* ------------------------------- shell ----------------------------------- */
function Shell() {
  const {
    booting, bootError, boot, project, sidebarOpen, setSidebarOpen,
    settingsOpen, toast, panelOpen, closePanel,
  } = useStudio();

  /* Escape backs out of whatever is open, like the assistant's panels */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (panelOpen) closePanel();
      else if (sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel, sidebarOpen, setSidebarOpen]);

  /* Android and iOS do not all resize the layout viewport when the keyboard
     opens; measuring it keeps the composer above the keyboard everywhere. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const apply = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--nxs-kb', `${Math.round(covered)}px`);
      document.documentElement.style.setProperty('--nxs-vvh', `${Math.round(vv.height)}px`);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => { vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply); };
  }, []);

  if (booting) {
    return (
      <div className="nxs">
        <div className="nxs-loading">
          <div>
            <div className="spin" />
            Opening the workspace…
          </div>
        </div>
      </div>
    );
  }

  if (bootError?.code === 'unauthorized') return <AuthGate />;

  if (bootError) {
    return (
      <div className="nxs">
        <div className="nxs-auth">
          <div className="nxs-auth-card">
            <h2>Studio could not start</h2>
            <p>{bootError.code === 'storage_unavailable'
              ? 'The project database is unavailable on this deployment.'
              : 'The Studio API answered with an error.'}</p>
            {bootError.detail && <div className="nxs-error-box">{bootError.detail}</div>}
            <button className="nxs-btn primary" onClick={() => boot()} style={{ width: '100%' }}>
              <IconRefresh size={13} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`nxs ${panelOpen ? 'has-panel' : ''}`}>
      <TopBar />
      <div className="nxs-body">
        <ChatPanel />
      </div>

      {project && <Workspace />}

      <ProjectsPanel />
      <div
        className={`nxs-scrim sidebar ${sidebarOpen ? 'on' : ''}`}
        aria-hidden={sidebarOpen ? 'false' : 'true'}
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`nxs-scrim panel ${panelOpen ? 'on' : ''}`}
        aria-hidden={panelOpen ? 'false' : 'true'}
        onClick={() => closePanel()}
      />

      {settingsOpen && <SettingsPanel />}
      <Palette />
      {toast && <div className={`nxs-toast ${toast.tone}`}>{toast.text}</div>}
    </div>
  );
}

export default function StudioApp() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}
