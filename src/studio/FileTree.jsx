import { useMemo, useState } from 'react';
import { useStudio } from './state.jsx';
import { IconChevron, IconFile, IconFolder, IconPlus, IconPencil, IconTrash, IconX, IconCheck } from './icons.jsx';

const LANG_COLOR = {
  jsx: '#0284c7', tsx: '#0284c7', js: '#b45309', mjs: '#b45309', ts: '#2563eb',
  html: '#c2410c', css: '#4f46e5', json: '#a16207', md: '#57534e', svg: '#d97706', py: '#15803d',
};

function extOf(path) {
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

export default function FileTree({ mobileOpen = false, onCloseMobile }) {
  const {
    files, activeFile, setActiveFile, setOpenFiles, setTab,
    addFile, removeFile, renameFile, projectDiff,
  } = useStudio();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [renaming, setRenaming] = useState(null);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  const diffMap = useMemo(() => {
    const m = new Map();
    for (const f of projectDiff?.files || []) m.set(f.path, f.status);
    return m;
  }, [projectDiff]);

  const paths = useMemo(() => Object.keys(files || {}).sort((a, b) => a.localeCompare(b)), [files]);

  const rows = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const p of paths) {
      const parts = p.split('/');
      let hidden = false;
      for (let i = 1; i < parts.length; i += 1) {
        const dir = parts.slice(0, i).join('/');
        if (!seen.has(dir)) {
          seen.add(dir);
          out.push({ type: 'dir', path: dir, name: parts[i - 1], depth: i - 1 });
        }
        if (collapsed.has(dir)) { hidden = true; break; }
      }
      if (!hidden) out.push({ type: 'file', path: p, name: parts[parts.length - 1], depth: parts.length - 1 });
    }
    return out;
  }, [paths, collapsed]);

  const toggle = (dir) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir); else next.add(dir);
      return next;
    });
  };

  const handleStartNew = () => {
    const prefix = activeFile && activeFile.includes('/')
      ? activeFile.slice(0, activeFile.lastIndexOf('/') + 1)
      : '';
    setNewPath(`${prefix}new-file.js`);
    setCreating(true);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const cleaned = newPath.trim();
    setCreating(false);
    setNewPath('');
    if (cleaned) {
      addFile(cleaned, '');
      onCloseMobile?.();
    }
  };

  const startRename = (path) => { setRenaming(path); setDraft(path); };
  const commitRename = async (path) => {
    const to = draft.trim();
    setRenaming(null);
    if (to && to !== path) await renameFile(path, to);
  };

  const selectFile = (path) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    setTab('code');
    onCloseMobile?.();
  };

  return (
    <div className={`nxs-explorer${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="nxs-explorer-head">
        <span className="nxs-kicker">Files</span>
        <div className="nxs-explorer-head-acts">
          <button type="button" className="nxs-icon-btn xs" title="New file" aria-label="New file" onClick={handleStartNew}>
            <IconPlus size={13} />
          </button>
          {onCloseMobile && (
            <button type="button" className="nxs-icon-btn xs nxs-explorer-close" aria-label="Close files list" onClick={onCloseMobile}>
              <IconX size={13} />
            </button>
          )}
        </div>
      </div>

      {creating && (
        <form className="nxs-explorer-new" onSubmit={handleCreateSubmit}>
          <input
            type="text"
            aria-label="New file path"
            value={newPath}
            autoFocus
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setCreating(false); }}
          />
          <button type="submit" className="nxs-icon-btn xs" aria-label="Create file"><IconCheck size={13} /></button>
        </form>
      )}

      <div className="nxs-tree" role="tree">
        {rows.length === 0 && (
          <div className="nxs-empty-tree">
            No files yet.<br />
            Ask NEXORA to build something, or tap + to add a file.
          </div>
        )}
        {rows.map((row) => {
          const pad = 8 + row.depth * 12;
          if (row.type === 'dir') {
            const open = !collapsed.has(row.path);
            return (
              <button
                key={`d-${row.path}`}
                type="button"
                className="nxs-tree-row nxs-tree-folder"
                style={{ paddingInlineStart: pad }}
                onClick={() => toggle(row.path)}
                role="treeitem"
                aria-expanded={open}
              >
                <span className={`twist ${open ? 'open' : ''}`}><IconChevron size={11} /></span>
                <span className="ico"><IconFolder size={13} /></span>
                <span className="name">{row.name}</span>
              </button>
            );
          }
          const diffStatus = diffMap.get(row.path);
          return (
            <div
              key={`f-${row.path}`}
              className={`nxs-tree-row${activeFile === row.path ? ' active' : ''}`}
              style={{ paddingInlineStart: pad + 10 }}
              onClick={() => selectFile(row.path)}
              role="treeitem"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') selectFile(row.path); }}
            >
              <span className="ico" style={{ color: LANG_COLOR[extOf(row.path)] || 'var(--text-3)' }}>
                <IconFile size={12} />
              </span>
              {renaming === row.path ? (
                <input
                  className="nxs-tree-input"
                  value={draft}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(row.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(row.path);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="name">{row.name}</span>
              )}
              {diffStatus && renaming !== row.path && (
                <span className={`nxs-tree-diff ${diffStatus}`}>
                  {diffStatus === 'added' ? 'A' : 'M'}
                </span>
              )}
              {confirmDel === row.path ? (
                <span className="ops show" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="del" title="Confirm delete" onClick={() => { setConfirmDel(null); removeFile(row.path); }}>
                    <IconCheck size={11} />
                  </button>
                  <button type="button" title="Cancel" onClick={() => setConfirmDel(null)}>
                    <IconX size={11} />
                  </button>
                </span>
              ) : (
                <span className="ops" onClick={(e) => e.stopPropagation()}>
                  <button type="button" title="Rename" aria-label={`Rename ${row.name}`} onClick={() => startRename(row.path)}>
                    <IconPencil size={11} />
                  </button>
                  <button type="button" className="del" title="Delete" aria-label={`Delete ${row.name}`} onClick={() => setConfirmDel(row.path)}>
                    <IconTrash size={11} />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
