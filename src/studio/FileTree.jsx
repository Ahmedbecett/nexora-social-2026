import { useMemo, useState } from 'react';
import { useStudio } from './state.jsx';
import { IconChevron, IconFile, IconFolder, IconPlus, IconPencil, IconTrash } from './icons.jsx';

const LANG_COLOR = {
  jsx: '#61dafb', tsx: '#61dafb', js: '#f7df1e', mjs: '#f7df1e', ts: '#3178c6',
  html: '#e34f26', css: '#264de4', json: '#cbcb41', md: '#6b7280', svg: '#ffb13b',
};

function extOf(path) {
  const m = path.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

export default function FileTree() {
  const { files, activeFile, setActiveFile, setTab, addFile, removeFile, renameFile } = useStudio();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [renaming, setRenaming] = useState(null);
  const [draft, setDraft] = useState('');

  const paths = useMemo(() => Object.keys(files || {}).sort((a, b) => a.localeCompare(b)), [files]);

  /* flatten the tree honouring collapsed folders */
  const rows = useMemo(() => {
    const dirs = new Set();
    for (const p of paths) {
      const parts = p.split('/');
      for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
    }
    const out = [];
    const seen = new Set();
    for (const p of paths) {
      const parts = p.split('/');
      let hidden = false;
      for (let i = 1; i < parts.length; i += 1) {
        const dir = parts.slice(0, i).join('/');
        if (!seen.has(dir)) { seen.add(dir); out.push({ type: 'dir', path: dir, name: parts[i - 1], depth: i - 1 }); }
        if (collapsed.has(dir)) { hidden = true; break; }
      }
      if (!hidden) out.push({ type: 'file', path: p, name: parts[parts.length - 1], depth: parts.length - 1 });
    }
    // folders that contain no direct file still need to appear — the loop above covers them
    return out;
  }, [paths, collapsed]);

  const toggle = (dir) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir); else next.add(dir);
      return next;
    });
  };

  const newFile = () => {
    const guess = activeFile && activeFile.includes('/') ? activeFile.slice(0, activeFile.lastIndexOf('/') + 1) : '';
    const name = window.prompt('New file path', `${guess}new-file.js`);
    if (name) addFile(name, '');
  };

  const startRename = (path) => { setRenaming(path); setDraft(path); };
  const commitRename = async (path) => {
    const to = draft.trim();
    setRenaming(null);
    if (to && to !== path) await renameFile(path, to);
  };

  return (
    <div className="nxs-explorer">
      <div className="nxs-explorer-head">
        <span className="nxs-kicker">Explorer</span>
        <button className="nxs-btn icon sm" title="New file" onClick={newFile}><IconPlus size={13} /></button>
      </div>
      <div className="nxs-tree" role="tree">
        {rows.length === 0 && (
          <div className="nxs-empty-tree">
            No files yet.<br />
            Ask the agent to build something, or create a file with ＋.
          </div>
        )}
        {rows.map((row) => {
          const pad = 6 + row.depth * 12;
          if (row.type === 'dir') {
            const open = !collapsed.has(row.path);
            return (
              <button
                key={`d-${row.path}`}
                className="nxs-tree-row nxs-tree-folder"
                style={{ paddingInlineStart: pad }}
                onClick={() => toggle(row.path)}
                role="treeitem"
                aria-expanded={open}
              >
                <span className={`twist ${open ? 'open' : ''}`}><IconChevron size={10} /></span>
                <span className="ico"><IconFolder size={12} /></span>
                <span className="name">{row.name}</span>
              </button>
            );
          }
          return (
            <div
              key={`f-${row.path}`}
              className={`nxs-tree-row ${activeFile === row.path ? 'active' : ''}`}
              style={{ paddingInlineStart: pad + 12 }}
              onClick={() => { setActiveFile(row.path); setTab('code'); }}
              role="treeitem"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { setActiveFile(row.path); setTab('code'); } }}
            >
              <span className="ico" style={{ color: LANG_COLOR[extOf(row.path)] || 'var(--text-3)' }}><IconFile size={11} /></span>
              {renaming === row.path ? (
                <input
                  className="nxs-input"
                  style={{ height: 20, fontSize: 11, padding: '0 4px' }}
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
              ) : <span className="name">{row.name}</span>}
              <span className="ops" onClick={(e) => e.stopPropagation()}>
                <button title="Rename" onClick={() => startRename(row.path)}><IconPencil size={11} /></button>
                <button className="del" title="Delete" onClick={() => { if (confirm(`Delete ${row.path}?`)) removeFile(row.path); }}><IconTrash size={11} /></button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
