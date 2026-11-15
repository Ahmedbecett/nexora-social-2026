import { useEffect, useMemo, useState } from 'react';
import { StudioProvider, useStudio } from './state.jsx';
import { loginWithPassword } from './api.js';
import ProjectsPanel from './ProjectsPanel.jsx';
import ChatPanel from './ChatPanel.jsx';
import Workspace from './Workspace.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import {
  IconPlus, IconGear, IconSearch, IconSpark, IconSave, IconRocket, IconCommand,
  IconEye, IconCode, IconTerminal, IconPlay, IconLayers, IconWarn, IconRefresh,
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
function TopBar({ onOpenProjects }) {
  const { project, renameProject, createProject, setSettingsOpen, session, dirty, saving } = useStudio();
  const [name, setName] = useState(project?.name || '');
  useEffect(() => { setName(project?.name || ''); }, [project?.id, project?.name]);

  const commit = () => {
    const next = name.trim();
    if (project && next && next !== project.name) renameProject(project.id, next);
  };

  return (
    <header className="nxs-top">
      <button className="nxs-brand" title="Projects" onClick={onOpenProjects} style={{ background: 'none' }}>
        <span className="nxs-mark">N</span>
        <span style={{ textAlign: 'start' }}>
          <b>NEXORA</b>
          <small>STUDIO</small>
        </span>
      </button>

      <div className="nxs-proj-title">
        {project ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Project name" />
            <span className="nxs-chip hide-sm">{STACK_LABEL[project.stack] || project.stack}</span>
            <span className={`nxs-chip ${saving ? 'warn' : Object.keys(dirty || {}).length ? 'warn' : 'ok'} hide-sm`}>
              {saving ? 'saving' : Object.keys(dirty || {}).length ? 'editing' : 'saved'}
            </span>
          </>
        ) : <span className="nxs-chip">new workspace</span>}
      </div>

      <div className="nxs-top-actions">
        <button className="nxs-btn sm hide-sm" onClick={() => createProject({})} title="New project">
          <IconPlus size={12} /> New
        </button>
        <button className="nxs-btn sm hide-sm" onClick={() => setSettingsOpen(true)} title="Settings">
          <IconGear size={13} /> Settings
        </button>
        <button className="nxs-btn sm" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))} title="Command palette (Ctrl+K)">
          <IconCommand size={13} />
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
    booting, bootError, boot, session, project, sidebarOpen, setSidebarOpen,
    settingsOpen, toast, setSettingsOpen,
  } = useStudio();
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 980 : false));
  const [mobileView, setMobileView] = useState('chat');

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 980);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
    <div className="nxs">
      <TopBar onOpenProjects={() => setSidebarOpen(!sidebarOpen)} />
      <div
        className={`nxs-body ${sidebarOpen ? '' : 'no-sidebar'} ${project ? '' : 'no-project'}`}
        data-mobile={mobileView}
      >
        {sidebarOpen && <ProjectsPanel />}
        <ChatPanel />
        {project && <Workspace onOpenSidebar={() => setSidebarOpen(!sidebarOpen)} />}
      </div>

      {mobile && (
        <div className="nxs-mobile-nav">
          <button className={mobileView === 'chat' ? 'on' : ''} onClick={() => setMobileView('chat')}>
            <IconSpark size={13} /> Chat
          </button>
          <button className={mobileView === 'workspace' ? 'on' : ''} onClick={() => setMobileView('workspace')}>
            <IconCode size={13} /> Build
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}>
            <IconLayers size={13} /> Projects
          </button>
        </div>
      )}

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
