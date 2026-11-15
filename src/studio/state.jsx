/* ============================================================================
   NEXORA Studio — client state + pipeline
   Owns: projects, files, chat, terminal, preview, deploy.
   The Plan → Create → Execute loop lives here: every step is a real request to
   the agent endpoint, and the files it returns are written to the database as
   they arrive.
   ============================================================================ */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { request, streamRequest, studioSession, StudioApiError } from './api.js';

const StudioCtx = createContext(null);
export const useStudio = () => useContext(StudioCtx);

const LAST_PROJECT = 'nxs_last_project';
const PREVIEW_PREF = 'nxs_preview_mode';

const deriveName = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Untitled project';
  return t.slice(0, 52);
};

import { BUILD_MODES, DEFAULT_BUILD_MODE, buildModeConfig, textTargetPath } from '../../api/_lib/studio/modes.js';
import { appendPart } from '../../api/_lib/studio/files.js';

const BUILD_MODE_KEY = 'nxs-build-mode';
const MAX_AGENT_ROUNDS = 12;
const INTERRUPT_RETRIES = 3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function StudioProvider({ children }) {
  /* ------------------------------- session ------------------------------- */
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState(null);

  /* ------------------------------ projects ------------------------------- */
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [files, setFiles] = useState({});

  /* -------------------------------- editor ------------------------------- */
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  /* --------------------------------- ui ---------------------------------- */
  const [tab, setTab] = useState('preview');
  const [device, setDevice] = useState('responsive');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState(null);

  /* -------------------------------- agent -------------------------------- */
  const [agent, setAgent] = useState({ running: false, step: null, round: 0, prose: '', message: '', plan: null, activity: [], error: null, provider: null, stopped: false, interrupted: false, pending: 0, lastNotes: [] });
  const [accounts, setAccounts] = useState({ github: null, vercel: null });

  /* ----------------------------- build mode ------------------------------ */
  const [buildMode, setBuildModeState] = useState(() => {
    try { return buildModeConfig(localStorage.getItem(BUILD_MODE_KEY)).id; } catch { return DEFAULT_BUILD_MODE; }
  });

  /* ------------------------------- terminal ------------------------------ */
  const [terminal, setTerminal] = useState({ running: false, logs: '', kind: null, command: '', runId: null, exitCode: null, durationMs: null, engine: null, error: null });

  /* -------------------------------- preview ------------------------------ */
  const [previewMode, setPreviewMode] = useState(() => localStorage.getItem(PREVIEW_PREF) || 'bundle');
  const [devServer, setDevServer] = useState({ running: false, url: null, ready: false, starting: false, engine: null, logs: '', error: null });
  const [previewNonce, setPreviewNonce] = useState(0);
  const [consoleEntries, setConsoleEntries] = useState([]);

  const abortRef = useRef(null);
  const saveTimer = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { session, projects, project, messages, files, activeFile, dirty, agent, terminal, tab, previewMode, devServer, buildMode };

  const notify = useCallback((text, tone = 'info') => {
    setToast({ text, tone, id: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.id > 2200 ? null : t)), 3200);
  }, []);

  /* build mode lives next to notify because it announces itself when changed */
  const setBuildMode = useCallback((id) => {
    const next = buildModeConfig(id);
    setBuildModeState(next.id);
    try { localStorage.setItem(BUILD_MODE_KEY, next.id); } catch { /* private mode */ }
    notify(`${next.label} mode · ${next.hint}`, 'info');
  }, [notify]);

  /* ================================= boot ================================= */
  const loadProjects = useCallback(async () => {
    try {
      const data = await request('studio/projects', { timeout: 25_000 });
      setProjects(data.projects || []);
      return data.projects || [];
    } catch (e) {
      if (e.status === 401) setBootError({ code: 'unauthorized' });
      return [];
    }
  }, []);

  const openProject = useCallback(async (id, { quiet = false } = {}) => {
    try {
      const data = await request(`studio/projects/${id}`, { timeout: 30_000 });
      const p = data.project;
      setProject(p);
      setFiles(p.files || {});
      setMessages(data.messages || []);
      setRevisions(data.revisions || []);
      setDeployments(data.deployments || []);
      setDirty({});
      setActiveFile(p.entry && p.files?.[p.entry] !== undefined ? p.entry : (Object.keys(p.files || {})[0] || null));
      setOpenFiles(p.entry && p.files?.[p.entry] !== undefined ? [p.entry] : Object.keys(p.files || {}).slice(0, 1));
      setAgent({ running: false, step: null, round: 0, prose: '', message: '', plan: null, activity: [], error: null, provider: null, stopped: false, interrupted: false, pending: 0, lastNotes: [] });
      setTerminal({ running: false, logs: '', kind: null, command: '', runId: null, exitCode: null, durationMs: null, engine: null, error: null });
      setDevServer({ running: false, url: null, ready: false, starting: false, engine: null, logs: '', error: null });
      setConsoleEntries([]);
      localStorage.setItem(LAST_PROJECT, String(id));
      if (!quiet) setTab(Object.keys(p.files || {}).length ? 'preview' : 'chat');
      return p;
    } catch (e) {
      notify(e.code === 'project_not_found' ? 'Project not found' : `Could not open project (${e.code})`, 'error');
      return null;
    }
  }, [notify]);

  const loadAccounts = useCallback(async () => {
    const [github, vercel] = await Promise.all([
      request('studio/integrations/github', { timeout: 30_000 }).catch(() => null),
      request('studio/integrations/vercel', { timeout: 30_000 }).catch(() => null),
    ]);
    setAccounts({ github, vercel });
    return { github, vercel };
  }, []);

  const boot = useCallback(async () => {
    setBooting(true);
    setBootError(null);
    try {
      const s = await studioSession();
      setSession(s);
      if (!s.authenticated) { setBootError({ code: 'unauthorized' }); return; }
      if (s.error === 'storage_unavailable') { setBootError({ code: 'storage_unavailable', detail: s.storage?.error }); return; }
      loadAccounts().catch(() => {});
      const list = await loadProjects();
      const last = Number(localStorage.getItem(LAST_PROJECT)) || 0;
      const target = list.find((p) => p.id === last) || list[0];
      if (target) await openProject(target.id, { quiet: true });
    } catch (e) {
      setBootError({ code: e.code || 'network', detail: e.detail });
    } finally {
      setBooting(false);
    }
  }, [loadAccounts, loadProjects, openProject]);

  useEffect(() => { boot(); }, [boot]);

  /* --------------------------- server-side keepers ------------------------ */
  const refreshSession = useCallback(async () => {
    try { setSession(await studioSession()); } catch { /* keep old */ }
  }, []);

  const createProject = useCallback(async ({ name, description, stack, prompt, keepAgent = false } = {}) => {
    const data = await request('studio/projects', {
      method: 'POST',
      body: { name: name || deriveName(prompt), description: description || '', stack, files: {} },
      timeout: 30_000,
    });
    const p = data.project;
    setProjects((prev) => [p, ...prev]);
    setProject(p);
    setFiles({});
    setMessages([]);
    setRevisions([]);
    setDeployments([]);
    setOpenFiles([]);
    setActiveFile(null);
    setDirty({});
    if (!keepAgent) {
      setAgent({ running: false, step: null, round: 0, prose: '', message: '', plan: null, activity: [], error: null, provider: null, stopped: false, interrupted: false, pending: 0, lastNotes: [] });
    }
    localStorage.setItem(LAST_PROJECT, String(p.id));
    return p;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await request(`studio/projects/${id}`, { method: 'DELETE', timeout: 20_000 });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (stateRef.current.project?.id === id) {
      setProject(null);
      setFiles({});
      setMessages([]);
      setOpenFiles([]);
      setActiveFile(null);
      localStorage.removeItem(LAST_PROJECT);
    }
    notify('Project deleted');
  }, [notify]);

  const renameProject = useCallback(async (id, name) => {
    const data = await request(`studio/projects/${id}`, { method: 'PATCH', body: { name }, timeout: 20_000 });
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: data.project.name } : p)));
    setProject((p) => (p && p.id === id ? { ...p, name: data.project.name } : p));
  }, []);

  /* ================================= files ================================ */
  const applyProjectPayload = useCallback((payload) => {
    if (!payload) return;
    setProject((prev) => ({ ...(prev || {}), ...payload }));
    if (payload.files) setFiles(payload.files);
  }, []);

  const persistFiles = useCallback(async (nextFiles, { label } = {}) => {
    const p = stateRef.current.project;
    if (!p) return;
    setSaving(true);
    try {
      const data = await request(`studio/projects/${p.id}`, {
        method: 'PATCH',
        body: { files: nextFiles, ...(label ? { revisionLabel: label } : {}) },
        timeout: 30_000,
      });
      setProject(data.project);
      setProjects((prev) => prev.map((x) => (x.id === data.project.id ? { ...x, ...data.project } : x)));
      setDirty({});
      setSavedAt(Date.now());
    } catch (e) {
      notify(`Save failed: ${e.code}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [notify]);

  const scheduleSave = useCallback((nextFiles) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { persistFiles(nextFiles).catch(() => {}); }, 900);
  }, [persistFiles]);

  const writeFile = useCallback((path, content) => {
    if (!path) return;
    const next = { ...stateRef.current.files, [path]: content };
    setFiles(next);
    setDirty((d) => ({ ...d, [path]: true }));
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    scheduleSave(next);
  }, [scheduleSave]);

  const addFile = useCallback((rawPath, content = '') => {
    const path = String(rawPath || '').replace(/^\/+/, '').trim();
    if (!path) return;
    if (stateRef.current.files[path] !== undefined) { setActiveFile(path); notify('That file already exists', 'warn'); return; }
    writeFile(path, content);
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    setTab('code');
  }, [writeFile, notify]);

  const removeFile = useCallback(async (path) => {
    const p = stateRef.current.project;
    if (!p) return;
    const next = { ...stateRef.current.files };
    delete next[path];
    setFiles(next);
    setOpenFiles((prev) => prev.filter((f) => f !== path));
    if (stateRef.current.activeFile === path) setActiveFile(Object.keys(next)[0] || null);
    try {
      await request(`studio/projects/${p.id}/files`, { method: 'POST', body: { deletePath: path }, timeout: 20_000 });
      const data = await request(`studio/projects/${p.id}`, { timeout: 20_000 });
      applyProjectPayload(data.project);
    } catch (e) { notify(`Delete failed: ${e.code}`, 'error'); }
  }, [applyProjectPayload, notify]);

  const renameFile = useCallback(async (from, to) => {
    const p = stateRef.current.project;
    if (!p) return;
    const target = String(to || '').replace(/^\/+/, '').trim();
    if (!target || target === from) return;
    const next = { ...stateRef.current.files, [target]: stateRef.current.files[from] };
    delete next[from];
    setFiles(next);
    setOpenFiles((prev) => prev.map((f) => (f === from ? target : f)));
    if (stateRef.current.activeFile === from) setActiveFile(target);
    await persistFiles(next, { label: `rename ${from}` });
  }, [persistFiles]);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const p = stateRef.current.project;
    if (!p) return;
    try {
      await request(`studio/projects/${p.id}/save`, { method: 'POST', body: { files: stateRef.current.files, label: 'manual save' }, timeout: 30_000 });
      setDirty({});
      setSavedAt(Date.now());
      const data = await request(`studio/projects/${p.id}/revisions`, { timeout: 15_000 });
      setRevisions(data.revisions || []);
      notify('Saved with a restore point');
    } catch (e) { notify(`Save failed: ${e.code}`, 'error'); }
  }, [notify]);

  const restoreRevision = useCallback(async (revisionId) => {
    const p = stateRef.current.project;
    if (!p) return;
    try {
      const data = await request(`studio/projects/${p.id}/revisions/${revisionId}/restore`, { method: 'POST', timeout: 25_000 });
      applyProjectPayload(data.project);
      setDirty({});
      notify('Revision restored');
    } catch (e) { notify(`Restore failed: ${e.code}`, 'error'); }
  }, [applyProjectPayload, notify]);

  /* ================================ agent ================================ */
  const pushActivity = useCallback((entry) => {
    setAgent((a) => ({ ...a, activity: [...a.activity.slice(-40), { ...entry, at: Date.now() }] }));
  }, []);

  const applyAgentEvent = useCallback((event, data, mode) => {
    switch (event) {
      case 'user_message':
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message?.id)) return prev;
          const withoutTemp = prev.filter((m) => !(m.local && m.role === 'user' && m.text === data.message?.text));
          return [...withoutTemp, data.message];
        });
        break;
      case 'status':
        setAgent((a) => ({ ...a, step: mode, running: true, error: null }));
        break;
      case 'prose':
        setAgent((a) => ({ ...a, prose: data.text || '' }));
        break;
      case 'file':
        setFiles((prev) => ({
          ...prev,
          [data.path]: data.append ? appendPart(prev[data.path], data.content) : data.content,
        }));
        setOpenFiles((prev) => (prev.includes(data.path) ? prev : (prev.length < 6 ? [...prev, data.path] : prev)));
        setActiveFile((cur) => cur || data.path);
        pushActivity({ kind: 'file', path: data.path });
        break;
      case 'delete':
        setFiles((prev) => { const n = { ...prev }; delete n[data.path]; return n; });
        pushActivity({ kind: 'delete', path: data.path });
        break;
      case 'plan':
        setAgent((a) => ({ ...a, plan: data.plan }));
        setProject((p) => (p ? { ...p, plan: data.plan } : p));
        pushActivity({ kind: 'plan', title: data.plan?.title });
        break;
      case 'message':
        setAgent((a) => ({ ...a, message: data.text || '' }));
        break;
      case 'done':
        if (data.project && !data.failed) {
          /* like Arena: the moment the build lands, the live preview takes over */
          setTab((t) => (t === 'chat' ? 'preview' : t));
        }
        if (data.project) {
          setProject((prev) => ({ ...(prev || {}), ...data.project }));
          setFiles(data.project.files || {});
          setProjects((prev) => prev.map((x) => (x.id === data.project.id ? { ...x, ...data.project, fileCount: data.project.fileCount } : x)));
        }
        if (data.assistantMessage) {
          setMessages((prev) => (prev.some((m) => m.id === data.assistantMessage.id) ? prev : [...prev, data.assistantMessage]));
        }
        /* a successful round clears the earlier interruption — the banner must
           never outlive the build it was warning about */
        setAgent((a) => ({
          ...a,
          running: false,
          step: null,
          interrupted: data.failed ? a.interrupted : false,
          pending: data.failed ? a.pending : 0,
          plan: data.plan || a.plan,
          provider: data.provider || a.provider,
          error: data.failed ? a.error : null,
          prose: '',
          message: '',
          lastNotes: data.notes || [],
        }));
        break;
      case 'error':
        setAgent((a) => ({ ...a, running: false, step: null, error: data.detail || data.code }));
        break;
      default:
        break;
    }
  }, [pushActivity]);

  const runAgent = useCallback(async ({ mode, message = '', selectedFile = '', logs = '', projectId, extra = {} }) => {
    const id = projectId || stateRef.current.project?.id;
    if (!id) throw new Error('no project');
    let done = null;
    let failure = null;
    await streamRequest('studio/agent', {
      projectId: id, mode, message, selectedFile, logs,
      buildMode: stateRef.current.buildMode || DEFAULT_BUILD_MODE,
      ...extra,
    }, {
      signal: abortRef.current?.signal,
      onEvent: (event, data) => {
        if (event === 'done') { done = data; }
        if (event === 'error') failure = data;
        applyAgentEvent(event, data, mode);
      },
    });
    if (failure || done?.failed) {
      const err = new StudioApiError(
        failure?.code || 'agent_failed',
        failure?.status || 502,
        failure?.detail || 'the model did not finish this step',
      );
      throw err;
    }
    /* The stream ended without a `done` frame: the function was cut off (host
       time limit, proxy, dropped network). The files that already streamed were
       saved server-side, so this is resumable — not a success and not a crash. */
    return { done, interrupted: !done };
  }, [applyAgentEvent]);

  /**
   * Runs create/continue rounds until the plan is complete. Each round is one
   * request, so nothing depends on a single long-lived connection; an
   * interrupted round is retried from the files that already exist.
   */
  const buildUntilComplete = useCallback(async ({ projectId, message, planFiles = [], parts = 0, textPath = '', onRound }) => {
    const cfg = buildModeConfig(stateRef.current.buildMode);
    const maxRounds = Math.max(1, Math.min(40, cfg.rounds || MAX_AGENT_ROUNDS));
    const retries = Math.max(0, cfg.retries ?? INTERRUPT_RETRIES);
    const isText = parts > 0;

    let missing = Array.isArray(planFiles) && planFiles.length
      ? planFiles.filter((path) => !(path in stateRef.current.files))
      : [];
    let interrupted = 0;
    let stalls = 0;
    let round = 0;
    let lastInterrupted = false;

    while (round < maxRounds) {
      const more = isText ? round < parts : (missing.length > 0 || round === 0);
      if (!more) break;
      round += 1;
      const mode = round === 1 ? 'create' : 'continue';
      if (onRound) onRound({ round, missing: missing.length, mode, maxRounds });
      const res = await runAgent({
        mode,
        message,
        projectId,
        extra: {
          batch: cfg.batch,
          ...(isText ? { parts, part: round, textPath } : {}),
        },
      });

      if (res.interrupted) {
        lastInterrupted = true;
        interrupted += 1;
        setAgent((a) => ({ ...a, interrupted: true, pending: missing.length, running: true }));
        if (interrupted > retries) break;
        await wait(700);
        round -= 1;                       // the same round is retried from what exists
        continue;
      }

      const done = res.done || {};
      const progress = (done.changed || []).length;
      if (!isText && Array.isArray(done.missing)) missing = done.missing;

      if (isText) {
        if (progress === 0) break;        // an empty section means the document is done
        continue;
      }
      if (!missing.length) break;
      /* a round that wrote nothing while files are still missing would loop
         forever — allow one retry, then stop and show the pending counter */
      if (progress === 0) {
        stalls += 1;
        if (stalls >= 2) break;
      } else {
        stalls = 0;
      }
    }

    setAgent((a) => ({ ...a, interrupted: lastInterrupted && missing.length > 0, pending: missing.length }));
    return { missing, interrupted: lastInterrupted };
  }, [runAgent]);

  const stopAgent = useCallback(() => {
    try { abortRef.current?.abort(); } catch { /* already */ }
    setAgent((a) => ({ ...a, running: false, step: null, stopped: true }));
    // keep the files that already streamed in — the server only commits at the end of a run
    const current = stateRef.current.files;
    if (Object.keys(current || {}).length) persistFiles(current, { label: 'stopped mid-build' }).catch(() => {});
    notify('Stopped — the files written so far are kept', 'warn');
  }, [notify, persistFiles]);

  const appendLocalUser = useCallback((text) => {
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, local: true, role: 'user', kind: 'text', text, createdAt: new Date().toISOString(), meta: {} }]);
  }, []);

  const appendLocalError = useCallback((text) => {
    setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'error', kind: 'text', text, createdAt: new Date().toISOString(), meta: {} }]);
  }, []);

  /**
   * The main loop: plan (new projects) → create until the plan is complete →
   * preview rebuild. Edits skip the plan.
   */
  const send = useCallback(async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || stateRef.current.agent.running) return;

    const cfg = buildModeConfig(stateRef.current.buildMode);
    let p = stateRef.current.project;
    const empty = !p || Object.keys(stateRef.current.files || {}).length === 0;
    abortRef.current = new AbortController();
    setAgent({
      running: true,
      step: cfg.plan && !cfg.append ? 'plan' : 'create',
      round: 0, prose: '', message: '', plan: null, activity: [],
      error: null, provider: null, stopped: false, interrupted: false, pending: 0,
      buildMode: cfg.id,
    });
    appendLocalUser(text);

    try {
      if (!p) {
        p = await createProject({ prompt: text, keepAgent: true });
      }

      if (empty && cfg.append) {
        /* long-form text: one markdown file grows section by section */
        const textPath = textTargetPath(text, 'document.md');
        pushActivity({ kind: 'note', text: `writing ${textPath} · ${cfg.parts} sections` });
        const built = await buildUntilComplete({
          projectId: p.id,
          message: text,
          parts: cfg.parts,
          textPath,
          onRound: ({ round, maxRounds }) => {
            setAgent((a) => ({ ...a, running: true, step: round === 1 ? 'create' : 'continue', round, maxRounds }));
            if (round > 1) pushActivity({ kind: 'note', text: `section ${round}` });
          },
        });
        if (built.missing.length) pushActivity({ kind: 'note', text: `${built.missing.length} file(s) still missing` });
        if (built.interrupted) notify('The connection was cut — the text so far is saved, press Continue build', 'warn');
      } else if (empty) {
        let planFiles = [];
        if (cfg.plan) {
          const planRes = await runAgent({ mode: 'plan', message: text, projectId: p.id });
          planFiles = (planRes.done?.missing?.length
            ? planRes.done.missing
            : (planRes.done?.plan?.files || planRes.done?.project?.plan?.files || []).map((f) => f.path));
          if (planRes.interrupted && !planFiles.length) {
            throw new StudioApiError('run_interrupted', 0, 'the plan was cut off — press Continue build to resume');
          }
        }
        const built = await buildUntilComplete({
          projectId: p.id,
          message: text,
          planFiles,
          onRound: ({ round, missing, maxRounds }) => {
            setAgent((a) => ({ ...a, running: true, step: round === 1 ? 'create' : 'continue', round, maxRounds }));
            if (missing) pushActivity({ kind: 'note', text: `round ${round} · ${missing} file(s) queued` });
          },
        });
        if (built.missing.length) {
          pushActivity({ kind: 'note', text: `${built.missing.length} file(s) still missing` });
          if (built.interrupted) notify('The connection was cut — work is saved, press Continue build', 'warn');
        }
      } else {
        setAgent((a) => ({ ...a, running: true, step: 'edit' }));
        await runAgent({ mode: 'edit', message: text, selectedFile: stateRef.current.activeFile || '', projectId: p.id });
      }
      if (empty) setTab('preview');
      setPreviewNonce((n) => n + 1);
    } catch (e) {
      if (e.code === 'aborted') {
        /* user pressed stop — nothing else to do */
      } else if (e.code === 'ai_not_configured') {
        setAgent((a) => ({ ...a, running: false, step: null, error: 'ai_not_configured' }));
        appendLocalError('No AI provider is connected. Open Settings → Models and add a key (or set OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY on the server).');
        setSettingsOpen(true);
      } else if (e.code === 'unauthorized') {
        setBootError({ code: 'unauthorized' });
      } else {
        // the server persists model failures as an error message in the chat;
        // anything else is shown by the agent error block
        setAgent((a) => ({ ...a, running: false, step: null, error: e.detail || e.code }));
      }
    } finally {
      setAgent((a) => ({ ...a, running: false }));
      loadProjects().catch(() => {});
    }
  }, [appendLocalError, appendLocalUser, buildUntilComplete, createProject, loadProjects, notify, pushActivity, runAgent]);

  const fixWithAI = useCallback(async (logs) => {
    const p = stateRef.current.project;
    if (!p || stateRef.current.agent.running) return;
    abortRef.current = new AbortController();
    setAgent((a) => ({ ...a, running: true, step: 'fix', activity: [], error: null }));
    try {
      const fix = await runAgent({ mode: 'fix', logs, message: 'Fix the failure shown in the terminal output.', projectId: p.id });
      if (fix.interrupted) notify('The fix was cut off — check the terminal and try again', 'warn');
      setPreviewNonce((n) => n + 1);
      setTab('preview');
    } catch (e) {
      notify(`Fix failed: ${e.detail || e.code}`, 'error');
    } finally {
      setAgent((a) => ({ ...a, running: false, step: null }));
    }
  }, [notify, runAgent]);

  /* =============================== terminal =============================== */
  const runTerminal = useCallback(async (command, kind = 'exec') => {
    const p = stateRef.current.project;
    if (!p || !command.trim() || stateRef.current.terminal.running) return;
    setTerminal({ running: true, logs: `$ ${command}\n`, kind, command, runId: null, exitCode: null, durationMs: null, engine: null, error: null });
    setTab('terminal');
    try {
      await streamRequest('studio/exec', {
        projectId: p.id, command, kind, files: stateRef.current.files,
      }, {
        onEvent: (event, data) => {
          if (event === 'log') setTerminal((t) => ({ ...t, logs: t.logs + (data.text || '') }));
          else if (event === 'status') setTerminal((t) => ({ ...t, engine: data.label || data.engine }));
          else if (event === 'run') setTerminal((t) => ({ ...t, runId: data.runId }));
          else if (event === 'done') setTerminal((t) => ({ ...t, running: false, exitCode: data.exitCode, durationMs: data.durationMs, engine: data.engine, previewUrl: data.previewUrl }));
          else if (event === 'error') setTerminal((t) => ({ ...t, running: false, error: data.detail || data.code, logs: `${t.logs}\n✗ ${data.detail || data.code}\n` }));
        },
      });
    } catch (e) {
      setTerminal((t) => ({ ...t, running: false, error: e.detail || e.code, logs: `${t.logs}\n✗ ${e.detail || e.code}\n` }));
    }
  }, []);

  const clearTerminal = useCallback(() => setTerminal({ running: false, logs: '', kind: null, command: '', runId: null, exitCode: null, durationMs: null, engine: null, error: null }), []);

  /* ============================== dev server ============================== */
  const startDev = useCallback(async (command = '') => {
    const p = stateRef.current.project;
    if (!p) return;
    setDevServer((d) => ({ ...d, starting: true, error: null }));
    try {
      const res = await request(`studio/projects/${p.id}/dev/start`, { method: 'POST', body: { command }, timeout: 150_000 });
      setDevServer({ running: true, url: res.url, ready: Boolean(res.ready), starting: false, engine: res.engine, logs: res.logs || '', error: res.ready ? null : 'the dev server did not answer yet — check the terminal' });
      setPreviewMode('server');
      localStorage.setItem(PREVIEW_PREF, 'server');
      setTab('preview');
      notify(res.ready ? 'Dev server is running' : 'Dev server started, waiting for it to answer', TONE(res.ready));
    } catch (e) {
      setDevServer({ running: false, url: null, ready: false, starting: false, engine: null, logs: '', error: e.detail || e.code });
      setTab('terminal');
      setTerminal((t) => ({ ...t, error: e.detail || e.code, logs: `${t.logs || ''}\n✗ dev server: ${e.detail || e.code}\n` }));
      notify(`Dev server failed: ${e.detail || e.code}`, 'error');
    }
  }, [notify]);

  const stopDev = useCallback(async () => {
    const p = stateRef.current.project;
    if (!p) return;
    try { await request(`studio/projects/${p.id}/dev/stop`, { method: 'POST', timeout: 30_000 }); } catch { /* stopped anyway */ }
    setDevServer({ running: false, url: null, ready: false, starting: false, engine: null, logs: '', error: null });
    setPreviewMode('bundle');
    localStorage.setItem(PREVIEW_PREF, 'bundle');
  }, []);

  const switchPreview = useCallback((mode) => {
    setPreviewMode(mode);
    localStorage.setItem(PREVIEW_PREF, mode);
  }, []);

  const logConsole = useCallback((entry) => {
    setConsoleEntries((prev) => [...prev.slice(-120), entry]);
  }, []);

  /**
   * Continue a build that was cut off (serverless time limit, closed tab,
   * dropped connection). Everything already streamed is on the server, so this
   * simply asks for the remaining files again.
   */
  const resumeBuild = useCallback(async () => {
    const p = stateRef.current.project;
    if (!p || stateRef.current.agent.running) return null;
    const planFiles = (p.plan?.files || []).map((f) => f.path);
    abortRef.current = new AbortController();
    setAgent((a) => ({ ...a, running: true, step: 'continue', error: null, interrupted: false }));
    try {
      const built = await buildUntilComplete({
        projectId: p.id,
        message: p.description || 'Continue building the project until every planned file exists.',
        planFiles,
        onRound: ({ round, missing }) => {
          setAgent((a) => ({ ...a, running: true, step: round === 1 ? 'create' : 'continue', round }));
          if (missing) pushActivity({ kind: 'note', text: `round ${round} · ${missing} file(s) queued` });
        },
      });
      setPreviewNonce((n) => n + 1);
      if (!built.missing.length) notify('Build complete', 'ok');
      else if (!built.interrupted) notify(`${built.missing.length} file(s) still missing`, 'warn');
      await loadProjects().catch(() => {});
      return built;
    } catch (e) {
      if (e.code !== 'aborted') setAgent((a) => ({ ...a, error: e.detail || e.code }));
      return null;
    } finally {
      setAgent((a) => ({ ...a, running: false }));
    }
  }, [buildUntilComplete, loadProjects, notify, pushActivity]);

  /* ================================ deploy ================================ */
  const deployVercel = useCallback(async () => {
    const p = stateRef.current.project;
    if (!p) return null;
    try {
      const data = await request(`studio/projects/${p.id}/deploy/vercel`, { method: 'POST', body: { name: p.name }, timeout: 90_000 });
      setDeployments((prev) => [data.deployment, ...prev]);
      notify('Deployment queued on Vercel');
      const id = data.deployment?.id;
      if (id) {
        for (let i = 0; i < 20; i += 1) {
          await wait(3000);
          let state = null;
          try { state = await request(`studio/deploy/vercel/${encodeURIComponent(id)}`, { timeout: 25_000 }); }
          catch { break; }
          setDeployments((prev) => prev.map((d) => (d.id === id ? { ...d, state: state.state, url: state.url || d.url } : d)));
          if (state.state === 'READY') { notify(`Live: ${state.url || data.deployment.url}`, 'ok'); break; }
          if (state.state === 'ERROR' || state.state === 'CANCELED') { notify(`Vercel build ${state.state.toLowerCase()}`, 'error'); break; }
        }
      }
      return data.deployment;
    } catch (e) {
      if (e.code === 'vercel_not_connected') { setSettingsOpen(true); notify('Connect Vercel first', 'warn'); }
      else notify(`Deploy failed: ${e.detail || e.code}`, 'error');
      return null;
    }
  }, [notify]);

  const pushGithub = useCallback(async ({ repo, isPrivate = true, message } = {}) => {
    const p = stateRef.current.project;
    if (!p) return null;
    try {
      const data = await request(`studio/projects/${p.id}/deploy/github`, {
        method: 'POST', body: { repo, private: isPrivate, message }, timeout: 120_000,
      });
      setDeployments((prev) => [data.deployment, ...prev]);
      notify(`Pushed to github.com/${data.deployment.repo}`);
      return data.deployment;
    } catch (e) {
      if (e.code === 'github_not_connected') { setSettingsOpen(true); notify('Connect GitHub first', 'warn'); }
      else notify(`GitHub failed: ${e.detail || e.code}`, 'error');
      return null;
    }
  }, [notify]);

  const saveKey = useCallback(async (provider, key, model) => {
    const data = await request('studio/ai/keys', { method: 'POST', body: { provider, key, model }, timeout: 45_000 });
    await refreshSession();
    return data;
  }, [refreshSession]);

  const removeKey = useCallback(async (provider) => {
    await request(`studio/ai/keys/${provider}`, { method: 'DELETE', timeout: 20_000 });
    await refreshSession();
  }, [refreshSession]);

  const testModel = useCallback(async (provider, key, model) => request('studio/ai/test', { method: 'POST', body: { provider, key, model }, timeout: 40_000 }), []);

  const connectIntegration = useCallback(async (provider, token) => {
    const data = await request(`studio/integrations/${provider}`, { method: 'POST', body: { token }, timeout: 40_000 });
    await refreshSession();
    loadAccounts().catch(() => {});
    return data;
  }, [refreshSession]);

  const disconnectIntegration = useCallback(async (provider) => {
    await request(`studio/integrations/${provider}`, { method: 'DELETE', timeout: 20_000 });
    await refreshSession();
    setAccounts((a) => ({ ...a, [provider]: { connected: false } }));
  }, [refreshSession]);

  /* ------------------------------- shortcuts ------------------------------ */
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
      if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
      if (meta && e.key === 'Enter') { e.preventDefault(); /* handled by composer */ }
      if (e.key === 'Escape') { setPaletteOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow]);

  useEffect(() => {
    const handler = () => setBootError({ code: 'unauthorized' });
    window.addEventListener('nxs-unauthorized', handler);
    return () => window.removeEventListener('nxs-unauthorized', handler);
  }, []);

  const value = useMemo(() => ({
    session, booting, bootError, boot, refreshSession,
    projects, project, messages, revisions, deployments, files,
    openFiles, setOpenFiles, activeFile, setActiveFile, dirty, saving, savedAt,
    tab, setTab, device, setDevice, settingsOpen, setSettingsOpen, sidebarOpen, setSidebarOpen, paletteOpen, setPaletteOpen,
    agent, terminal, toast, notify,
    previewMode, switchPreview, devServer, startDev, stopDev, previewNonce, setPreviewNonce,
    consoleEntries, logConsole,
    createProject, openProject, deleteProject, renameProject, loadProjects,
    writeFile, addFile, removeFile, renameFile, saveNow, restoreRevision, persistFiles,
    send, stopAgent, fixWithAI, resumeBuild, runTerminal, clearTerminal,
    accounts, loadAccounts,
    buildMode, setBuildMode, BUILD_MODES,
    deployVercel, pushGithub, saveKey, removeKey, testModel, connectIntegration, disconnectIntegration,
  }), [
    session, booting, bootError, boot, refreshSession, projects, project, messages, revisions, deployments, files,
    openFiles, activeFile, dirty, saving, savedAt, tab, device, settingsOpen, sidebarOpen, paletteOpen, agent, terminal, toast, notify,
    previewMode, switchPreview, devServer, startDev, stopDev, previewNonce, consoleEntries, logConsole,
    createProject, openProject, deleteProject, renameProject, loadProjects, writeFile, addFile, removeFile, renameFile,
    saveNow, restoreRevision, persistFiles, send, stopAgent, fixWithAI, runTerminal, clearTerminal,
    buildMode, setBuildMode,
    deployVercel, pushGithub, saveKey, removeKey, testModel, connectIntegration, disconnectIntegration,
  ]);

  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
}

function TONE(ok) { return ok ? 'success' : 'warn'; }
