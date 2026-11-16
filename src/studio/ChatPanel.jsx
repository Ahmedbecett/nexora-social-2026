/* ============================================================================
   NEXORA — Arena-style Agent Chat & Smart Composer
   Hero state: serif "What would you like to build?" + floating "Ask anything..."
   composer + BottomControlBar. Thread state: full markdown responses, real
   multi-step agent orchestration (Planning · Orchestrating · Working · Completed),
   file & diff cards ("View All Changes"), image + local file + Google Drive/Docs
   attachments, service connectors, and live response voting.
   ============================================================================ */

import { useEffect, useRef, useState } from 'react';
import Markdown from '../ai/Markdown.jsx';
import { useStudio } from './state.jsx';
import AgentWindow from './AgentWindow.jsx';
import BottomControlBar from './BottomControlBar.jsx';
import DocsModal from './DocsModal.jsx';
import { ACCEPTED, IMAGE_ERRORS, MAX_IMAGES, prepareImage } from './images.js';
import {
  NexoraLogo, IconArrowUp, IconStop, IconImage, IconPaperclip, IconDrive,
  IconDoc, IconPlug, IconDiff, IconFile, IconWarn, IconX, IconCopy,
  IconThumbUp, IconThumbDown, IconGitHub, IconVercel, IconCheck, IconPlus,
  IconRefresh, IconSpark,
} from './icons.jsx';

const STARTER_PROMPTS = [
  {
    label: 'Analytics dashboard',
    prompt: 'Build a modern responsive SaaS analytics dashboard with KPI cards, interactive revenue chart, filterable activity table, and clean warm typography.',
  },
  {
    label: 'Kanban workspace',
    prompt: 'Build a Kanban project board with three columns (Todo, In Progress, Done), drag and drop, inline task creation, priority tags, and localStorage persistence.',
  },
  {
    label: 'Product landing page',
    prompt: 'Build an editorial minimalist product landing page with serif hero headline, interactive feature showcase, pricing comparison toggle, FAQ accordion, and footer.',
  },
  {
    label: 'React notes app',
    prompt: 'Build a React markdown notes app with sidebar search, tag filters, live preview, and pinned notes using src/App.jsx and clean responsive CSS.',
  },
];

const MAX_LOCAL_FILE_BYTES = 160_000;

export default function ChatPanel() {
  const {
    project, messages, files, agent, projectDiff,
    send, stopAgent, resumeBuild,
    setActiveFile, setOpenFiles, setTab, openDiffView,
    session, openSettings, openDocsModal,
    buildMode, setBuildMode, BUILD_MODES,
    modelPref, setModelPref,
    accounts, readDriveDoc, searchDriveFiles,
    voteOnMessage, notify,
  } = useStudio();

  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const [shots, setShots] = useState([]);
  const [picking, setPicking] = useState(false);
  const [docs, setDocs] = useState([]);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveQuery, setDriveQuery] = useState('');
  const [driveResults, setDriveResults] = useState(null);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const scrollRef = useRef(null);
  const areaRef = useRef(null);
  const imgInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerRef = useRef(null);

  const drive = accounts?.google;
  const driveFiles = Array.isArray(driveResults)
    ? driveResults
    : (Array.isArray(drive?.files) ? drive.files : []);
  const configuredProviders = (session?.ai?.providers || []).filter((p) => p.configured);

  const hasThread = messages.length > 0
    || agent.running
    || Boolean(agent.typing)
    || (agent.activity && agent.activity.length > 0)
    || Boolean(agent.error);

  /* Scroll to latest message when conversation advances */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, agent.running, agent.activity?.length, agent.prose]);

  /* Auto-resize composer textarea without jitter */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, 44), 200);
    el.style.height = `${next}px`;
  }, [text]);

  /* Close Drive / Connectors popovers on outside tap or Escape */
  useEffect(() => {
    if (!driveOpen && !connectorsOpen) return undefined;
    const onDown = (e) => {
      if (composerRef.current && !composerRef.current.contains(e.target)) {
        setDriveOpen(false);
        setConnectorsOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDriveOpen(false);
        setConnectorsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [driveOpen, connectorsOpen]);

  const addShots = async (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const room = MAX_IMAGES - shots.length;
    if (room <= 0) { notify(`Up to ${MAX_IMAGES} images per message`, 'warn'); return; }
    setPicking(true);
    const added = [];
    for (const file of picked.slice(0, room)) {
      try {
        const shot = await prepareImage(file);
        added.push({ ...shot, id: `${Date.now()}-${added.length}` });
      } catch (e) {
        notify(IMAGE_ERRORS[e.message] || 'That image could not be used', 'error');
      }
    }
    if (added.length) setShots((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
    setPicking(false);
  };

  const addLocalTextFiles = async (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const room = 3 - docs.length;
    if (room <= 0) { notify('Up to 3 reference files per message', 'warn'); return; }
    for (const file of picked.slice(0, room)) {
      if (file.size > MAX_LOCAL_FILE_BYTES) {
        notify(`${file.name} is too large (max 160 KB per context file)`, 'warn');
        continue;
      }
      try {
        const content = await file.text();
        if (!content.trim()) continue;
        setDocs((prev) => [
          ...prev.filter((d) => d.name !== file.name),
          { id: `file-${Date.now()}-${file.name}`, name: file.name, url: '', text: content.slice(0, 24_000) },
        ].slice(0, 3));
      } catch {
        notify(`Could not read ${file.name}`, 'error');
      }
    }
  };

  const handleAttachDriveFile = async (item) => {
    if (docs.length >= 3) { notify('Up to 3 documents per message', 'warn'); return; }
    setDriveBusy(true);
    try {
      const doc = await readDriveDoc(item.id);
      setDocs((prev) => [
        ...prev.filter((d) => d.id !== doc.id),
        { id: doc.id, name: doc.name, url: doc.url, text: doc.text },
      ].slice(0, 3));
      setDriveOpen(false);
    } catch (e) {
      notify(e.detail || e.code || 'Could not read that Drive file', 'error');
    } finally {
      setDriveBusy(false);
    }
  };

  const handleSearchDrive = async (e) => {
    e.preventDefault();
    if (!driveQuery.trim()) { setDriveResults(null); return; }
    setDriveBusy(true);
    try {
      const res = await searchDriveFiles({ q: driveQuery.trim() });
      setDriveResults(res.files || []);
    } catch (err) {
      notify(err.detail || err.code || 'Drive search failed', 'error');
    } finally {
      setDriveBusy(false);
    }
  };

  const attachFromDocsModal = (doc) => {
    if (!doc?.text) return;
    setDocs((prev) => [
      ...prev.filter((d) => d.id !== doc.id),
      { id: doc.id, name: doc.name, url: doc.url || '', text: String(doc.text).slice(0, 24_000) },
    ].slice(0, 3));
    notify(`Attached “${doc.name}”`, 'ok');
  };

  const openFile = (path) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    setTab('code');
  };

  const submit = async (overrideText) => {
    const message = String(overrideText ?? text).trim();
    if ((!message && !shots.length && !docs.length) || agent.running) return;
    const images = shots.map((s) => ({ mime: s.mime, data: s.data, name: s.name }));
    const attachedDocs = docs.map((d) => ({ name: d.name, url: d.url || '', text: d.text }));
    setText('');
    setShots([]);
    setDocs([]);
    setDriveOpen(false);
    setConnectorsOpen(false);
    const promptText = message
      || (attachedDocs.length ? 'Build or update based on the attached document.' : 'Build what is shown in the attached image.');
    await send(promptText, { images, docs: attachedDocs });
  };

  const handleCopy = async (id, content) => {
    try {
      await navigator.clipboard?.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600);
    } catch { /* clipboard denied */ }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgFiles = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imgFiles.push(f);
      }
    }
    if (imgFiles.length) {
      e.preventDefault();
      addShots(imgFiles);
    }
  };

  const canSend = Boolean(text.trim() || shots.length || docs.length) && !picking;
  const connectedCount = [accounts?.github?.connected, accounts?.google?.connected, accounts?.vercel?.connected].filter(Boolean).length;

  /* Composer block (rendered inside the centered hero on empty chat, or docked at bottom of active chat) */
  const renderComposer = () => (
    <div className="nxs-composer-stack" ref={composerRef}>
      <div className={`nxs-composer${focus ? ' focused' : ''}${agent.running ? ' busy' : ''}`}>
        {/* Hidden native file inputs */}
        <input
          ref={imgInputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          hidden
          aria-label="Attach images"
          onChange={(e) => { addShots(e.target.files); e.target.value = ''; }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.py,.sql,.yml,.yaml,.csv,.xml,.sh"
          multiple
          hidden
          aria-label="Attach files"
          onChange={(e) => { addLocalTextFiles(e.target.files); e.target.value = ''; }}
        />

        {/* Attachment previews (images + Drive/Google Docs + local files) */}
        {(shots.length > 0 || docs.length > 0) && (
          <div className="nxs-attach-tray">
            {shots.map((s) => (
              <div key={s.id} className="nxs-attach">
                <img src={s.url} alt={s.name || 'Attachment'} />
                <button
                  type="button"
                  className="nxs-attach-rm"
                  aria-label={`Remove ${s.name || 'image'}`}
                  onClick={() => setShots((prev) => prev.filter((x) => x.id !== s.id))}
                >
                  <IconX size={11} />
                </button>
              </div>
            ))}
            {docs.map((d) => (
              <div key={d.id || d.name} className="nxs-attach-doc">
                <IconDoc size={13} />
                <span className="nxs-attach-doc-name" title={d.name}>{d.name}</span>
                <button
                  type="button"
                  className="nxs-attach-doc-rm"
                  aria-label={`Remove ${d.name}`}
                  onClick={() => setDocs((prev) => prev.filter((x) => x !== d))}
                >
                  <IconX size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main prompt textarea */}
        <textarea
          ref={areaRef}
          className="nxs-composer-input"
          aria-label="Message NEXORA Studio"
          placeholder="Ask anything..."
          dir="auto"
          rows={1}
          value={text}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onPaste={handlePaste}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
              e.preventDefault();
              if (canSend && !agent.running) submit();
            }
          }}
        />

        {/* Composer tool row */}
        <div className="nxs-composer-tools">
          <div className="nxs-composer-left">
            {/* Image upload */}
            <button
              type="button"
              className="nxs-tool-btn"
              title="Attach image or screenshot"
              aria-label="Upload image"
              onClick={() => imgInputRef.current?.click()}
            >
              <IconImage size={16} />
            </button>

            {/* Local code/text file upload */}
            <button
              type="button"
              className="nxs-tool-btn"
              title="Attach code or text file"
              aria-label="Upload text or code file"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconPaperclip size={15.5} />
            </button>

            {/* Google Drive / Docs picker */}
            <div className="nxs-pop-anchor">
              <button
                type="button"
                className={`nxs-tool-btn${driveOpen ? ' active' : ''}${drive?.connected ? ' connected' : ''}`}
                aria-label="Attach a Drive document"
                aria-expanded={driveOpen}
                title={drive?.connected ? 'Attach or manage Google Drive & Docs' : 'Connect Google Drive & Docs'}
                onClick={() => {
                  setConnectorsOpen(false);
                  setDriveOpen((v) => !v);
                }}
              >
                <IconDrive size={15.5} />
              </button>

              {driveOpen && (
                <div className="nxs-drive-pop nxs-pop nxs-pop-up" role="dialog" aria-label="Google Drive and Docs">
                  <div className="nxs-pop-head">
                    <span className="nxs-pop-title">Google Drive &amp; Docs</span>
                    {drive?.connected && (
                      <button
                        type="button"
                        className="nxs-mini-btn"
                        onClick={() => { setDriveOpen(false); openDocsModal({ mode: 'docs' }); }}
                      >
                        <IconDoc size={12} /> Docs Studio
                      </button>
                    )}
                  </div>

                  {!drive?.connected ? (
                    <div className="nxs-pop-connect">
                      <p>Connect Google to attach Docs &amp; Sheets as context, create &amp; edit Google Docs, and manage Drive files.</p>
                      <button
                        type="button"
                        className="nxs-btn primary full"
                        onClick={() => { setDriveOpen(false); openSettings('integrations'); }}
                      >
                        Connect Google Drive &amp; Docs
                      </button>
                    </div>
                  ) : (
                    <>
                      <form className="nxs-pop-inline" onSubmit={handleSearchDrive}>
                        <input
                          type="search"
                          placeholder="Search Drive & Docs..."
                          value={driveQuery}
                          onChange={(e) => {
                            setDriveQuery(e.target.value);
                            if (!e.target.value.trim()) setDriveResults(null);
                          }}
                        />
                        <button type="submit" className="nxs-mini-btn" disabled={driveBusy}>Find</button>
                      </form>

                      <div className="nxs-pop-list compact">
                        {driveBusy ? (
                          <div className="nxs-pop-empty">Reading from Google Drive…</div>
                        ) : driveFiles.filter((f) => f.readable !== false).length === 0 ? (
                          <div className="nxs-pop-empty">No readable Docs or text files found.</div>
                        ) : (
                          driveFiles.filter((f) => f.readable !== false).map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className="nxs-drive-file nxs-pop-row"
                              disabled={driveBusy}
                              onClick={() => handleAttachDriveFile(f)}
                            >
                              <span className="nxs-pop-row-main">
                                <span className="nxs-pop-row-title" dir="auto">{f.name}</span>
                                <span className="nxs-pop-row-sub">{f.kind || 'file'}</span>
                              </span>
                              <IconPlus size={13} />
                            </button>
                          ))
                        )}
                      </div>

                      <div className="nxs-pop-foot">
                        <button
                          type="button"
                          className="nxs-pop-foot-btn"
                          onClick={() => { setDriveOpen(false); openDocsModal({ mode: 'create' }); }}
                        >
                          <IconPlus size={13} /> Create New Google Doc
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Service Connectors quick hub (GitHub · Drive · Docs · Vercel) */}
            <div className="nxs-pop-anchor">
              <button
                type="button"
                className={`nxs-tool-btn${connectorsOpen ? ' active' : ''}`}
                aria-label="Service integrations"
                aria-expanded={connectorsOpen}
                title="GitHub, Google Drive, Google Docs & Vercel"
                onClick={() => {
                  setDriveOpen(false);
                  setConnectorsOpen((v) => !v);
                }}
              >
                <IconPlug size={15.5} />
                {connectedCount > 0 && <span className="nxs-tool-badge">{connectedCount}</span>}
              </button>

              {connectorsOpen && (
                <div className="nxs-pop nxs-pop-up" role="dialog" aria-label="Service integrations">
                  <div className="nxs-pop-head">
                    <span className="nxs-pop-title">Integrations</span>
                    <button
                      type="button"
                      className="nxs-mini-btn ghost"
                      onClick={() => { setConnectorsOpen(false); openSettings('integrations'); }}
                    >
                      Manage
                    </button>
                  </div>
                  <div className="nxs-pop-list">
                    <button
                      type="button"
                      className="nxs-pop-row"
                      onClick={() => {
                        setConnectorsOpen(false);
                        if (accounts?.github?.connected) setTab('publish');
                        else openSettings('integrations');
                      }}
                    >
                      <span className="nxs-conn-icon"><IconGitHub size={15} /></span>
                      <span className="nxs-pop-row-main">
                        <span className="nxs-pop-row-title">GitHub</span>
                        <span className="nxs-pop-row-sub">
                          {accounts?.github?.connected ? `@${accounts.github.login}` : 'Connect repos & branches'}
                        </span>
                      </span>
                      <span className={`nxs-status-dot ${accounts?.github?.connected ? 'on' : ''}`} />
                    </button>

                    <button
                      type="button"
                      className="nxs-pop-row"
                      onClick={() => {
                        setConnectorsOpen(false);
                        if (accounts?.google?.connected) openDocsModal({ mode: 'drive' });
                        else openSettings('integrations');
                      }}
                    >
                      <span className="nxs-conn-icon"><IconDrive size={15} /></span>
                      <span className="nxs-pop-row-main">
                        <span className="nxs-pop-row-title">Google Drive</span>
                        <span className="nxs-pop-row-sub">
                          {accounts?.google?.connected ? (accounts.google.email || 'Connected') : 'Browse & manage files'}
                        </span>
                      </span>
                      <span className={`nxs-status-dot ${accounts?.google?.connected ? 'on' : ''}`} />
                    </button>

                    <button
                      type="button"
                      className="nxs-pop-row"
                      onClick={() => {
                        setConnectorsOpen(false);
                        if (accounts?.google?.connected) openDocsModal({ mode: 'docs' });
                        else openSettings('integrations');
                      }}
                    >
                      <span className="nxs-conn-icon"><IconDoc size={15} /></span>
                      <span className="nxs-pop-row-main">
                        <span className="nxs-pop-row-title">Google Docs</span>
                        <span className="nxs-pop-row-sub">
                          {accounts?.google?.connected ? 'Read, create & edit docs' : 'Connect Google Docs API'}
                        </span>
                      </span>
                      <span className={`nxs-status-dot ${accounts?.google?.connected ? 'on' : ''}`} />
                    </button>

                    <button
                      type="button"
                      className="nxs-pop-row"
                      onClick={() => {
                        setConnectorsOpen(false);
                        if (accounts?.vercel?.connected) setTab('publish');
                        else openSettings('integrations');
                      }}
                    >
                      <span className="nxs-conn-icon"><IconVercel size={13} /></span>
                      <span className="nxs-pop-row-main">
                        <span className="nxs-pop-row-title">Vercel</span>
                        <span className="nxs-pop-row-sub">
                          {accounts?.vercel?.connected ? (accounts.vercel.username || 'Connected') : 'Deploy & track builds'}
                        </span>
                      </span>
                      <span className={`nxs-status-dot ${accounts?.vercel?.connected ? 'on' : ''}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="nxs-composer-right">
            {/* Optional model selector when multiple providers are configured */}
            {configuredProviders.length > 1 && (
              <select
                className="nxs-mode-select model-select"
                aria-label="AI model"
                value={modelPref?.provider || ''}
                onChange={(e) => {
                  const p = configuredProviders.find((x) => x.id === e.target.value);
                  setModelPref(p ? { provider: p.id, model: p.defaultModel || '' } : { provider: '', model: '' });
                }}
              >
                <option value="">Auto ({session?.ai?.primary?.label || 'Model'})</option>
                {configuredProviders.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            )}

            {/* Build Mode selector (preserves all 6 build modes) */}
            <select
              className="nxs-mode-select"
              aria-label="Build mode"
              value={buildMode}
              onChange={(e) => setBuildMode(e.target.value)}
            >
              {BUILD_MODES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>

            {/* Primary circular send / stop button */}
            {agent.running ? (
              <button
                type="button"
                className="nxs-send stop"
                aria-label="Stop generation"
                title="Stop agent"
                onClick={stopAgent}
              >
                <IconStop size={15} />
              </button>
            ) : (
              <button
                type="button"
                className="nxs-send"
                aria-label="Send message"
                disabled={!canSend}
                onClick={() => submit()}
              >
                <IconArrowUp size={17} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Arena-style Bottom Control Bar directly underneath composer */}
      <BottomControlBar />
    </div>
  );

  return (
    <div className={`nxs-chat${hasThread ? ' has-thread' : ' is-hero'}`}>
      {!hasThread ? (
        /* =================== EMPTY / NEW CHAT HERO CANVAS =================== */
        <div className="nxs-hero">
          <div className="nxs-hero-center">
            <h1 className="nxs-hero-title nxs-serif">What would you like to build?</h1>

            {renderComposer()}

            <div className="nxs-starters" aria-label="Quick prompts">
              {STARTER_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="nxs-starter-pill"
                  onClick={() => submit(item.prompt)}
                >
                  <IconSpark size={12.5} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* =================== ACTIVE CONVERSATION + AGENT ==================== */
        <>
          <div className="nxs-thread" ref={scrollRef}>
            <div className="nxs-thread-inner">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  const imgs = msg.meta?.images || [];
                  const mDocs = msg.meta?.docs || [];
                  return (
                    <div key={msg.id} className="nxs-msg user">
                      <div className="nxs-user-bubble">
                        {imgs.length > 0 && (
                          <div className="nxs-bubble-imgs">
                            {imgs.map((im, i) => (
                              <img key={i} src={im.url} alt="Attached reference" />
                            ))}
                          </div>
                        )}
                        {mDocs.length > 0 && (
                          <div className="nxs-bubble-docs">
                            {mDocs.map((d, i) => (
                              <span key={i} className="nxs-bubble-doc">
                                <IconDoc size={12} />
                                {d.url ? (
                                  <a href={d.url} target="_blank" rel="noreferrer">{d.name}</a>
                                ) : (
                                  <span>{d.name}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="nxs-user-text" dir="auto">{msg.text}</div>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'error') {
                  return (
                    <div key={msg.id} className="nxs-msg error" role="alert">
                      <div className="nxs-err-card">
                        <IconWarn size={16} />
                        <div className="nxs-err-body">
                          <strong>Execution error</strong>
                          <p dir="auto">{msg.text}</p>
                        </div>
                        <button
                          type="button"
                          className="nxs-mini-btn"
                          onClick={() => openSettings('models')}
                        >
                          Settings
                        </button>
                      </div>
                    </div>
                  );
                }

                const ops = Array.isArray(msg.meta?.ops) ? msg.meta.ops : [];
                const diff = msg.meta?.diff;
                const vote = Number(msg.meta?.vote || 0);
                const planFiles = msg.kind === 'plan' ? (msg.meta?.plan?.files || []) : [];

                return (
                  <div key={msg.id} className="nxs-msg assistant">
                    <div className="nxs-asst-head">
                      <NexoraLogo size={17} className="nxs-asst-logo" />
                      <span className="nxs-asst-name">NEXORA</span>
                      {msg.meta?.model && <span className="nxs-asst-model mono">{msg.meta.model}</span>}
                      {msg.kind === 'plan' && <span className="nxs-phase-tag planning">Plan</span>}
                      {msg.kind === 'files' && ops.length > 0 && <span className="nxs-phase-tag completed">Completed</span>}
                    </div>

                    {msg.text && (
                      <div className="nxs-asst-body" dir="auto">
                        <Markdown text={msg.text} />
                      </div>
                    )}

                    {/* Plan blueprint card */}
                    {planFiles.length > 0 && (
                      <div className="nxs-plan-card">
                        <div className="nxs-plan-head">
                          <span>Planned files ({planFiles.length})</span>
                          {msg.meta?.plan?.stack && <span className="nxs-tag">{msg.meta.plan.stack}</span>}
                        </div>
                        <div className="nxs-plan-files">
                          {planFiles.slice(0, 12).map((pf) => (
                            <span key={pf.path} className="nxs-plan-file mono">{pf.path}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Changed files + Diff & Checks summary card */}
                    {ops.length > 0 && (
                      <div className="nxs-changes-card">
                        <div className="nxs-changes-top">
                          <span className="nxs-changes-label">
                            <IconDiff size={13.5} />
                            <span>{ops.length} file{ops.length === 1 ? '' : 's'} changed</span>
                            {diff && (diff.added > 0 || diff.removed > 0) && (
                              <span className="nxs-changes-stat">
                                {diff.added > 0 && <b className="add">+{diff.added}</b>}
                                {diff.removed > 0 && <b className="del">-{diff.removed}</b>}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            className="nxs-mini-btn"
                            onClick={() => openDiffView(null, { all: true })}
                          >
                            View All Changes
                          </button>
                        </div>
                        <div className="nxs-changes-files">
                          {ops.map((path) => (
                            <button
                              key={path}
                              type="button"
                              className="nxs-file-chip"
                              disabled={files && !(path in files)}
                              onClick={() => openFile(path)}
                              title={`Open ${path}`}
                            >
                              <IconFile size={12} />
                              <span className="mono">{path}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assistant message toolbar: copy, export to Google Docs, vote for Leaderboard */}
                    <div className="nxs-asst-foot">
                      {msg.text && (
                        <button
                          type="button"
                          className="nxs-msg-act"
                          title="Copy response"
                          aria-label="Copy response"
                          onClick={() => handleCopy(msg.id, msg.text)}
                        >
                          {copiedId === msg.id ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </button>
                      )}
                      {msg.text && drive?.connected && (
                        <button
                          type="button"
                          className="nxs-msg-act"
                          title="Save response as Google Doc"
                          aria-label="Save response as Google Doc"
                          onClick={() => openDocsModal({
                            mode: 'create',
                            title: project?.name || 'NEXORA Note',
                            content: msg.text,
                          })}
                        >
                          <IconDoc size={13} />
                        </button>
                      )}
                      {msg.id && !String(msg.id).startsWith('local-') && (
                        <>
                          <button
                            type="button"
                            className={`nxs-msg-act${vote > 0 ? ' voted-up' : ''}`}
                            title="Helpful response"
                            aria-label="Upvote response"
                            onClick={() => voteOnMessage(msg.id, vote > 0 ? 0 : 1).catch(() => {})}
                          >
                            <IconThumbUp size={13} />
                          </button>
                          <button
                            type="button"
                            className={`nxs-msg-act${vote < 0 ? ' voted-down' : ''}`}
                            title="Needs improvement"
                            aria-label="Downvote response"
                            onClick={() => voteOnMessage(msg.id, vote < 0 ? 0 : -1).catch(() => {})}
                          >
                            <IconThumbDown size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Interruption recovery banner (only while files are still pending) */}
              {!agent.running && agent.interrupted && agent.pending > 0 && (
                <div className="nxs-live-note" role="status">
                  <span>Build interrupted with {agent.pending} remaining file(s).</span>
                  <button type="button" className="nxs-mini-btn primary" onClick={resumeBuild}>
                    <IconRefresh size={12} /> Continue build
                  </button>
                </div>
              )}

              {/* Live multi-step agent execution window */}
              <AgentWindow />
            </div>
          </div>

          <div className="nxs-dock">
            <div className="nxs-dock-inner">
              {renderComposer()}
            </div>
          </div>
        </>
      )}

      {/* Real Google Docs & Drive manager modal */}
      <DocsModal onAttachDoc={attachFromDocsModal} />
    </div>
  );
}
