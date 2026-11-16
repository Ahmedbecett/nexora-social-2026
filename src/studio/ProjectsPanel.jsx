/* ============================================================================
   NEXORA — Arena-style Sidebar
   New Chat · Leaderboard · Search · Recent Chats · Projects · Archived Chats ·
   Account Settings. Every item supports Open, inline Rename, Archive/Restore,
   and Delete backed by the live Studio API.
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from './state.jsx';
import {
  NexoraLogo, IconNewChat, IconTrophy, IconSearch, IconFolder, IconChat,
  IconArchive, IconUnarchive, IconPencil, IconTrash, IconMore, IconPlus,
  IconChevron, IconSidebar, IconGit, IconX, IconCheck, IconGear,
} from './icons.jsx';

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function SidebarRow({
  item, active, isProjectRow = false, isArchived = false,
  menuId, setMenuId, onOpen, onRename, onArchive, onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef(null);
  const menuKey = `${isProjectRow ? 'proj' : isArchived ? 'arch' : 'chat'}-${item.id}`;
  const menuOpen = menuId === menuKey;

  useEffect(() => {
    if (editing) {
      setDraft(item.name || '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select?.();
      }, 20);
    }
  }, [editing, item.name]);

  const commitRename = async () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== item.name) await onRename(item.id, trimmed);
  };

  if (editing) {
    return (
      <div className="nxs-sb-item editing">
        <input
          ref={inputRef}
          className="nxs-sb-rename"
          aria-label="Rename conversation"
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
          }}
          onBlur={commitRename}
        />
        <button type="button" className="nxs-icon-btn sm" aria-label="Save name" onMouseDown={(e) => { e.preventDefault(); commitRename(); }}>
          <IconCheck size={14} />
        </button>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className="nxs-sb-item confirming" role="alertdialog" aria-label={`Delete ${item.name}`}>
        <span className="nxs-sb-confirm-label">Delete “{item.name}”?</span>
        <div className="nxs-sb-confirm-actions">
          <button
            type="button"
            className="nxs-mini-btn danger"
            onClick={() => { setConfirmDelete(false); onDelete(item.id); }}
          >
            Delete
          </button>
          <button type="button" className="nxs-mini-btn" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const repoShort = item.meta?.repo ? item.meta.repo.split('/')[1] || item.meta.repo : '';
  const sub = isProjectRow
    ? (repoShort ? `${repoShort}${item.meta?.branch ? `:${item.meta.branch}` : ''}` : `${item.fileCount || 0} file${item.fileCount === 1 ? '' : 's'}`)
    : relativeTime(item.updatedAt);

  return (
    <div className={`nxs-sb-item${active ? ' active' : ''}${menuOpen ? ' menu-open' : ''}`}>
      <button
        type="button"
        className="nxs-sb-item-main"
        onClick={() => { setMenuId(null); onOpen(item.id); }}
        title={item.name}
      >
        <span className="nxs-sb-item-icon">
          {isArchived ? <IconArchive size={14} /> : isProjectRow ? (item.meta?.repo ? <IconGit size={14} /> : <IconFolder size={14} />) : <IconChat size={14} />}
        </span>
        <span className="nxs-sb-item-title" dir="auto">{item.name}</span>
        {sub ? <span className="nxs-sb-item-meta">{sub}</span> : null}
      </button>

      <button
        type="button"
        className="nxs-sb-more"
        aria-label={`Actions for ${item.name}`}
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setMenuId(menuOpen ? null : menuKey);
        }}
      >
        <IconMore size={15} />
      </button>

      {menuOpen && (
        <div className="nxs-sb-menu" role="menu" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            role="menuitem"
            className="nxs-sb-menu-item"
            onClick={() => { setMenuId(null); setEditing(true); }}
          >
            <IconPencil size={14} />
            <span>Rename</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="nxs-sb-menu-item"
            onClick={() => { setMenuId(null); onArchive(item.id, !isArchived); }}
          >
            {isArchived ? <IconUnarchive size={14} /> : <IconArchive size={14} />}
            <span>{isArchived ? 'Restore chat' : 'Archive'}</span>
          </button>
          <div className="nxs-sb-menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="nxs-sb-menu-item danger"
            onClick={() => { setMenuId(null); setConfirmDelete(true); }}
          >
            <IconTrash size={14} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPanel() {
  const {
    session, projects, project, activeView, setActiveView,
    sidebarOpen, setSidebarOpen,
    startNewChat, createProject, openProject, renameProject, archiveProject, deleteProject,
    openSettings, accounts,
  } = useStudio();

  const [query, setQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [menuId, setMenuId] = useState(null);
  const searchRef = useRef(null);
  const newProjRef = useRef(null);

  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuId]);

  useEffect(() => {
    if (searchExpanded) setTimeout(() => searchRef.current?.focus(), 30);
  }, [searchExpanded]);

  useEffect(() => {
    if (creatingProject) setTimeout(() => newProjRef.current?.focus(), 30);
  }, [creatingProject]);

  const q = query.trim().toLowerCase();

  const { recentChats, projectItems, archivedChats } = useMemo(() => {
    const matches = (p) => !q
      || String(p.name || '').toLowerCase().includes(q)
      || String(p.description || '').toLowerCase().includes(q)
      || String(p.meta?.repo || '').toLowerCase().includes(q);

    const active = (projects || []).filter((p) => !p.archived && p.status !== 'archived' && matches(p));
    const archived = (projects || []).filter((p) => (p.archived || p.status === 'archived') && matches(p));
    const projs = active.filter((p) => (p.fileCount || 0) > 0 || Boolean(p.meta?.repo) || p.meta?.kind === 'project');
    return {
      recentChats: active,
      projectItems: projs,
      archivedChats: archived,
    };
  }, [projects, q]);

  const handleCreateProject = async (e) => {
    e?.preventDefault?.();
    const name = newProjectName.trim() || 'New project';
    setCreatingProject(false);
    setNewProjectName('');
    await createProject({ name, meta: { kind: 'project' } });
    if (typeof window !== 'undefined' && window.innerWidth <= 900) setSidebarOpen(false);
  };

  const user = session?.user;
  const displayName = user?.fullName || user?.username || 'Account';
  const initial = String(displayName).trim().charAt(0).toUpperCase() || 'N';
  const connectedCount = [accounts?.github?.connected, accounts?.google?.connected, accounts?.vercel?.connected].filter(Boolean).length;

  return (
    <aside
      className={`nxs-sidebar${sidebarOpen ? ' open' : ' closed'}`}
      aria-label="Sidebar navigation"
      aria-hidden={!sidebarOpen}
    >
      {/* Top sidebar brand & close control */}
      <div className="nxs-sb-head">
        <button
          type="button"
          className="nxs-sb-brand"
          onClick={startNewChat}
          title="NEXORA — New Chat"
        >
          <NexoraLogo size={21} />
          <span className="nxs-sb-wordmark">NEXORA</span>
        </button>
        <button
          type="button"
          className="nxs-icon-btn"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          title="Close sidebar"
        >
          <IconSidebar size={17} />
        </button>
      </div>

      {/* Primary Arena-style actions */}
      <nav className="nxs-sb-nav" aria-label="Primary">
        <button
          type="button"
          className={`nxs-sb-nav-btn primary${activeView === 'chat' && !project ? ' current' : ''}`}
          onClick={startNewChat}
        >
          <IconNewChat size={16} />
          <span>New Chat</span>
        </button>

        <button
          type="button"
          className={`nxs-sb-nav-btn${activeView === 'leaderboard' ? ' active' : ''}`}
          onClick={() => {
            setActiveView(activeView === 'leaderboard' ? 'chat' : 'leaderboard');
            if (typeof window !== 'undefined' && window.innerWidth <= 900) setSidebarOpen(false);
          }}
        >
          <IconTrophy size={16} />
          <span>Leaderboard</span>
        </button>

        {!searchExpanded && !query ? (
          <button
            type="button"
            className="nxs-sb-nav-btn"
            onClick={() => setSearchExpanded(true)}
          >
            <IconSearch size={16} />
            <span>Search</span>
            <kbd className="nxs-sb-kbd">⌘K</kbd>
          </button>
        ) : (
          <div className="nxs-sb-search">
            <IconSearch size={14} />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search chats and projects"
              placeholder="Search chats & projects..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  setSearchExpanded(false);
                }
              }}
            />
            <button
              type="button"
              className="nxs-icon-btn xs"
              aria-label="Clear search"
              onClick={() => { setQuery(''); setSearchExpanded(false); }}
            >
              <IconX size={13} />
            </button>
          </div>
        )}
      </nav>

      {/* Scrollable body: Recent Chats, Projects, Archived Chats */}
      <div className="nxs-sb-scroll">
        {/* Recent Chats */}
        <section className="nxs-sb-section" aria-label="Recent Chats">
          <div className="nxs-sb-section-head">
            <span className="nxs-sb-section-title">Recent Chats</span>
            {recentChats.length > 0 && <span className="nxs-sb-count">{recentChats.length}</span>}
          </div>
          {recentChats.length === 0 ? (
            <p className="nxs-sb-empty">{q ? 'No matching chats.' : 'No recent chats yet.'}</p>
          ) : (
            <div className="nxs-sb-list">
              {recentChats.slice(0, 30).map((item) => (
                <SidebarRow
                  key={item.id}
                  item={item}
                  active={activeView === 'chat' && project?.id === item.id}
                  menuId={menuId}
                  setMenuId={setMenuId}
                  onOpen={openProject}
                  onRename={renameProject}
                  onArchive={archiveProject}
                  onDelete={deleteProject}
                />
              ))}
            </div>
          )}
        </section>

        {/* Projects */}
        <section className="nxs-sb-section" aria-label="Projects">
          <div className="nxs-sb-section-head">
            <button
              type="button"
              className="nxs-sb-section-toggle"
              aria-expanded={projectsOpen}
              onClick={() => setProjectsOpen((v) => !v)}
            >
              <IconChevron size={12} className={`nxs-chev${projectsOpen ? ' open' : ''}`} />
              <span className="nxs-sb-section-title">Projects</span>
              {projectItems.length > 0 && <span className="nxs-sb-count">{projectItems.length}</span>}
            </button>
            <button
              type="button"
              className="nxs-icon-btn xs"
              aria-label="New project"
              title="Create new project"
              onClick={() => { setProjectsOpen(true); setCreatingProject((v) => !v); }}
            >
              <IconPlus size={14} />
            </button>
          </div>

          {creatingProject && (
            <form className="nxs-sb-newproj" onSubmit={handleCreateProject}>
              <input
                ref={newProjRef}
                type="text"
                aria-label="New project name"
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingProject(false); setNewProjectName(''); } }}
              />
              <button type="submit" className="nxs-mini-btn primary">Create</button>
            </form>
          )}

          {projectsOpen && (
            projectItems.length === 0 ? (
              <p className="nxs-sb-empty">{q ? 'No matching projects.' : 'Create a project or import a GitHub repo.'}</p>
            ) : (
              <div className="nxs-sb-list">
                {projectItems.slice(0, 25).map((item) => (
                  <SidebarRow
                    key={`p-${item.id}`}
                    item={item}
                    isProjectRow
                    active={activeView === 'chat' && project?.id === item.id}
                    menuId={menuId}
                    setMenuId={setMenuId}
                    onOpen={openProject}
                    onRename={renameProject}
                    onArchive={archiveProject}
                    onDelete={deleteProject}
                  />
                ))}
              </div>
            )
          )}
        </section>

        {/* Archived Chats */}
        <section className="nxs-sb-section" aria-label="Archived Chats">
          <div className="nxs-sb-section-head">
            <button
              type="button"
              className="nxs-sb-section-toggle"
              aria-expanded={archivedOpen || Boolean(q && archivedChats.length)}
              onClick={() => setArchivedOpen((v) => !v)}
            >
              <IconChevron size={12} className={`nxs-chev${(archivedOpen || (q && archivedChats.length)) ? ' open' : ''}`} />
              <span className="nxs-sb-section-title">Archived Chats</span>
              {archivedChats.length > 0 && <span className="nxs-sb-count">{archivedChats.length}</span>}
            </button>
          </div>

          {(archivedOpen || (q && archivedChats.length > 0)) && (
            archivedChats.length === 0 ? (
              <p className="nxs-sb-empty">No archived chats.</p>
            ) : (
              <div className="nxs-sb-list">
                {archivedChats.map((item) => (
                  <SidebarRow
                    key={`a-${item.id}`}
                    item={item}
                    isArchived
                    active={activeView === 'chat' && project?.id === item.id}
                    menuId={menuId}
                    setMenuId={setMenuId}
                    onOpen={openProject}
                    onRename={renameProject}
                    onArchive={archiveProject}
                    onDelete={deleteProject}
                  />
                ))}
              </div>
            )
          )}
        </section>
      </div>

      {/* Footer: Account Settings */}
      <div className="nxs-sb-foot">
        <button
          type="button"
          className="nxs-sb-account"
          aria-label="Account Settings"
          onClick={() => {
            openSettings('account');
            if (typeof window !== 'undefined' && window.innerWidth <= 900) setSidebarOpen(false);
          }}
        >
          <span className="nxs-sb-avatar">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initial}
          </span>
          <span className="nxs-sb-account-info">
            <span className="nxs-sb-account-name">Account Settings</span>
            <span className="nxs-sb-account-sub">
              {displayName}{connectedCount ? ` · ${connectedCount} connected` : ''}
            </span>
          </span>
          <IconGear size={15} className="nxs-sb-account-gear" />
        </button>
      </div>
    </aside>
  );
}
