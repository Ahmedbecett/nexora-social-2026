import { useStudio } from './state.jsx';
import FileTree from './FileTree.jsx';
import CodeEditor from './CodeEditor.jsx';
import PreviewPane from './PreviewPane.jsx';
import TerminalPane from './TerminalPane.jsx';
import DeployPanel from './DeployPanel.jsx';
import { IconEye, IconCode, IconTerminal, IconRocket, IconSave, IconMenu, IconLayers } from './icons.jsx';

const TABS = [
  { id: 'preview', label: 'Preview', icon: IconEye },
  { id: 'code', label: 'Code', icon: IconCode },
  { id: 'terminal', label: 'Terminal', icon: IconTerminal },
  { id: 'publish', label: 'Publish', icon: IconRocket },
];

export default function Workspace({ onOpenSidebar }) {
  const {
    tab, setTab, project, files, dirty, saving, savedAt, saveNow, agent, devServer,
  } = useStudio();

  const dirtyCount = Object.keys(dirty || {}).length;
  const fileCount = Object.keys(files || {}).length;

  return (
    <section className="nxs-pane nxs-workspace" aria-label="Workspace">
      <div className="nxs-tabs" role="tablist">
        <button className="nxs-btn icon sm" title="Projects" onClick={onOpenSidebar} style={{ marginInlineEnd: 4 }}>
          <IconMenu size={14} />
        </button>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`nxs-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={13} />
              {t.label}
              {t.id === 'code' && fileCount > 0 && <span className="count">{fileCount}</span>}
              {t.id === 'terminal' && agent.running && <span className="nxs-dot live" />}
              {t.id === 'preview' && devServer.running && <span className="nxs-dot ok" />}
            </button>
          );
        })}
        <span className="spacer" />
        <span className="acts">
          {project && (
            <span className={`nxs-chip ${dirtyCount ? 'warn' : 'ok'}`} title={dirtyCount ? 'Unsaved edits are auto-saved' : 'All changes saved'}>
              {saving ? 'saving…' : dirtyCount ? `${dirtyCount} unsaved` : savedAt ? 'saved' : 'synced'}
            </span>
          )}
          <button className="nxs-btn sm" onClick={saveNow} disabled={!project} title="Save with a restore point (Ctrl+S)">
            <IconSave size={12} /> Save
          </button>
        </span>
      </div>

      {!project ? (
        <div className="nxs-empty-state">
          <IconLayers size={30} style={{ color: 'var(--text-3)' }} />
          <b>No project selected</b>
          <span>Describe an app in the chat — files, preview and terminal appear here.</span>
        </div>
      ) : (
        <div className="nxs-panel">
          {tab === 'preview' && <PreviewPane />}
          {tab === 'code' && (
            <div className="nxs-panel-body">
              <FileTree />
              <CodeEditor />
            </div>
          )}
          {tab === 'terminal' && <TerminalPane />}
          {tab === 'publish' && <DeployPanel />}
        </div>
      )}
    </section>
  );
}
