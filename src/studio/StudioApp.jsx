/* ============================================================================
   NEXORA — Arena AI-Class Agent Platform Shell
   Editorial warm cream canvas · NEXORA brand identity · Collapsible sidebar ·
   Real-time AI Agent · Diff & Checks · GitHub, Drive, Docs & Vercel integrations ·
   Mobile-first keyboard & drawer ergonomics.
   ============================================================================ */

import { useEffect, useMemo, useState } from 'react';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource-variable/inter';

import { StudioProvider, useStudio } from './state.jsx';
import { loginWithPassword } from './api.js';
import PublicInfo from '../ai/PublicInfo.jsx';
import { isCapacitorNative } from '../platform.js';
import ProjectsPanel from './ProjectsPanel.jsx';
import ChatPanel from './ChatPanel.jsx';
import Workspace from './Workspace.jsx';
import LeaderboardView from './LeaderboardView.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import {
  NexoraLogo, IconSidebar, IconFiles, IconDiff, IconShieldCheck,
  IconSearch, IconNewChat, IconTrophy, IconCode, IconEye, IconTerminal,
  IconRocket, IconGear, IconChat, IconFolder, IconArchive, IconDoc,
  IconRefresh, IconX,
} from './icons.jsx';
import './studio.css';

/* -------------------------------- Auth Gate ------------------------------- */
function AuthGate() {
  const { boot, theme } = useStudio();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const showPublicContent = !isCapacitorNative();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginWithPassword(username.trim(), password);
      await boot();
    } catch (err) {
      setError(err.code === 'invalid_credentials'
        ? 'Incorrect username or password.'
        : (err.detail || err.code || 'Sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nxs" data-theme={theme}>
      <div className="nxs-auth-wrap">
        <div className="nxs-auth">
          <form className="nxs-auth-card" onSubmit={submit}>
            <div className="nxs-auth-brand">
              <NexoraLogo size={32} />
              <span className="nxs-wordmark lg">NEXORA</span>
            </div>
            <h2 className="nxs-auth-title">Welcome back</h2>
            <p className="nxs-auth-sub">
              Sign in to access your conversations, projects, connected services, and deployments.
            </p>
            {error && <div className="nxs-error-box" role="alert">{error}</div>}
            <div className="nxs-field">
              <label htmlFor="nxs-user">Username</label>
              <input
                id="nxs-user"
                className="nxs-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="your_username"
              />
            </div>
            <div className="nxs-field">
              <label htmlFor="nxs-pass">Password</label>
              <input
                id="nxs-pass"
                className="nxs-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="nxs-btn primary full"
              disabled={busy || !username.trim() || !password}
            >
              {busy ? 'Signing in…' : 'Continue'}
            </button>
            <button
              type="button"
              className="nxs-btn ghost full"
              onClick={() => window.dispatchEvent(new CustomEvent('nxs-open-chat'))}
            >
              Create a NEXORA account
            </button>
          </form>
        </div>
        {/* The public explanation of what NEXORA is must survive hydration: the
            pre-render HTML in index.html is replaced by this tree, so without it
            the only crawlable text on / would be a sign-in form. The Android app
            keeps its previous auth-only view. */}
        {showPublicContent && <PublicInfo />}
      </div>
    </div>
  );
}

/* ------------------------ Search & Command Modal (⌘K) --------------------- */
function SearchPalette() {
  const {
    paletteOpen, setPaletteOpen,
    projects, files, terminal, agent,
    fixWithAI, startDev, saveNow, openProject, startNewChat,
    setActiveView, setTab, setActiveFile,
    openDiffView, openChecksView, openSettings, openDocsModal,
  } = useStudio();
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);

  const items = useMemo(() => {
    const actions = [
      { id: 'act:new', group: 'Actions', label: 'New Chat', icon: IconNewChat, run: () => startNewChat() },
      { id: 'act:leaderboard', group: 'Actions', label: 'Open Leaderboard', icon: IconTrophy, run: () => setActiveView('leaderboard') },
      { id: 'act:diff', group: 'Actions', label: 'View All Changes (Diff)', icon: IconDiff, run: () => openDiffView({ all: true }) },
      { id: 'act:checks', group: 'Actions', label: 'Run Verification Checks', icon: IconShieldCheck, run: () => openChecksView({ run: true }) },
      { id: 'act:preview', group: 'Actions', label: 'Open Live Preview', icon: IconEye, run: () => setTab('preview') },
      { id: 'act:code', group: 'Actions', label: 'Open Files & Code Editor', icon: IconCode, run: () => setTab('code') },
      { id: 'act:terminal', group: 'Actions', label: 'Open Terminal', icon: IconTerminal, run: () => setTab('terminal') },
      { id: 'act:publish', group: 'Actions', label: 'GitHub, Vercel & Drive (Publish)', icon: IconRocket, run: () => setTab('publish') },
      { id: 'act:docs', group: 'Actions', label: 'Google Docs & Drive Studio', icon: IconDoc, run: () => openDocsModal({ mode: 'docs' }) },
      { id: 'act:save', group: 'Actions', label: 'Save Project Checkpoint', icon: IconFolder, run: () => saveNow() },
      { id: 'act:dev', group: 'Actions', label: 'Start Dev Server', icon: IconRocket, run: () => startDev(), disabled: agent.running },
      { id: 'act:fix', group: 'Actions', label: 'Fix Last Failure with AI', icon: IconShieldCheck, run: () => fixWithAI(terminal.logs), disabled: !terminal.error || agent.running },
      { id: 'act:integrations', group: 'Actions', label: 'Connect Services (Integrations)', icon: IconGear, run: () => openSettings('integrations') },
      { id: 'act:settings', group: 'Actions', label: 'Account & Model Settings', icon: IconGear, run: () => openSettings('account') },
    ];

    const chatItems = (projects || []).map((p) => {
      const archived = Boolean(p.archived || p.meta?.archived);
      const hasFiles = (p.fileCount || 0) > 0 || Boolean(p.meta?.repo);
      return {
        id: `proj:${p.id}`,
        group: archived ? 'Archived Chats' : (hasFiles ? 'Projects' : 'Recent Chats'),
        label: p.name || 'Untitled',
        sub: p.meta?.repo ? `${p.meta.repo}${p.meta.branch ? ` · ${p.meta.branch}` : ''}` : '',
        icon: archived ? IconArchive : (hasFiles ? IconFolder : IconChat),
        run: () => openProject(p.id),
      };
    });

    const fileItems = Object.keys(files || {}).sort().map((path) => ({
      id: `file:${path}`,
      group: 'Files',
      label: path,
      icon: IconCode,
      run: () => { setActiveFile(path); setTab('code'); },
    }));

    return [...chatItems, ...fileItems, ...actions];
  }, [
    files, fixWithAI, openChecksView, openDiffView, openDocsModal, openProject,
    openSettings, projects, saveNow, setActiveFile, setActiveView, setTab, startNewChat, startDev, terminal.logs, agent.running,
  ]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items.slice(0, 24);
    return items
      .filter((it) => it.label.toLowerCase().includes(term)
        || (it.sub && it.sub.toLowerCase().includes(term))
        || it.group.toLowerCase().includes(term))
      .slice(0, 36);
  }, [items, q]);

  useEffect(() => { setIndex(0); }, [q, paletteOpen]);
  if (!paletteOpen) return null;

  const exec = (item) => {
    if (!item || item.disabled) return;
    setPaletteOpen(false);
    setQ('');
    item.run();
  };

  return (
    <div
      className="nxs-modal-backdrop top"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={() => setPaletteOpen(false)}
    >
      <div className="nxs-palette-box" onClick={(e) => e.stopPropagation()}>
        <div className="nxs-palette-input-row">
          <IconSearch size={16} />
          <input
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats, projects, files, and actions..."
            aria-label="Search chats, projects, files, and actions"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1))); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); exec(filtered[index]); }
              else if (e.key === 'Escape') setPaletteOpen(false);
            }}
          />
          <button type="button" className="nxs-icon-btn xs" aria-label="Close search" onClick={() => setPaletteOpen(false)}>
            <IconX size={14} />
          </button>
        </div>

        <div className="nxs-palette-results" role="listbox">
          {filtered.length === 0 ? (
            <div className="nxs-palette-empty">No matching chats, projects, or files.</div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              const prevGroup = i > 0 ? filtered[i - 1].group : null;
              return (
                <div key={item.id}>
                  {item.group !== prevGroup && (
                    <div className="nxs-palette-group">{item.group}</div>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    className={`nxs-palette-item${i === index ? ' on' : ''}`}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => exec(item)}
                    disabled={Boolean(item.disabled)}
                  >
                    <Icon size={15} />
                    <span className="nxs-palette-label">{item.label}</span>
                    {item.sub && <span className="nxs-palette-sub">{item.sub}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Arena Top Header Bar ------------------------- */
function TopBar() {
  const {
    sidebarOpen, setSidebarOpen,
    workspaceOpen, setWorkspaceOpen,
    activeView, setActiveView,
    project, messages, files, projectDiff, checks, agent,
    startNewChat, openDiffView, openChecksView, setTab,
  } = useStudio();

  const fileCount = Object.keys(files || {}).length;
  const diffCount = projectDiff?.count || 0;
  const inThread = activeView === 'chat' && (messages.length > 0 || agent.running || agent.phase === 'completed');

  const handleToggleFiles = () => {
    if (activeView !== 'chat') {
      setActiveView('chat');
      setWorkspaceOpen(true);
      if (!fileCount) setTab('code');
      return;
    }
    if (workspaceOpen) {
      setWorkspaceOpen(false);
    } else {
      setWorkspaceOpen(true);
    }
  };

  return (
    <header className="nxs-topbar">
      <div className="nxs-topbar-start">
        <button
          type="button"
          className={`nxs-top-icon-btn${sidebarOpen ? ' active' : ''}`}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <IconSidebar size={18} />
        </button>

        <button
          type="button"
          className="nxs-top-brand"
          onClick={() => {
            if (activeView !== 'chat') setActiveView('chat');
            else if (inThread) startNewChat();
          }}
          title="NEXORA"
        >
          <NexoraLogo size={22} />
          <span className="nxs-wordmark">NEXORA</span>
        </button>
      </div>

      {inThread && project?.name && (
        <div className="nxs-topbar-center" title={project.name}>
          <span className="nxs-topbar-title">{project.name}</span>
        </div>
      )}

      <div className="nxs-topbar-end">
        {diffCount > 0 && (
          <button
            type="button"
            className="nxs-top-pill diff"
            onClick={() => openDiffView({ all: true })}
            title="View all AI file changes (Diff)"
          >
            <IconDiff size={14} />
            <span className="nxs-diff-add">+{projectDiff.added}</span>
            <span className="nxs-diff-del">-{projectDiff.removed}</span>
          </button>
        )}

        {checks.summary !== 'idle' && fileCount > 0 && (
          <button
            type="button"
            className={`nxs-top-pill checks ${checks.summary}`}
            onClick={() => openChecksView()}
            title="Open verification checks"
            aria-label="Open checks"
          >
            <IconShieldCheck size={14} />
          </button>
        )}

        <button
          type="button"
          className={`nxs-top-files-btn${workspaceOpen && activeView === 'chat' ? ' active' : ''}`}
          aria-label="Toggle files and workspace"
          aria-pressed={workspaceOpen && activeView === 'chat'}
          onClick={handleToggleFiles}
        >
          <IconFiles size={16} />
          <span className="nxs-top-files-label">Files</span>
          {fileCount > 0 && <span className="nxs-top-files-count">{fileCount}</span>}
        </button>
      </div>
    </header>
  );
}

/* -------------------------------- Main Shell ------------------------------ */
function Shell() {
  const {
    booting, bootError, boot,
    theme, sidebarOpen, setSidebarOpen,
    activeView, workspaceOpen,
    settingsOpen, toast, openSettings,
  } = useStudio();

  /* أوامر Windows: Ctrl+, أو قائمة شريط العنوان تفتح الحساب والإعدادات */
  useEffect(() => {
    const onSettings = () => openSettings('account');
    window.addEventListener('nxs-open-settings', onSettings);
    return () => window.removeEventListener('nxs-open-settings', onSettings);
  }, [openSettings]);

  /* Mobile virtual keyboard guard (iOS Safari + Android Chrome) */
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return undefined;
    const syncViewport = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--nxs-kb', `${Math.round(covered)}px`);
      document.documentElement.style.setProperty('--nxs-vvh', `${Math.round(vv.height)}px`);
    };
    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
    };
  }, []);

  if (booting) {
    return (
      <div className="nxs" data-theme={theme}>
        <div className="nxs-loading" role="status">
          <NexoraLogo size={30} />
          <span className="nxs-loading-text">Loading NEXORA…</span>
        </div>
      </div>
    );
  }

  if (bootError?.code === 'unauthorized') return <AuthGate />;

  if (bootError) {
    return (
      <div className="nxs" data-theme={theme}>
        <div className="nxs-auth">
          <div className="nxs-auth-card">
            <div className="nxs-auth-brand">
              <NexoraLogo size={28} />
              <span className="nxs-wordmark">NEXORA</span>
            </div>
            <h1 className="nxs-auth-title">Connection unavailable</h1>
            <p className="nxs-auth-sub">
              {bootError.code === 'storage_unavailable'
                ? 'The workspace database is temporarily unreachable.'
                : 'NEXORA could not reach the backend server.'}
            </p>
            {bootError.detail && <div className="nxs-error-box">{bootError.detail}</div>}
            <button type="button" className="nxs-btn primary full" onClick={() => boot()}>
              <IconRefresh size={14} /> Retry connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showWorkspace = activeView === 'chat' && workspaceOpen;

  return (
    <div
      className={`nxs${sidebarOpen ? ' sidebar-open' : ''}${showWorkspace ? ' ws-open' : ''}`}
      data-theme={theme}
    >
      {/* Collapsible Arena-style Sidebar + mobile backdrop */}
      {sidebarOpen && (
        <>
          <ProjectsPanel />
          <div
            className="nxs-sidebar-scrim"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
        </>
      )}

      {/* Main Column: Top Header + Chat/Leaderboard + Collapsible Workspace */}
      <div className="nxs-shell-main">
        <TopBar />
        <div className={`nxs-stage${showWorkspace ? ' split' : ''}`}>
          {activeView === 'leaderboard' ? (
            <LeaderboardView />
          ) : (
            <>
              <ChatPanel />
              {showWorkspace && <Workspace />}
            </>
          )}
        </div>
      </div>

      {settingsOpen && <SettingsPanel />}
      <SearchPalette />

      {toast && (
        <div className={`nxs-toast ${toast.tone || 'info'}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}
    </div>
  );
}

export function StudioApp() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}

export default StudioApp;
