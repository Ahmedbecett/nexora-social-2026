import { useEffect, useRef, useState } from 'react';
import Markdown from '../ai/Markdown.jsx';
import { useStudio } from './state.jsx';
import { IconSend, IconStop, IconSpark, IconFile, IconLayers, IconWarn, IconPlus, IconX } from './icons.jsx';
import { ACCEPTED, IMAGE_ERRORS, MAX_IMAGES, prepareImage } from './images.js';

const IDEAS = [
  { title: 'Personal dashboard', prompt: 'Build a personal finance dashboard: monthly balance cards, a bar chart of spending by category, and a transactions table with filters. Dark theme, Arabic RTL.' },
  { title: 'Landing page', prompt: 'Build a landing page for a SaaS product called Nova with hero, features grid, pricing table and a footer. Modern, responsive, smooth scroll animations.' },
  { title: 'Todo + kanban', prompt: 'Build a kanban task board with three columns, drag and drop, local persistence, task creation and inline editing.' },
  { title: 'React app', prompt: 'Build a React notes app with search, tags, and markdown preview. Use React with src/App.jsx and clean CSS.' },
];

const STEPS = [
  { id: 'plan', label: 'Plan' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'fix', label: 'Fix' },
];

function FileChip({ path, op, onOpen }) {
  return (
    <button className="nxs-file-chip" title={`Open ${path}`} onClick={() => onOpen(path)}>
      <span className={`op ${op === 'delete' ? 'del' : ''}`}>{op === 'delete' ? '' : '+'}</span>
      {path}
    </button>
  );
}

export default function ChatPanel() {
  const {
    project, messages, agent, send, stopAgent, resumeBuild, createProject, setActiveFile, setTab,
    session, setSettingsOpen, booting, buildMode, setBuildMode, BUILD_MODES, notify,
  } = useStudio();
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const [shots, setShots] = useState([]);
  const [picking, setPicking] = useState(false);
  const scrollRef = useRef(null);
  const areaRef = useRef(null);
  const fileRef = useRef(null);

  const addShots = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_IMAGES - shots.length;
    if (room <= 0) { notify(`Up to ${MAX_IMAGES} images per message`, 'warn'); return; }
    setPicking(true);
    const added = [];
    for (const file of files.slice(0, room)) {
      try {
        const shot = await prepareImage(file);
        added.push({ ...shot, id: `${Date.now()}-${added.length}` });
      } catch (e) {
        notify(IMAGE_ERRORS[e.message] || 'That image could not be used', 'error');
      }
    }
    if (added.length) setShots((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
    setPicking(false);
    if (files.length > room) notify(`Up to ${MAX_IMAGES} images per message`, 'warn');
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, agent.running, agent.activity.length, agent.prose]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 190) + 'px';
  }, [text]);

  const openFile = (path) => { setActiveFile(path); setTab('code'); };

  const submit = async (value) => {
    const message = String(value ?? text).trim();
    if ((!message && !shots.length) || agent.running) return;
    const images = shots.map((s) => ({ mime: s.mime, data: s.data, name: s.name }));
    setText('');
    setShots([]);
    await send(message || 'Build exactly what is in the attached image.', { images });
  };

  const startIdea = async (prompt) => {
    if (agent.running) return;
    setText('');
    if (!project) {
      await createProject({ prompt });
    }
    await send(prompt);
  };

  const hasMessages = messages.length > 0 || agent.running || agent.error;
  const primary = session?.ai?.primary;
  const aiConfigured = session?.ai?.configured;
  const activeSteps = agent.running
    ? (agent.step === 'create' || agent.step === 'continue' ? ['plan', 'create', 'continue'] : [agent.step || 'plan'])
    : [];

  return (
    <section className="nxs-pane nxs-chat" aria-label="Chat">
      <div className="nxs-chat-scroll" ref={scrollRef}>
        <div className="nxs-chat-inner">
          {!hasMessages && (
            <div className="nxs-hero" style={{ flex: 'none' }}>
              <div className="nxs-hero-inner">
                <h1>What do you want to <span>build</span>?</h1>
                <p>
                  Describe the app in your own words. NEXORA Studio plans it, writes the files,
                  runs the code and shows the result in the live preview — then keeps editing
                  the same project with you.
                </p>
                {!aiConfigured && !booting && (
                  <div className="nxs-error-box" style={{ color: 'var(--amber)', borderColor: 'rgba(251,191,36,.3)', background: 'rgba(251,191,36,.07)' }}>
                    No model provider is connected yet.{' '}
                    <button style={{ textDecoration: 'underline' }} onClick={() => setSettingsOpen(true)}>Connect one in Settings</button>{' '}
                    — the rest of the Studio (editor, preview, terminal, deploy) works without it.
                  </div>
                )}
                <div className="nxs-ideas">
                  {IDEAS.map((idea) => (
                    <button key={idea.title} className="nxs-idea" onClick={() => startIdea(idea.prompt)}>
                      <IconSpark size={14} />
                      <span><b>{idea.title}</b>{idea.prompt.slice(0, 92)}…</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m) => {
            const role = m.role === 'assistant' ? 'agent' : m.role === 'error' ? 'error' : 'user';
            const ops = Array.isArray(m.meta?.ops) ? m.meta.ops : [];
            return (
              <article key={m.id} className={`nxs-msg ${role}`}>
                <span className="who">{role === 'agent' ? 'N' : role === 'user' ? 'You' : '!'}</span>
                <div className="bubble">
                  <div className="role">
                    <span>{role === 'agent' ? 'NEXORA' : role === 'user' ? 'You' : 'Error'}</span>
                    {m.meta?.provider && <span className="nxs-chip">{m.meta.provider}{m.meta.model ? ` · ${String(m.meta.model).slice(0, 22)}` : ''}</span>}
                    {m.createdAt && <span className="nxs-faint" style={{ fontSize: 10 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  {role === 'user'
                    ? (
                      <div className="text">
                        {m.text}
                        {Array.isArray(m.meta?.images) && m.meta.images.length > 0 && (
                          <div className="nxs-bubble-imgs">
                            {m.meta.images.map((im, i) => (
                              <a key={i} href={im.url} target="_blank" rel="noreferrer">
                                <img src={im.url} alt={`attachment ${i + 1}`} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                    : <div className="text"><Markdown text={m.text} /></div>}
                  {m.meta?.plan && role === 'agent' && <PlanCard plan={m.meta.plan} compact />}
                  {ops.length > 0 && (
                    <div className="nxs-file-chips">
                      {ops.map((p) => <FileChip key={p} path={p} op="write" onOpen={openFile} />)}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {agent.running && (
            <article className="nxs-msg agent">
              <span className="who">N</span>
              <div className="bubble">
                <div className="role"><span>NEXORA</span><span className={`nxs-chip ${agent.step === 'fix' ? 'warn' : 'violet'}`}>{agent.step || 'working'}</span></div>
                <div className="nxs-live">
                  <div className="nxs-live-head">
                    <span className="spin" />
                    <span>{
                      agent.step === 'plan' ? 'Planning the build…'
                        : agent.step === 'create' || agent.step === 'continue'
                          ? `${agent.step === 'continue' ? 'Continuing the build' : 'Writing files'}${agent.round ? ` · round ${agent.round}` : ''}…`
                          : agent.step === 'edit' ? 'Editing your project…' : 'Investigating the failure…'
                    }</span>
                  </div>
                  <div className="nxs-live-steps">
                    {STEPS.map((s) => (
                      <span key={s.id} className={`nxs-step ${activeSteps.includes(s.id) ? 'active' : ''}`}>{s.label}</span>
                    ))}
                  </div>
                  {agent.activity.length > 0 && (
                    <div className="nxs-live-files">
                      {agent.activity.slice(-10).map((a, i) => (
                        a.kind === 'file' || a.kind === 'delete'
                          ? <FileChip key={`${a.path}-${i}`} path={a.path} op={a.kind} onOpen={openFile} />
                          : <span key={`${a.kind}-${i}`} className="nxs-chip">{a.kind === 'plan' ? `plan: ${a.title || 'ready'}` : a.text || a.kind}</span>
                      ))}
                    </div>
                  )}
                  {agent.prose && <div className="nxs-live-prose">{agent.prose.slice(-600)}</div>}
                </div>
              </div>
            </article>
          )}

          {!agent.running && (agent.interrupted || agent.pending > 0) && (
            <article className="nxs-msg agent">
              <span className="who">N</span>
              <div className="bubble">
                <div className="role">
                  <span>{agent.interrupted ? 'Build interrupted' : 'Build not finished'}</span>
                  <span className="nxs-chip warn">{agent.pending || 0} pending</span>
                </div>
                <div className="text">
                  {agent.interrupted
                    ? 'The connection was cut before the last files arrived. Everything written so far is saved — continue from exactly here.'
                    : 'Some planned files were not written yet. Continue to finish them.'}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="nxs-btn sm primary" onClick={() => resumeBuild()}>
                    <IconSpark size={12} /> Continue build
                  </button>
                </div>
              </div>
            </article>
          )}

          {!agent.running && agent.error && (
            <article className="nxs-msg error">
              <span className="who">!</span>
              <div className="bubble">
                <div className="role"><span>The agent stopped</span></div>
                <div className="text">{agent.error}</div>
              </div>
            </article>
          )}

          {!agent.running && !agent.error && (agent.lastNotes || []).length > 0 && (
            <div className="nxs-live-note">
              <IconWarn size={13} /> {(agent.lastNotes || []).join(' · ')}
            </div>
          )}
        </div>
      </div>

      <div className="nxs-composer-wrap">
        <div className="nxs-composer" data-focus={focus}>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            multiple
            hidden
            onChange={(e) => { addShots(e.target.files); e.target.value = ''; }}
            aria-label="Attach images"
          />
          {shots.length > 0 && (
            <div className="nxs-attach-row">
              {shots.map((shot) => (
                <span key={shot.id} className="nxs-attach">
                  <img src={shot.url} alt={shot.name} />
                  <button
                    type="button"
                    className="nxs-attach-x"
                    aria-label={`Remove ${shot.name}`}
                    onClick={() => setShots((prev) => prev.filter((x) => x.id !== shot.id))}
                  >
                    <IconX size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={areaRef}
            value={text}
            placeholder={project ? 'Ask for a change, a fix, or the next feature…' : 'Describe the app you want to build…'}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
            }}
            rows={1}
            aria-label="Message NEXORA Studio"
          />
          <div className="nxs-composer-bar">
            {primary ? (
              <span className="nxs-chip violet" title={primary.source === 'account' ? 'from your account key' : 'from the server environment'}>
                <IconSpark size={11} /> {primary.label} · {String(primary.model || '').slice(0, 24)}
              </span>
            ) : (
              <button className="nxs-chip warn" onClick={() => setSettingsOpen(true)} title="Connect a model provider">
                <IconWarn size={11} /> no model connected
              </button>
            )}
            <button
              type="button"
              className="nxs-chip"
              onClick={() => fileRef.current && fileRef.current.click()}
              disabled={agent.running || shots.length >= MAX_IMAGES}
              title="Attach a screenshot or design"
            >
              <IconPlus size={11} /> {picking ? 'reading…' : 'image'}
            </button>
            <label className="nxs-mode" title="Build mode — it really changes how the agent works">
              <IconSpark size={11} />
              <select
                value={buildMode}
                onChange={(e) => setBuildMode(e.target.value)}
                aria-label="Build mode"
              >
                {BUILD_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            {project && (
              <span className="nxs-chip"><IconLayers size={11} /> {Object.keys(project.files || {}).length} files</span>
            )}
            {!agent.running && agent.pending > 0 && (
              <button className="nxs-chip warn" onClick={() => resumeBuild()} title="Continue the interrupted build">
                <IconWarn size={11} /> {agent.pending} pending · continue
              </button>
            )}
            <span className="hint">Enter to send · Shift+Enter newline</span>
            {agent.running ? (
              <button className="nxs-send stop" onClick={stopAgent} title="Stop"><IconStop size={14} /></button>
            ) : (
              <button className="nxs-send" onClick={() => submit()} disabled={!text.trim() && !shots.length} title="Send"><IconSend size={15} /></button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlanCard({ plan, compact = false }) {
  if (!plan) return null;
  return (
    <div className="nxs-plan">
      <div className="nxs-plan-head">
        <IconLayers size={14} style={{ color: 'var(--violet-2)' }} />
        <b>{plan.title || 'Build plan'}</b>
        <span className="nxs-chip">{plan.stack}</span>
      </div>
      {plan.summary && <p>{plan.summary}</p>}
      <div className="nxs-plan-grid" style={compact ? {} : {}}>
        <div>
          <h5>Features</h5>
          <ul>{(plan.features || []).slice(0, 7).map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
        <div>
          <h5>Files ({plan.files?.length || 0})</h5>
          <ul className="nxs-plan-files">
            {(plan.files || []).slice(0, 14).map((f, i) => <li key={i}><code>{f.path}</code></li>)}
          </ul>
        </div>
      </div>
      {(plan.steps || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h5 className="nxs-kicker" style={{ marginBottom: 4 }}>Steps</h5>
          <ol className="nxs-plan-grid" style={{ display: 'block', paddingInlineStart: 16, fontSize: 11.5, color: 'var(--text-2)' }}>
            {plan.steps.slice(0, 8).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
