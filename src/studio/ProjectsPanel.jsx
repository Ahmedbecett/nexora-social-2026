import { useMemo, useState } from 'react';
import { useStudio } from './state.jsx';
import { IconPlus, IconSearch, IconTrash, IconLayers, IconX, IconPencil } from './icons.jsx';

const STACK_LABEL = { static: 'HTML', 'vite-react': 'React', node: 'Node', next: 'Next' };

function ago(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectsPanel() {
  const { projects, project, openProject, deleteProject, renameProject, createProject, sidebarOpen, setSidebarOpen, session } = useStudio();
  const [q, setQ] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [draft, setDraft] = useState('');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? projects.filter((p) => p.name.toLowerCase().includes(term)) : projects;
  }, [projects, q]);

  const startRename = (p) => { setRenaming(p.id); setDraft(p.name); };
  const commitRename = async (p) => {
    const name = draft.trim();
    setRenaming(null);
    if (name && name !== p.name) await renameProject(p.id, name);
  };

  return (
    <aside className={`nxs-pane nxs-projects ${sidebarOpen ? 'open' : ''}`} aria-label="Projects">
      <div className="nxs-projects-head">
        <span className="nxs-kicker">Projects</span>
        <button className="nxs-btn icon sm" title="New project" onClick={() => createProject({})}>
          <IconPlus size={14} />
        </button>
        <button className="nxs-btn icon sm hide-sm" title="Close sidebar" onClick={() => setSidebarOpen(false)}>
          <IconX size={14} />
        </button>
      </div>

      <div className="nxs-projects-search">
        <IconSearch size={13} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" aria-label="Search projects" />
      </div>

      <div className="nxs-projects-list">
        {list.length === 0 && (
          <div className="nxs-empty-tree">
            {q ? 'No project matches that search.' : 'No projects yet. Describe an app in the chat and the first build becomes a project.'}
          </div>
        )}
        {list.map((p) => (
          <div
            key={p.id}
            className={`nxs-project ${project?.id === p.id ? 'active' : ''}`}
            onClick={() => openProject(p.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') openProject(p.id); }}
          >
            <span className="stack"><IconLayers size={12} /></span>
            <span className="meta">
              {renaming === p.id ? (
                <input
                  className="nxs-input"
                  style={{ height: 24, fontSize: 12, padding: '0 6px' }}
                  value={draft}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(p);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <b onDoubleClick={(e) => { e.stopPropagation(); startRename(p); }}>{p.name}</b>
              )}
              <small>
                {STACK_LABEL[p.stack] || p.stack}
                {typeof p.fileCount === 'number' ? ` · ${p.fileCount} files` : ''}
                {p.updatedAt ? ` · ${ago(p.updatedAt)}` : ''}
              </small>
            </span>
            <span className="acts" onClick={(e) => e.stopPropagation()}>
              <button title="Rename" onClick={() => startRename(p)}><IconPencil size={12} /></button>
              <button className="del" title="Delete project" onClick={() => { if (confirm(`Delete “${p.name}” and all its files?`)) deleteProject(p.id); }}>
                <IconTrash size={12} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="nxs-projects-foot">
        <span className={`nxs-dot ${session?.storage?.ok ? 'ok' : 'err'}`} />
        <span>{session?.storage?.label || 'storage'}</span>
        <span style={{ marginInlineStart: 'auto' }}>{projects.length}</span>
      </div>
    </aside>
  );
}
