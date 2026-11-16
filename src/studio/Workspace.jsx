/* ============================================================================
   NEXORA — Collapsible Workspace Panel (Files · Preview · Diff · Checks · Terminal · Publish)
   Desktop: clean side-by-side split pane. Mobile: smooth full-screen sheet with
   instant "Back to Chat" navigation and touch-safe file explorer drawer.
   ============================================================================ */

import { useState } from 'react';
import { useStudio } from './state.jsx';
import FileTree from './FileTree.jsx';
import CodeEditor from './CodeEditor.jsx';
import PreviewPane from './PreviewPane.jsx';
import TerminalPane from './TerminalPane.jsx';
import DeployPanel from './DeployPanel.jsx';
import DiffChecksPanel from './DiffChecksPanel.jsx';
import {
  IconEye, IconCode, IconDiff, IconShieldCheck, IconTerminal, IconRocket,
  IconSave, IconX, IconArrowLeft, IconLayers,
} from './icons.jsx';

const TABS = [
  { id: 'preview', label: 'Preview', icon: IconEye },
  { id: 'code', label: 'Code', icon: IconCode },
  { id: 'diff', label: 'Diff', icon: IconDiff },
  { id: 'checks', label: 'Checks', icon: IconShieldCheck },
  { id: 'terminal', label: 'Terminal', icon: IconTerminal },
  { id: 'publish', label: 'Publish', icon: IconRocket },
];

export default function Workspace() {
  const {
    tab, setTab, setWorkspaceOpen, project, files, dirty, saving, savedAt,
    saveNow, agent, devServer, projectDiff, checks,
  } = useStudio();

  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);

  const dirtyCount = Object.keys(dirty || {}).length;
  const fileCount = Object.keys(files || {}).length;
  const diffCount = projectDiff?.count || 0;

  return (
    <section className="nxs-pane nxs-workspace" aria-label="Workspace">
      <div className="nxs-ws-head">
        {/* Mobile back-to-chat button */}
        <button
          type="button"
          className="nxs-ws-back"
          aria-label="Back to chat"
          onClick={() => setWorkspaceOpen(false)}
        >
          <IconArrowLeft size={15} />
          <span>Chat</span>
        </button>

        <div className="nxs-tabs" role="tablist" aria-label="Workspace views">
          {TABS.map((t) => {
            const Icon = t.icon;
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`nxs-tab${selected ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={13.5} />
                <span>{t.label}</span>
                {t.id === 'code' && fileCount > 0 && <span className="count">{fileCount}</span>}
                {t.id === 'diff' && diffCount > 0 && <span className="count diff">{diffCount}</span>}
                {t.id === 'checks' && checks.summary !== 'idle' && (
                  <span className={`nxs-dot ${checks.summary === 'pass' ? 'ok' : checks.summary === 'fail' ? 'err' : 'warn'}`} />
                )}
                {t.id === 'terminal' && agent.running && <span className="nxs-dot live" />}
                {t.id === 'preview' && devServer.running && <span className="nxs-dot ok" />}
              </button>
            );
          })}
        </div>

        <div className="nxs-ws-acts">
          {project && (
            <span
              className={`nxs-sync-pill${dirtyCount ? ' dirty' : ''}`}
              title={dirtyCount ? 'Auto-saving changes' : 'All files saved'}
            >
              {saving ? 'Saving…' : dirtyCount ? `${dirtyCount} unsaved` : savedAt ? 'Saved' : 'Synced'}
            </span>
          )}
          {project && fileCount > 0 && (
            <button
              type="button"
              className="nxs-icon-btn sm"
              onClick={saveNow}
              title="Save checkpoint (Ctrl+S)"
              aria-label="Save checkpoint"
            >
              <IconSave size={14} />
            </button>
          )}
          <button
            type="button"
            className="nxs-icon-btn sm nxs-ws-close"
            onClick={() => setWorkspaceOpen(false)}
            title="Hide workspace panel"
            aria-label="Close workspace"
          >
            <IconX size={15} />
          </button>
        </div>
      </div>

      {!project && tab !== 'publish' ? (
        <div className="nxs-empty-state">
          <IconLayers size={28} />
          <b>No files yet</b>
          <span>Ask NEXORA to build an app in chat, or switch to Publish to open an existing GitHub repository.</span>
          <button type="button" className="nxs-btn sm" onClick={() => setTab('publish')}>
            <IconRocket size={13} /> Open GitHub / Integrations
          </button>
        </div>
      ) : (
        <div className="nxs-panel">
          {tab === 'preview' && <PreviewPane />}
          {tab === 'code' && (
            <div className="nxs-panel-body">
              <FileTree
                mobileOpen={mobileExplorerOpen}
                onCloseMobile={() => setMobileExplorerOpen(false)}
              />
              {mobileExplorerOpen && (
                <div
                  className="nxs-explorer-scrim"
                  onClick={() => setMobileExplorerOpen(false)}
                />
              )}
              <CodeEditor onToggleFiles={() => setMobileExplorerOpen((v) => !v)} />
            </div>
          )}
          {tab === 'diff' && <DiffChecksPanel mode="diff" />}
          {tab === 'checks' && <DiffChecksPanel mode="checks" />}
          {tab === 'terminal' && <TerminalPane />}
          {tab === 'publish' && <DeployPanel />}
        </div>
      )}
    </section>
  );
}
