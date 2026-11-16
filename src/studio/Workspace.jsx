import { useStudio } from './state.jsx';
import FileTree from './FileTree.jsx';
import CodeEditor from './CodeEditor.jsx';
import PreviewPane from './PreviewPane.jsx';
import TerminalPane from './TerminalPane.jsx';
import DeployPanel from './DeployPanel.jsx';
import { IconEye, IconCode, IconTerminal, IconRocket, IconSave, IconLayers, IconX } from './icons.jsx';

const TABS = [
  { id: 'preview', label: 'Preview', icon: IconEye },
  { id: 'code', label: 'Code', icon: IconCode },
  { id: 'terminal', label: 'Terminal', icon: IconTerminal },
  { id: 'publish', label: 'Publish', icon: IconRocket },
];

export default function Workspace() {
  const {
    tab, setTab, project, files, dirty, saving, savedAt, saveNow, agent, devServer,
    panelOpen, closePanel,
  } = useStudio();

  const dirtyCount = Object.keys(dirty || {}).length;
  const fileCount = Object.keys(files || {}).length;

  return (
    <section
      className={`nxs-pane nxs-workspace ${panelOpen ? 'open' : ''}`}
      aria-label="Build"
      aria-hidden={panelOpen ? 'false' : 'true'}
    >
      <div className="nxs-sheet-head">
        <span className="nxs-sheet-grip" aria-hidden="true" />
        <div className="nxs-tabs" role="tablist">
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
          <button className="nxs-icon-btn" onClick={saveNow} disabled={!project} title="Save with a restore point (Ctrl+S)" aria-label="Save project">
            <IconSave size={14} />
          </button>
          <button className="nxs-icon-btn" onClick={closePanel} title="Close (Esc)" aria-label="Close the build panel">
            <IconX size={15} />
          </button>
        </span>
        </div>
      </div>

      {!project ? (
        <div className="nxs-empty-state">
          <IconLayers size={30} style={{ color: 'var(--text-3)' }} />
          <b>No project selected</b>
          <span>Describe an app in the chat — files, preview and terminal appear here.</span>
        </div>
      ) : panelOpen ? (
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
      ) : (
        <div className="nxs-empty-state">
          <IconLayers size={26} style={{ color: 'var(--text-3)' }} />
          <b>Build closed</b>
          <span>Open the build from the header to see the preview, the code, the terminal and publishing.</span>
        </div>
      )}
    </section>
  );
}
