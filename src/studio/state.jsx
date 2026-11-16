/* ============================================================================
   NEXORA Studio — client state, multi-step AI agent orchestration, Diff & Checks,
   and real service integrations (GitHub, Google Drive, Google Docs, Vercel).
   ============================================================================ */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { request, streamRequest, studioSession, StudioApiError, launchOAuth } from './api.js';
import { BUILD_MODES, DEFAULT_BUILD_MODE, buildModeConfig, textTargetPath } from '../../api/_lib/studio/modes.js';
import { appendPart } from '../../api/_lib/studio/files.js';
import { computeProjectDiff, revertHunk, runStaticChecks } from './diff.js';
import { buildPreview } from './preview/bundler.js';

const StudioCtx = createContext(null);
export const useStudio = () => useContext(StudioCtx);

const LAST_PROJECT = 'nxs_last_project';
const PREVIEW_PREF = 'nxs_preview_mode';
const BUILD_MODE_KEY = 'nxs-build-mode';
const THEME_KEY = 'nxs_theme';
const MODEL_PREF_KEY = 'nxs_model_pref';
const CONTROL_BAR_KEY = 'nxs_control_bar';

const MAX_AGENT_ROUNDS = 12;
const INTERRUPT_RETRIES = 3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const isDesktopViewport = () => (typeof window === 'undefined' ? true : window.innerWidth > 900);

const deriveName = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Untitled project';
  return t.slice(0, 52);
};

/**
 * Detect purely conversational prompts on an empty chat so "What is GraphQL?"
 * or "اشرح لي كيف يعمل OAuth" gets a direct answer, while every build/code/app
 * request runs the full multi-step Planning → Orchestrating → Working builder.
 */
function shouldUseChatMode(text, { hasImages = false, buildMode = 'fast' } = {}) {
  if (hasImages) return false;
  if (buildMode === 'text' || buildMode === 'endless' || buildMode === 'direct') return false;
  const t = String(text || '').trim();
  if (!t) return false;
  const buildIntent = /\b(build|create|make|design|develop|generate|implement|code|write|scaffold|clone|landing|website|web\s?app|app|page|site|dashboard|portfolio|game|calculator|counter|store|shop|form|component|tool|api|server|todo|blog|ui|interface|prototype|html|css|react)\b|(أنشئ|انشئ|ابني|ابنِ|ابن\s|صمّم|صمم|برمج|طوّر|طور|اكتب\s+(كود|برنامج|صفحة|تطبيق|موقع|مقال)|اصنع|اعمل\s+(موقع|تطبيق|صفحة|لعبة|لوحة|أداة)|موقع|تطبيق|صفحة\s+ويب|لوحة\s+تحكم|متجر)/i;
  if (buildIntent.test(t)) return false;
  const chatIntent = /^(hi|hello|hey|good\s+(morning|afternoon|evening)|what\s+(is|are|does|can)|who\s+(is|are)|why\s+|how\s+(does|do|can|is|to\s+understand)|explain\b|compare\b|summarize\b|summarise\b|analyze\b|analyse\b|review\b|translate\b|tell\s+me\b|can\s+you\s+explain|مرحبا|مرحبًا|أهلا|اهلا|السلام\s+عليكم|كيف\s+حالك|ما\s+(هو|هي|الفرق|معنى)|لماذا|اشرح|وضّح|وضح|قارن|لخّص|لخص|حلّل|حلل|ترجم|من\s+أنت)/i;
  return chatIntent.test(t);
}

const emptyAgent = () => ({
  running: false,
  phase: 'idle', // idle | planning | orchestrating | working | completed | error | interrupted | stopped
  step: null,
  round: 0,
  maxRounds: 0,
  prose: '',
  message: '',
  plan: null,
  activity: [],
  steps: [],
  error: null,
  provider: null,
  model: null,
  stopped: false,
  interrupted: false,
  pending: 0,
  lastNotes: [],
  typing: null,
  started: null,
  finishedAt: null,
  durationMs: 0,
  changedCount: 0,
});

const emptyChecks = () => ({
  running: false,
  summary: 'idle', // idle | pass | warn | fail
  lastRunAt: null,
  items: [],
});

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

  /* --------------------------- diff & checks ----------------------------- */
  const [diffBaseline, setDiffBaseline] = useState({ label: 'Initial state', revisionId: null, files: {} });
  const [diffFocusPath, setDiffFocusPath] = useState(null);
  const [viewAllChanges, setViewAllChanges] = useState(true);
  const [checks, setChecks] = useState(emptyChecks);

  /* -------------------------------- editor ------------------------------- */
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  /* --------------------------------- ui ---------------------------------- */
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'leaderboard'
  const [tab, setTab] = useState('preview'); // 'preview' | 'diff' | 'checks' | 'code' | 'terminal' | 'deploy'
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [device, setDevice] = useState('responsive');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('models');
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [docsModalInit, setDocsModalInit] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 960));
  const [controlBarOpen, setControlBarOpenState] = useState(() => {
    try { return localStorage.getItem(CONTROL_BAR_KEY) !== '0'; } catch { return true; }
  });
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'cream'; } catch { return 'cream'; }
  });
  const [modelPref, setModelPrefState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MODEL_PREF_KEY) || 'null') || { provider: '', model: '' }; }
    catch { return { provider: '', model: '' }; }
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState(null);

  /* -------------------------------- agent -------------------------------- */
  const [agent, setAgent] = useState(emptyAgent);
  const [accounts, setAccounts] = useState({ github: null, vercel: null, google: null });
  const [branchCache, setBranchCache] = useState({});

  /* ----------------------------- build mode ------------------------------ */
  const [buildMode, setBuildModeState] = useState(() => {
    try { return buildModeConfig(localStorage.getItem(BUILD_MODE_KEY)).id; } catch { return DEFAULT_BUILD_MODE; }
  });

  /* ------------------------------- terminal ------------------------------ */
  const [terminal, setTerminal] = useState({
    running: false, logs: '', kind: null, command: '', runId: null, exitCode: null, durationMs: null, engine: null, error: null,
  });

  /* -------------------------------- preview ------------------------------ */
  const [previewMode, setPreviewMode] = useState(() => {
    try { return localStorage.getItem(PREVIEW_PREF) || 'bundle'; } catch { return 'bundle'; }
  });
  const [devServer, setDevServer] = useState({
    running: false, url: null, ready: false, starting: false, engine: null, logs: '', error: null,
  });
  const [previewNonce, setPreviewNonce] = useState(0);
  const [consoleEntries, setConsoleEntries] = useState([]);

  const abortRef = useRef(null);
  const saveTimer = useRef(null);
  const stateRef = useRef({});
  stateRef.current = {
    session, projects, project, messages, files, diffBaseline, checks,
    activeFile, dirty, agent, terminal, tab, workspaceOpen, previewMode,
    devServer, buildMode, modelPref, consoleEntries, accounts,
  };

  /* Live project diff computed from real baseline vs current files */
  const projectDiff = useMemo(
    () => computeProjectDiff(diffBaseline?.files || {}, files || {}),
    [diffBaseline, files],
  );

  const notify = useCallback((text, tone = 'info') => {
    const id = Date.now() + Math.random();
    setToast({ text, tone, id });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 3200);
  }, []);

  const openSettings = useCallback((initialTab = 'models') => {
    if (typeof initialTab === 'string') setSettingsTab(initialTab);
    setSettingsOpen(true);
  }, []);

  const openDocsModal = useCallback((init = null) => {
    setActiveView('chat');
    setDocsModalInit(init);
    setDocsModalOpen(true);
  }, []);

  const setTheme = useCallback((next) => {
    const clean = next === 'dark' ? 'dark' : 'cream';
    setThemeState(clean);
    try { localStorage.setItem(THEME_KEY, clean); } catch { /* ignore */ }
  }, []);

  const setControlBarOpen = useCallback((open) => {
    const val = Boolean(open);
    setControlBarOpenState(val);
    try { localStorage.setItem(CONTROL_BAR_KEY, val ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const setModelPref = useCallback((pref) => {
    const clean = { provider: String(pref?.provider || ''), model: String(pref?.model || '') };
    setModelPrefState(clean);
    try { localStorage.setItem(MODEL_PREF_KEY, JSON.stringify(clean)); } catch { /* ignore */ }
  }, []);

  const setBuildMode = useCallback((id) => {
    const next = buildModeConfig(id);
    setBuildModeState(next.id);
    try { localStorage.setItem(BUILD_MODE_KEY, next.id); } catch { /* private mode */ }
    notify(`${next.label} mode · ${next.hint}`, 'info');
  }, [notify]);

  const selectWorkspaceTab = useCallback((nextTab) => {
    setTab(nextTab);
    if (nextTab && nextTab !== 'chat') {
      setWorkspaceOpen(true);
      setActiveView('chat');
    } else if (nextTab === 'chat') {
      setWorkspaceOpen(false);
    }
  }, []);

  const openDiffView = useCallback((focusPath = null, { all = true } = {}) => {
    setDiffFocusPath(focusPath || null);
    setViewAllChanges(focusPath ? false : Boolean(all));
    setActiveView('chat');
    setTab('diff');
    setWorkspaceOpen(true);
  }, []);

  const openChecksView = useCallback(() => {
    setActiveView('chat');
    setTab('checks');
    setWorkspaceOpen(true);
  }, []);

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
      const pFiles = p.files || {};
      const hasFiles = Object.keys(pFiles).length > 0;
      setProject(p);
      setFiles(pFiles);
      setDiffBaseline({ label: 'Saved project state', revisionId: data.revisions?.[0]?.id || null, files: { ...pFiles } });
      setDiffFocusPath(null);
      setChecks(emptyChecks());
      setMessages(data.messages || []);
      setRevisions(data.revisions || []);
      setDeployments(data.deployments || []);
      setDirty({});
      setActiveFile(p.entry && pFiles[p.entry] !== undefined ? p.entry : (Object.keys(pFiles)[0] || null));
      setOpenFiles(p.entry && pFiles[p.entry] !== undefined ? [p.entry] : Object.keys(pFiles).slice(0, 1));
      setAgent(emptyAgent());
      setTerminal({ running: false, logs: '', kind: null, command: '', runId: null, exitCode: null, durationMs: null, engine: null, error: null });
      setDevServer({ running: false, url: null, ready: false, starting: false, engine: null, logs: '', error: null });
      setConsoleEntries([]);
      setActiveView('chat');
      try { localStorage.setItem(LAST_PROJECT, String(id)); } catch { /* ignore */ }
      if (hasFiles) {
        setTab('preview');
        setWorkspaceOpen(isDesktopViewport());
      } else {
        setWorkspaceOpen(false);
        if (!quiet) setTab('preview');
      }
      if (!isDesktopViewport()) setSidebarOpen(false);
      return p;
    } catch (e) {
      notify(e.code === 'project_not_found' ? 'Project not found' : `Could not open project (${e.code})`, 'error');
      return null;
    }
  }, [notify]);

  /** Reset to a clean Arena-style New Chat canvas without creating empty DB clutter. */
  const startNewChat = useCallback(() => {
    if (stateRef.current.agent.running) {
      try { abortRef.current?.abort(); } catch { /* ignore */ }
    }
    setProject(null);
    setFiles({});
    setDiffBaseline({ label: 'Initial state', revisionId: null, files: {} });
    setDiffFocusPath(null);
    setChecks(emptyChecks());
    setMessages([]);
    setRevisions([]);
    setDeployments([]);
    setOpenFiles([]);
    setActiveFile(null);
    setDirty({});
    setAgent(emptyAgent());
    setConsoleEntries([]);
    setActiveView('chat');
    setWorkspaceOpen(false);
    try { localStorage.removeItem(LAST_PROJECT); } catch { /* ignore */ }
    if (!isDesktopViewport()) setSidebarOpen(false);
  }, []);

  const loadAccounts = useCallback(async () => {
    const [github, vercel, google] = await Promise.all([
      request('studio/integrations/github', { timeout: 30_000 }).catch(() => null),
      request('studio/integrations/vercel', { timeout: 30_000 }).catch(() => null),
      request('studio/integrations/google', { timeout: 30_000 }).catch(() => null),
    ]);
    setAccounts({ github, vercel, google });
    return { github, vercel, google };
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
      const active = list.filter((p) => !p.archived);
      let lastRaw = null;
      try { lastRaw = localStorage.getItem(LAST_PROJECT); } catch { /* ignore */ }
      const last = Number(lastRaw) || 0;
      const target = active.find((p) => p.id === last) || (lastRaw === null ? active[0] : null);
      if (target) await openProject(target.id, { quiet: true });
    } catch (e) {
      setBootError({ code: e.code || 'network', detail: e.detail });
    } finally {
      setBooting(false);
    }
  }, [loadAccounts, loadProjects, openProject]);

  useEffect(() => { boot(); }, [boot]);

  /* Detect mobile OAuth redirect return (`/?oauth=github&status=ok`) */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const oauthProvider = url.searchParams.get('oauth');
      const status = url.searchParams.get('status');
      if (oauthProvider) {
        url.searchParams.delete('oauth');
        url.searchParams.delete('status');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        if (status === 'ok') {
          notify(`Connected ${oauthProvider} successfully`, 'ok');
          loadAccounts().catch(() => {});
        }
      }
    } catch { /* ignore */ }
  }, [loadAccounts, notify]);

  /* --------------------------- server-side keepers ------------------------ */
  const refreshSession = useCallback(async () => {
    try { setSession(await studioSession()); } catch { /* keep old */ }
  }, []);

  const createProject = useCallback(async ({ name, description, stack, prompt, meta = {}, keepAgent = false } = {}) => {
    const data = await request('studio/projects', {
      method: 'POST',
      body: { name: name || deriveName(prompt), description: description || '', stack, files: {}, meta },
      timeout: 30_000,
    });
    const p = data.project;
    setProjects((prev) => [p, ...prev]);
    setProject(p);
    setFiles({});
    setDiffBaseline({ label: 'Before build', revisionId: null, files: {} });
    setDiffFocusPath(null);
    setChecks(emptyChecks());
    setMessages([]);
    setRevisions([]);
    setDeployments([]);
    setOpenFiles([]);
    setActiveFile(null);
    setDirty({});
    setActiveView('chat');
    if (!keepAgent) setAgent(emptyAgent());
    try { localStorage.setItem(LAST_PROJECT, String(p.id)); } catch { /* ignore */ }
    return p;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await request(`studio/projects/${id}`, { method: 'DELETE', timeout: 20_000 });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (stateRef.current.project?.id === id) {
      setProject(null);
      setFiles({});
      setDiffBaseline({ label: 'Initial state', revisionId: null, files: {} });
      setMessages([]);
      setOpenFiles([]);
      setActiveFile(null);
      setWorkspaceOpen(false);
      try { localStorage.removeItem(LAST_PROJECT); } catch { /* ignore */ }
    }
    notify('Deleted');
  }, [notify]);

  const renameProject = useCallback(async (id, name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const data = await request(`studio/projects/${id}`, { method: 'PATCH', body: { name: trimmed }, timeout: 20_000 });
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: data.project.name } : p)));
    setProject((p) => (p && p.id === id ? { ...p, name: data.project.name } : p));
    notify('Renamed');
  }, [notify]);

  const archiveProject = useCallback(async (id, archived = true) => {
    const data = await request(`studio/projects/${id}`, {
      method: 'PATCH',
      body: { archived: Boolean(archived) },
      timeout: 20_000,
    });
    const updated = data.project;
    setProjects((prev) => prev.map((p) => (p.id === id
      ? { ...p, archived: Boolean(archived), status: updated.status, meta: updated.meta }
      : p)));
    if (stateRef.current.project?.id === id) {
      if (archived) {
        startNewChat();
      } else {
        setProject((p) => (p ? { ...p, archived: false, status: updated.status, meta: updated.meta } : p));
      }
    }
    notify(archived ? 'Moved to Archived Chats' : 'Restored from Archive');
    return updated;
  }, [notify, startNewChat]);

  const updateProjectMeta = useCallback(async (id, metaPatch = {}) => {
    const targetId = id || stateRef.current.project?.id;
    if (!targetId) return null;
    const data = await request(`studio/projects/${targetId}`, {
      method: 'PATCH',
      body: { meta: metaPatch },
      timeout: 20_000,
    });
    const updated = data.project;
    setProjects((prev) => prev.map((p) => (p.id === targetId ? { ...p, meta: updated.meta } : p)));
    setProject((p) => (p && p.id === targetId ? { ...p, meta: updated.meta } : p));
    return updated;
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
      setProjects((prev) => prev.map((x) => (x.id === data.project.id ? { ...x, ...data.project, files: undefined } : x)));
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
    if (stateRef.current.files[path] !== undefined) {
      setActiveFile(path);
      notify('That file already exists', 'warn');
      return;
    }
    writeFile(path, content);
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    setTab('code');
    setWorkspaceOpen(true);
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
      await request(`studio/projects/${p.id}/save`, {
        method: 'POST',
        body: { files: stateRef.current.files, label: 'manual save' },
        timeout: 30_000,
      });
      setDirty({});
      setSavedAt(Date.now());
      const data = await request(`studio/projects/${p.id}/revisions`, { timeout: 15_000 });
      setRevisions(data.revisions || []);
      notify('Saved with a restore point', 'ok');
    } catch (e) { notify(`Save failed: ${e.code}`, 'error'); }
  }, [notify]);

  const restoreRevision = useCallback(async (revisionId) => {
    const p = stateRef.current.project;
    if (!p) return;
    try {
      const data = await request(`studio/projects/${p.id}/revisions/${revisionId}/restore`, { method: 'POST', timeout: 25_000 });
      applyProjectPayload(data.project);
      setDiffBaseline({ label: `Restored #${revisionId}`, revisionId, files: { ...(data.project.files || {}) } });
      setDirty({});
      setPreviewNonce((n) => n + 1);
      const revList = await request(`studio/projects/${p.id}/revisions`, { timeout: 15_000 }).catch(() => null);
      if (revList?.revisions) setRevisions(revList.revisions);
      notify('Revision restored', 'ok');
    } catch (e) { notify(`Restore failed: ${e.code}`, 'error'); }
  }, [applyProjectPayload, notify]);

  /* ============================ diff review =============================== */
  /** Compare current workspace files against any stored revision from DB. */
  const compareWithRevision = useCallback(async (revisionId) => {
    const p = stateRef.current.project;
    if (!p) return null;
    if (revisionId === 'empty') {
      setDiffBaseline({ label: 'Empty workspace (all files)', revisionId: 'empty', files: {} });
      return {};
    }
    try {
      const data = await request(`studio/projects/${p.id}/revisions/${revisionId}`, { timeout: 20_000 });
      const rev = data.revision;
      setDiffBaseline({
        label: rev.label || `Revision #${rev.id}`,
        revisionId: rev.id,
        files: { ...(rev.files || {}) },
      });
      return rev.files;
    } catch (e) {
      notify(`Could not load revision: ${e.detail || e.code}`, 'error');
      return null;
    }
  }, [notify]);

  /** Accept a single file's changes into the reviewed baseline. */
  const acceptFileChange = useCallback(async (path) => {
    if (!path) return;
    const cur = stateRef.current.files || {};
    setDiffBaseline((prev) => {
      const nextBase = { ...(prev?.files || {}) };
      if (path in cur) nextBase[path] = cur[path];
      else delete nextBase[path];
      return { ...prev, files: nextBase };
    });
    if (stateRef.current.dirty?.[path]) {
      await persistFiles(cur, { label: `accept ${path}` });
    }
    notify(`Accepted changes in ${path}`, 'ok');
  }, [notify, persistFiles]);

  /** Reject a single file's changes and restore its baseline content on disk/DB. */
  const rejectFileChange = useCallback(async (path) => {
    const p = stateRef.current.project;
    if (!path) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const baseFiles = stateRef.current.diffBaseline?.files || {};
    const curFiles = { ...(stateRef.current.files || {}) };
    const hadBefore = Object.prototype.hasOwnProperty.call(baseFiles, path);

    if (hadBefore) {
      curFiles[path] = baseFiles[path];
    } else {
      delete curFiles[path];
    }
    setFiles(curFiles);
    setDirty((d) => { const n = { ...d }; delete n[path]; return n; });
    if (!hadBefore) {
      setOpenFiles((prev) => prev.filter((f) => f !== path));
      if (stateRef.current.activeFile === path) setActiveFile(Object.keys(curFiles)[0] || null);
    }
    if (p) {
      try {
        await request(`studio/projects/${p.id}/files`, {
          method: 'POST',
          body: hadBefore ? { path, content: baseFiles[path] } : { deletePath: path },
          timeout: 25_000,
        });
      } catch (e) {
        notify(`Revert failed: ${e.detail || e.code}`, 'error');
        return;
      }
    }
    setPreviewNonce((n) => n + 1);
    notify(hadBefore ? `Reverted ${path}` : `Removed added file ${path}`, 'ok');
  }, [notify]);

  /** Reject a single diff hunk inside a modified file and persist to DB. */
  const rejectFileHunk = useCallback(async (path, hunkIndex) => {
    const p = stateRef.current.project;
    const baseText = stateRef.current.diffBaseline?.files?.[path];
    const curText = stateRef.current.files?.[path];
    if (typeof baseText !== 'string' || typeof curText !== 'string') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const reverted = revertHunk(baseText, curText, hunkIndex);
    const nextFiles = { ...(stateRef.current.files || {}), [path]: reverted };
    setFiles(nextFiles);
    if (p) {
      try {
        await request(`studio/projects/${p.id}/files`, {
          method: 'POST',
          body: { path, content: reverted },
          timeout: 25_000,
        });
      } catch (e) {
        notify(`Hunk revert failed: ${e.detail || e.code}`, 'error');
        return;
      }
    }
    setPreviewNonce((n) => n + 1);
    notify(`Reverted hunk #${hunkIndex + 1} in ${path}`, 'ok');
  }, [notify]);

  /** Accept every pending change and checkpoint a restore point on the server. */
  const acceptAllChanges = useCallback(async () => {
    const p = stateRef.current.project;
    const cur = { ...(stateRef.current.files || {}) };
    setDiffBaseline({ label: 'Accepted state', revisionId: null, files: cur });
    if (p && Object.keys(cur).length) {
      try {
        await request(`studio/projects/${p.id}/save`, {
          method: 'POST',
          body: { files: cur, label: 'accepted changes' },
          timeout: 30_000,
        });
        const revData = await request(`studio/projects/${p.id}/revisions`, { timeout: 15_000 }).catch(() => null);
        if (revData?.revisions) setRevisions(revData.revisions);
        setDirty({});
        setSavedAt(Date.now());
      } catch { /* baseline still accepted locally */ }
    }
    notify('All changes accepted & saved', 'ok');
  }, [notify]);

  /** Reject every pending change and revert the workspace to the baseline. */
  const rejectAllChanges = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const base = { ...(stateRef.current.diffBaseline?.files || {}) };
    setFiles(base);
    setDirty({});
    const basePaths = Object.keys(base);
    setOpenFiles((prev) => prev.filter((f) => f in base));
    if (stateRef.current.activeFile && !(stateRef.current.activeFile in base)) {
      setActiveFile(basePaths[0] || null);
    }
    await persistFiles(base, { label: 'rejected pending changes' });
    setPreviewNonce((n) => n + 1);
    notify('All pending changes reverted', 'ok');
  }, [notify, persistFiles]);

  /* ============================ real checks =============================== */
  const runChecks = useCallback(async ({ includeServer = false, quiet = false } = {}) => {
    const curFiles = stateRef.current.files || {};
    const p = stateRef.current.project;
    const paths = Object.keys(curFiles);
    if (!paths.length) {
      const empty = emptyChecks();
      empty.summary = 'warn';
      empty.lastRunAt = new Date().toISOString();
      empty.items = [{
        id: 'no-files', name: 'Workspace files', category: 'static', status: 'warn',
        durationMs: 0, detail: 'No files to check yet.', logs: '',
      }];
      setChecks(empty);
      return empty;
    }

    setChecks((c) => ({ ...c, running: true }));
    const items = [];

    /* 1) Static checks (JSON validity, HTML asset refs, source integrity) */
    const staticItems = runStaticChecks(curFiles);
    items.push(...staticItems);
    setChecks({ running: true, summary: 'idle', lastRunAt: new Date().toISOString(), items: [...items] });

    /* 2) Real esbuild-wasm / preview compilation check */
    const tBuild = Date.now();
    try {
      const built = await buildPreview(curFiles, p?.entry || '');
      const buildMs = Date.now() - tBuild;
      if (built.kind === 'error') {
        items.push({
          id: 'bundle',
          name: 'Build & syntax compilation (esbuild)',
          category: 'build',
          status: 'fail',
          durationMs: buildMs,
          detail: built.title || 'Compilation failed',
          logs: [built.error, ...(built.warnings || [])].filter(Boolean).join('\n'),
        });
      } else if (built.kind === 'server-only') {
        items.push({
          id: 'bundle',
          name: 'Build mode detection',
          category: 'build',
          status: 'pass',
          durationMs: buildMs,
          detail: 'Server/Node project — use Runtime check for command verification',
          logs: (built.warnings || []).join('\n'),
        });
      } else {
        const warns = built.warnings || [];
        items.push({
          id: 'bundle',
          name: `Build & bundle (${built.kind})`,
          category: 'build',
          status: warns.length ? 'warn' : 'pass',
          durationMs: buildMs,
          detail: warns.length ? `Compiled with ${warns.length} warning(s)` : 'Compiled cleanly with zero errors',
          logs: warns.join('\n'),
        });
      }
    } catch (e) {
      items.push({
        id: 'bundle',
        name: 'Build & bundle check',
        category: 'build',
        status: 'fail',
        durationMs: Date.now() - tBuild,
        detail: e?.message || 'Bundler error',
        logs: String(e?.stack || e?.message || e),
      });
    }

    /* 3) Live preview runtime console error inspection */
    const runtimeErrors = (stateRef.current.consoleEntries || []).filter((e) => e.level === 'error');
    items.push({
      id: 'runtime-console',
      name: 'Preview runtime console',
      category: 'runtime',
      status: runtimeErrors.length ? 'fail' : 'pass',
      durationMs: 1,
      detail: runtimeErrors.length
        ? `${runtimeErrors.length} runtime error(s) captured`
        : 'No uncaught runtime errors',
      logs: runtimeErrors.map((e) => e.text).join('\n'),
    });

    /* 4) Optional real server command check (npm test / npm run build / node --check) */
    if (includeServer && p && stateRef.current.session?.runtime?.ready) {
      let cmd = '';
      let kind = 'test';
      let label = 'Server verification';
      if (curFiles['package.json']) {
        try {
          const pkg = JSON.parse(curFiles['package.json']);
          const testScript = String(pkg?.scripts?.test || '');
          const buildScript = String(pkg?.scripts?.build || '');
          if (testScript && !testScript.includes('no test specified')) {
            cmd = 'npm test';
            kind = 'test';
            label = 'Test suite (npm test)';
          } else if (buildScript) {
            cmd = 'npm run build';
            kind = 'build';
            label = 'Production build (npm run build)';
          }
        } catch { /* caught by JSON check above */ }
      }
      if (!cmd) {
        const jsFiles = paths.filter((f) => /\.(m?js|cjs)$/i.test(f) && !/node_modules/.test(f)).slice(0, 12);
        if (jsFiles.length) {
          cmd = jsFiles.map((f) => `node --check "${f.replace(/"/g, '')}"`).join(' && ');
          kind = 'exec';
          label = `Node syntax check (${jsFiles.length} file${jsFiles.length === 1 ? '' : 's'})`;
        }
      }
      if (cmd) {
        const tSrv = Date.now();
        let logs = '';
        let exitCode = null;
        let errDetail = '';
        setChecks({
          running: true,
          summary: 'idle',
          lastRunAt: new Date().toISOString(),
          items: [...items, { id: 'server', name: label, category: 'server', status: 'running', durationMs: 0, detail: `Running ${cmd}…`, logs: '' }],
        });
        try {
          await streamRequest('studio/exec', { projectId: p.id, command: cmd, kind, files: curFiles }, {
            onEvent: (ev, d) => {
              if (ev === 'log') logs += d.text || '';
              else if (ev === 'done') exitCode = d.exitCode;
              else if (ev === 'error') errDetail = d.detail || d.code || 'execution failed';
            },
          });
        } catch (e) {
          errDetail = e.detail || e.code || e.message;
        }
        const ok = !errDetail && exitCode === 0;
        items.push({
          id: 'server',
          name: label,
          category: 'server',
          status: ok ? 'pass' : 'fail',
          durationMs: Date.now() - tSrv,
          detail: ok ? `Exited 0` : (errDetail || `Exited with code ${exitCode ?? 1}`),
          logs: logs.trim() || errDetail,
        });
      }
    }

    const hasFail = items.some((i) => i.status === 'fail');
    const hasWarn = items.some((i) => i.status === 'warn');
    const summary = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';
    const finalState = { running: false, summary, lastRunAt: new Date().toISOString(), items };
    setChecks(finalState);
    if (!quiet) {
      notify(
        summary === 'pass' ? 'All checks passed' : summary === 'warn' ? 'Checks finished with warnings' : 'Checks found issues to fix',
        summary === 'pass' ? 'ok' : summary === 'warn' ? 'warn' : 'error',
      );
    }
    return finalState;
  }, [notify]);

  /* ================================ agent ================================ */
  const pushActivity = useCallback((entry) => {
    setAgent((a) => ({ ...a, activity: [...a.activity.slice(-50), { ...entry, at: Date.now() }] }));
  }, []);

  const recordStep = useCallback((id, patch) => {
    setAgent((a) => {
      const idx = a.steps.findIndex((s) => s.id === id);
      const next = idx >= 0
        ? a.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s))
        : [...a.steps.slice(-24), { id, at: Date.now(), status: 'running', ...patch }];
      return { ...a, steps: next };
    });
  }, []);

  const applyAgentEvent = useCallback((event, data, mode) => {
    switch (event) {
      case 'user_message':
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message?.id)) return prev;
          const local = prev.find((m) => m.local && m.role === 'user' && m.text === data.message?.text);
          const withoutTemp = prev.filter((m) => m !== local);
          const merged = local?.meta && (local.meta.images?.length || local.meta.docs?.length)
            ? {
              ...data.message,
              meta: {
                ...(data.message.meta || {}),
                ...(local.meta.images?.length ? { images: local.meta.images } : {}),
                ...(local.meta.docs?.length ? { docs: local.meta.docs } : {}),
              },
            }
            : data.message;
          return [...withoutTemp, merged];
        });
        break;
      case 'status': {
        const phase = data.phase
          || (mode === 'plan' ? 'planning' : mode === 'continue' ? 'orchestrating' : 'working');
        setAgent((a) => ({ ...a, step: mode, phase, running: true, error: null }));
        break;
      }
      case 'prose':
        setAgent((a) => ({ ...a, prose: data.text || '' }));
        break;
      case 'file_partial':
        setAgent((a) => ({
          ...a,
          phase: 'working',
          typing: { path: data.path, text: String(data.partial || ''), at: Date.now() },
        }));
        recordStep(`file:${data.path}`, { phase: 'working', label: `Writing ${data.path}`, status: 'running' });
        break;
      case 'file':
        setAgent((a) => ({
          ...a,
          phase: 'working',
          typing: a.typing && a.typing.path === data.path ? null : a.typing,
        }));
        setFiles((prev) => ({
          ...prev,
          [data.path]: data.append ? appendPart(prev[data.path], data.content) : data.content,
        }));
        setOpenFiles((prev) => (prev.includes(data.path) ? prev : (prev.length < 6 ? [...prev, data.path] : prev)));
        setActiveFile((cur) => cur || data.path);
        pushActivity({ kind: 'file', path: data.path, append: Boolean(data.append) });
        recordStep(`file:${data.path}`, {
          phase: 'working',
          label: `${data.append ? 'Appended' : 'Wrote'} ${data.path}`,
          status: 'done',
        });
        break;
      case 'delete':
        setFiles((prev) => { const n = { ...prev }; delete n[data.path]; return n; });
        pushActivity({ kind: 'delete', path: data.path });
        recordStep(`del:${data.path}`, { phase: 'working', label: `Removed ${data.path}`, status: 'done' });
        break;
      case 'plan':
        setAgent((a) => ({ ...a, plan: data.plan, phase: mode === 'plan' ? 'planning' : 'orchestrating' }));
        setProject((p) => (p ? { ...p, plan: data.plan } : p));
        pushActivity({ kind: 'plan', title: data.plan?.title });
        recordStep('plan', {
          phase: 'planning',
          label: data.plan?.title ? `Plan: ${data.plan.title}` : 'Architecture plan ready',
          detail: data.plan?.files?.length ? `${data.plan.files.length} files planned` : '',
          status: 'done',
        });
        break;
      case 'message':
        setAgent((a) => ({ ...a, message: data.text || '' }));
        break;
      case 'done': {
        const pFiles = data.project?.files || {};
        const hasFiles = Object.keys(pFiles).length > 0;
        if (data.project && !data.failed && hasFiles) {
          setTab((t) => (t === 'chat' ? 'preview' : t));
          if (isDesktopViewport()) setWorkspaceOpen(true);
        }
        if (data.project) {
          setProject((prev) => ({ ...(prev || {}), ...data.project }));
          setFiles(pFiles);
          setProjects((prev) => prev.map((x) => (x.id === data.project.id
            ? { ...x, ...data.project, files: undefined, fileCount: data.project.fileCount }
            : x)));
        }
        if (data.assistantMessage) {
          setMessages((prev) => (prev.some((m) => m.id === data.assistantMessage.id) ? prev : [...prev, data.assistantMessage]));
        }
        const stillMissing = Array.isArray(data.missing) && data.missing.length > 0;
        setAgent((a) => ({
          ...a,
          running: false,
          step: null,
          phase: data.failed ? 'error' : (stillMissing ? 'orchestrating' : 'completed'),
          interrupted: data.failed ? a.interrupted : false,
          pending: data.failed ? a.pending : 0,
          plan: data.plan || a.plan,
          provider: data.provider || a.provider,
          model: data.model || a.model,
          error: data.failed ? a.error : null,
          prose: '',
          message: '',
          lastNotes: data.notes || [],
          finishedAt: Date.now(),
          durationMs: a.started ? Date.now() - a.started : (data.latencyMs || 0),
          changedCount: (a.changedCount || 0) + (Array.isArray(data.changed) ? data.changed.length : 0),
        }));
        break;
      }
      case 'error':
        setAgent((a) => ({
          ...a,
          running: false,
          step: null,
          phase: 'error',
          error: data.detail || data.code,
          finishedAt: Date.now(),
        }));
        break;
      default:
        break;
    }
  }, [pushActivity, recordStep]);

  const runAgent = useCallback(async ({ mode, message = '', selectedFile = '', logs = '', projectId, extra = {} }) => {
    const id = projectId || stateRef.current.project?.id;
    if (!id) throw new Error('no project');
    const pref = stateRef.current.modelPref || {};
    let done = null;
    let failure = null;
    await streamRequest('studio/agent', {
      projectId: id,
      mode,
      message,
      selectedFile,
      logs,
      buildMode: stateRef.current.buildMode || DEFAULT_BUILD_MODE,
      ...(pref.provider ? { provider: pref.provider } : {}),
      ...(pref.model ? { model: pref.model } : {}),
      ...extra,
    }, {
      signal: abortRef.current?.signal,
      onEvent: (event, data) => {
        if (event === 'done') done = data;
        if (event === 'error') failure = data;
        applyAgentEvent(event, data, mode);
      },
    });
    if (failure || done?.failed) {
      throw new StudioApiError(
        failure?.code || 'agent_failed',
        failure?.status || 502,
        failure?.detail || 'the model did not finish this step',
      );
    }
    return { done, interrupted: !done };
  }, [applyAgentEvent]);

  const buildUntilComplete = useCallback(async ({ projectId, message, planFiles = [], parts = 0, textPath = '', images = [], docs = [], onRound }) => {
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
      if (round > 1) {
        recordStep(`orch:${round}`, {
          phase: 'orchestrating',
          label: isText ? `Orchestrating section ${round} of ${parts}` : `Orchestrating round ${round} (${missing.length} remaining)`,
          status: 'done',
        });
      }
      const res = await runAgent({
        mode,
        message,
        projectId,
        extra: {
          batch: cfg.batch,
          ...(isText ? { parts, part: round, textPath } : {}),
          ...(round === 1 && images.length ? { images } : {}),
          ...(round === 1 && docs.length ? { docs } : {}),
        },
      });

      if (res.interrupted) {
        lastInterrupted = true;
        interrupted += 1;
        setAgent((a) => ({ ...a, interrupted: true, phase: 'orchestrating', pending: missing.length, running: true }));
        if (interrupted > retries) break;
        await wait(700);
        round -= 1;
        continue;
      }

      const done = res.done || {};
      const progress = (done.changed || []).length;
      if (!isText && Array.isArray(done.missing)) missing = done.missing;

      if (isText) {
        if (progress === 0) break;
        continue;
      }
      if (!missing.length) break;
      if (progress === 0) {
        stalls += 1;
        if (stalls >= 2) break;
      } else {
        stalls = 0;
      }
    }

    const stillInterrupted = lastInterrupted && missing.length > 0;
    setAgent((a) => ({
      ...a,
      interrupted: stillInterrupted,
      pending: missing.length,
      phase: stillInterrupted ? 'interrupted' : 'completed',
    }));
    return { missing, interrupted: lastInterrupted };
  }, [recordStep, runAgent]);

  const stopAgent = useCallback(() => {
    try { abortRef.current?.abort(); } catch { /* already */ }
    setAgent((a) => ({ ...a, running: false, step: null, phase: 'stopped', stopped: true, finishedAt: Date.now() }));
    const current = stateRef.current.files;
    if (Object.keys(current || {}).length) persistFiles(current, { label: 'stopped mid-build' }).catch(() => {});
    notify('Stopped — files written so far are kept', 'warn');
  }, [notify, persistFiles]);

  const appendLocalUser = useCallback((text, images = [], docs = []) => {
    setMessages((prev) => [...prev, {
      id: `local-${Date.now()}`,
      local: true,
      role: 'user',
      kind: 'text',
      text,
      createdAt: new Date().toISOString(),
      meta: {
        ...(images.length ? { images: images.map((im) => ({ url: `data:${im.mime};base64,${im.data}` })) } : {}),
        ...(docs.length ? { docs: docs.map((d) => ({ name: d.name, url: d.url })) } : {}),
      },
    }]);
  }, []);

  const appendLocalError = useCallback((text) => {
    setMessages((prev) => [...prev, {
      id: `err-${Date.now()}`, role: 'error', kind: 'text', text, createdAt: new Date().toISOString(), meta: {},
    }]);
  }, []);

  /**
   * Multi-step AI Agent pipeline:
   * Planning → Orchestrating → Working → (Verification in Review mode) → Completed.
   */
  const send = useCallback(async (rawText, opts = {}) => {
    const text = String(rawText || '').trim();
    if (!text || stateRef.current.agent.running) return;
    const images = Array.isArray(opts.images) ? opts.images : [];
    const docs = Array.isArray(opts.docs) ? opts.docs : [];

    const cfg = buildModeConfig(stateRef.current.buildMode);
    let p = stateRef.current.project;
    const preRunFiles = p ? { ...(stateRef.current.files || {}) } : {};
    const empty = !p || Object.keys(preRunFiles).length === 0;
    const chatOnly = empty && (opts.chatOnly || shouldUseChatMode(text, { hasImages: images.length > 0, buildMode: cfg.id }));

    setActiveView('chat');
    abortRef.current = new AbortController();

    /* Capture exact baseline before this AI run so Diff & Checks can review/revert it */
    setDiffBaseline({
      label: empty ? 'Before initial build' : `Before: ${text.slice(0, 44)}`,
      revisionId: null,
      files: preRunFiles,
    });

    const initialPhase = chatOnly ? 'working' : (empty && cfg.plan && !cfg.append ? 'planning' : 'working');
    setAgent({
      ...emptyAgent(),
      running: true,
      phase: initialPhase,
      step: chatOnly ? 'chat' : (cfg.plan && !cfg.append ? 'plan' : 'create'),
      steps: [{
        id: initialPhase === 'planning' ? 'plan' : 'init',
        phase: initialPhase,
        label: chatOnly ? 'Analyzing & responding' : (initialPhase === 'planning' ? 'Planning project architecture' : 'Working on workspace files'),
        status: 'running',
        at: Date.now(),
      }],
      started: Date.now(),
      buildMode: cfg.id,
    });

    try {
      if (!p) {
        p = await createProject({
          prompt: text,
          meta: { kind: chatOnly ? 'chat' : 'project' },
          keepAgent: true,
        });
      }
      appendLocalUser(text, images, docs);

      if (chatOnly) {
        await runAgent({
          mode: 'chat',
          message: text,
          projectId: p.id,
          extra: { ...(docs.length ? { docs } : {}) },
        });
        recordStep('init', { phase: 'completed', label: 'Response ready', status: 'done' });
      } else if (empty && cfg.append) {
        const textPath = textTargetPath(text, 'document.md');
        pushActivity({ kind: 'note', text: `writing ${textPath} · ${cfg.parts} sections` });
        const built = await buildUntilComplete({
          projectId: p.id,
          message: text,
          parts: cfg.parts,
          textPath,
          images,
          docs,
          onRound: ({ round, maxRounds }) => {
            setAgent((a) => ({
              ...a,
              running: true,
              phase: round === 1 ? 'working' : 'orchestrating',
              step: round === 1 ? 'create' : 'continue',
              round,
              maxRounds,
            }));
            if (round > 1) pushActivity({ kind: 'note', text: `section ${round}` });
          },
        });
        if (built.missing.length) pushActivity({ kind: 'note', text: `${built.missing.length} file(s) still missing` });
        if (built.interrupted && built.missing.length) notify('Connection interrupted — saved progress can be resumed', 'warn');
      } else if (empty) {
        let planFiles = [];
        if (cfg.plan) {
          const planRes = await runAgent({
            mode: 'plan',
            message: text,
            projectId: p.id,
            extra: { ...(images.length ? { images } : {}), ...(docs.length ? { docs } : {}) },
          });
          planFiles = (planRes.done?.missing?.length
            ? planRes.done.missing
            : (planRes.done?.plan?.files || planRes.done?.project?.plan?.files || []).map((f) => f.path));
          if (planRes.interrupted && !planFiles.length) {
            throw new StudioApiError('run_interrupted', 0, 'the plan was cut off — press Continue build to resume');
          }
          if (planFiles.length) {
            setAgent((a) => ({ ...a, running: true, phase: 'orchestrating', step: 'create' }));
            recordStep('orchestrate-start', {
              phase: 'orchestrating',
              label: `Orchestrating ${planFiles.length} file${planFiles.length === 1 ? '' : 's'}`,
              status: 'done',
            });
          }
        }
        const built = await buildUntilComplete({
          projectId: p.id,
          message: text,
          planFiles,
          images,
          docs,
          onRound: ({ round, missing, maxRounds }) => {
            setAgent((a) => ({
              ...a,
              running: true,
              phase: round > 1 ? 'orchestrating' : 'working',
              step: round === 1 ? 'create' : 'continue',
              round,
              maxRounds,
            }));
            if (missing) pushActivity({ kind: 'note', text: `round ${round} · ${missing} file(s) queued` });
          },
        });
        if (built.missing.length) {
          pushActivity({ kind: 'note', text: `${built.missing.length} file(s) still missing` });
          if (built.interrupted) notify('Connection cut — saved work can be resumed', 'warn');
        }
      } else {
        setAgent((a) => ({ ...a, running: true, phase: 'working', step: 'edit' }));
        await runAgent({
          mode: 'edit',
          message: text,
          selectedFile: stateRef.current.activeFile || '',
          projectId: p.id,
          extra: { ...(images.length ? { images } : {}), ...(docs.length ? { docs } : {}) },
        });
        recordStep('init', { phase: 'working', label: 'Applied workspace updates', status: 'done' });
      }

      /* In Review mode, run real automated verification and self-fix compile errors */
      const writtenFiles = Object.keys(stateRef.current.files || {});
      if (cfg.review && writtenFiles.length) {
        setAgent((a) => ({ ...a, running: true, phase: 'orchestrating', step: 'review' }));
        recordStep('verify', { phase: 'orchestrating', label: 'Running verification checks', status: 'running' });
        const checkResult = await runChecks({ includeServer: false, quiet: true });
        const failed = checkResult.items.filter((i) => i.status === 'fail' && i.logs);
        if (failed.length) {
          recordStep('verify', { phase: 'orchestrating', label: 'Repairing detected build issue', status: 'running' });
          const errLogs = failed.map((f) => `${f.name}:\n${f.logs}`).join('\n\n');
          await runAgent({ mode: 'fix', logs: errLogs, message: 'Fix the verification failure.', projectId: p.id });
          await runChecks({ includeServer: false, quiet: true });
        }
        recordStep('verify', { phase: 'completed', label: 'Verification complete', status: 'done' });
      }

      if (writtenFiles.length) {
        if (empty) {
          setTab('preview');
          if (isDesktopViewport()) setWorkspaceOpen(true);
        }
        setPreviewNonce((n) => n + 1);
        /* Refresh revision list silently so Diff & Checks has the latest snapshots */
        request(`studio/projects/${p.id}/revisions`, { timeout: 15_000 })
          .then((d) => { if (d?.revisions) setRevisions(d.revisions); })
          .catch(() => {});
      }
      setAgent((a) => ({
        ...a,
        running: false,
        phase: a.error ? 'error' : (a.interrupted && a.pending > 0 ? 'interrupted' : 'completed'),
        finishedAt: Date.now(),
        durationMs: a.started ? Date.now() - a.started : a.durationMs,
      }));
    } catch (e) {
      if (e.code === 'aborted') {
        /* user pressed stop */
      } else if (e.code === 'ai_not_configured') {
        setAgent((a) => ({ ...a, running: false, step: null, phase: 'error', error: 'ai_not_configured' }));
        appendLocalError('No AI provider is connected. Open Settings → Models and add an API key.');
        openSettings('models');
      } else if (e.code === 'unauthorized') {
        setBootError({ code: 'unauthorized' });
      } else {
        setAgent((a) => ({ ...a, running: false, step: null, phase: 'error', error: e.detail || e.code }));
      }
    } finally {
      setAgent((a) => ({ ...a, running: false }));
      loadProjects().catch(() => {});
    }
  }, [appendLocalError, appendLocalUser, buildUntilComplete, createProject, loadProjects, notify, openSettings, pushActivity, recordStep, runAgent, runChecks]);

  const fixWithAI = useCallback(async (logs) => {
    const p = stateRef.current.project;
    if (!p || stateRef.current.agent.running) return;
    setDiffBaseline({ label: 'Before AI fix', revisionId: null, files: { ...(stateRef.current.files || {}) } });
    abortRef.current = new AbortController();
    setAgent({
      ...emptyAgent(),
      running: true,
      phase: 'working',
      step: 'fix',
      steps: [{ id: 'fix', phase: 'working', label: 'Diagnosing & fixing error', status: 'running', at: Date.now() }],
      started: Date.now(),
    });
    try {
      const fix = await runAgent({ mode: 'fix', logs, message: 'Fix the failure shown in the output.', projectId: p.id });
      recordStep('fix', { phase: 'completed', label: 'Applied fix', status: 'done' });
      if (fix.interrupted) notify('The fix was cut off — check the output and try again', 'warn');
      setPreviewNonce((n) => n + 1);
      setTab('preview');
      setWorkspaceOpen(true);
    } catch (e) {
      notify(`Fix failed: ${e.detail || e.code}`, 'error');
    } finally {
      setAgent((a) => ({ ...a, running: false, step: null, phase: a.error ? 'error' : 'completed', finishedAt: Date.now() }));
    }
  }, [notify, recordStep, runAgent]);

  /* =============================== terminal =============================== */
  const runTerminal = useCallback(async (command, kind = 'exec') => {
    const p = stateRef.current.project;
    if (!p || !command.trim() || stateRef.current.terminal.running) return;
    setTerminal({ running: true, logs: `$ ${command}\n`, kind, command, runId: null, exitCode: null, durationMs: null, engine: null, error: null });
    setTab('terminal');
    setWorkspaceOpen(true);
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

  const clearTerminal = useCallback(() => setTerminal({
    running: false, logs: '', kind: null, command: '', runId: null, exitCode: null, durationMs: null, engine: null, error: null,
  }), []);

  /* ============================== dev server ============================== */
  const startDev = useCallback(async (command = '') => {
    const p = stateRef.current.project;
    if (!p) return;
    setDevServer((d) => ({ ...d, starting: true, error: null }));
    try {
      const res = await request(`studio/projects/${p.id}/dev/start`, { method: 'POST', body: { command }, timeout: 150_000 });
      setDevServer({
        running: true, url: res.url, ready: Boolean(res.ready), starting: false,
        engine: res.engine, logs: res.logs || '',
        error: res.ready ? null : 'the dev server did not answer yet — check the terminal',
      });
      setPreviewMode('server');
      try { localStorage.setItem(PREVIEW_PREF, 'server'); } catch { /* ignore */ }
      setTab('preview');
      setWorkspaceOpen(true);
      notify(res.ready ? 'Dev server is running' : 'Dev server started, waiting for it to answer', res.ready ? 'ok' : 'warn');
    } catch (e) {
      setDevServer({ running: false, url: null, ready: false, starting: false, engine: null, logs: '', error: e.detail || e.code });
      setTab('terminal');
      setWorkspaceOpen(true);
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
    try { localStorage.setItem(PREVIEW_PREF, 'bundle'); } catch { /* ignore */ }
  }, []);

  const switchPreview = useCallback((mode) => {
    setPreviewMode(mode);
    try { localStorage.setItem(PREVIEW_PREF, mode); } catch { /* ignore */ }
  }, []);

  const logConsole = useCallback((entry) => {
    setConsoleEntries((prev) => [...prev.slice(-120), entry]);
  }, []);

  const resumeBuild = useCallback(async () => {
    const p = stateRef.current.project;
    if (!p || stateRef.current.agent.running) return null;
    const planFiles = (p.plan?.files || []).map((f) => f.path);
    abortRef.current = new AbortController();
    setAgent((a) => ({ ...a, running: true, phase: 'orchestrating', step: 'continue', error: null, interrupted: false, started: Date.now() }));
    try {
      const built = await buildUntilComplete({
        projectId: p.id,
        message: p.description || 'Continue building the project until every planned file exists.',
        planFiles,
        onRound: ({ round, missing }) => {
          setAgent((a) => ({ ...a, running: true, phase: 'working', step: round === 1 ? 'create' : 'continue', round }));
          if (missing) pushActivity({ kind: 'note', text: `round ${round} · ${missing} file(s) queued` });
        },
      });
      setPreviewNonce((n) => n + 1);
      if (!built.missing.length) notify('Build complete', 'ok');
      else if (!built.interrupted) notify(`${built.missing.length} file(s) still missing`, 'warn');
      await loadProjects().catch(() => {});
      return built;
    } catch (e) {
      if (e.code !== 'aborted') setAgent((a) => ({ ...a, phase: 'error', error: e.detail || e.code }));
      return null;
    } finally {
      setAgent((a) => ({ ...a, running: false }));
    }
  }, [buildUntilComplete, loadProjects, notify, pushActivity]);

  /* ====================== Google Drive & Google Docs ====================== */
  const readDriveDoc = useCallback(async (id) => {
    const data = await request('studio/drive/read', { method: 'POST', body: { id }, timeout: 60_000 });
    const doc = data.document;
    notify(`Read “${doc.name}”${doc.truncated ? ' (trimmed)' : ''}`, 'ok');
    return doc;
  }, [notify]);

  const exportToDrive = useCallback(async ({ as = 'doc', zipBase64 = null, name = '' } = {}) => {
    const p = stateRef.current.project;
    if (!p) return null;
    const data = await request('studio/drive/export', {
      method: 'POST',
      body: { projectId: p.id, as, zipBase64, name },
      timeout: 90_000,
    });
    setDeployments((prev) => [{
      id: `drive-${Date.now()}`,
      provider: 'google',
      status: 'exported',
      url: data.export?.url,
      createdAt: new Date().toISOString(),
    }, ...prev]);
    notify(`Saved to Drive: ${data.export?.name || 'project'}`, 'ok');
    return data.export;
  }, [notify]);

  const searchDriveFiles = useCallback(async ({ q = '', kind = 'all' } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (kind && kind !== 'all') params.set('kind', kind);
    return request(`studio/drive/files?${params.toString()}`, { timeout: 30_000 });
  }, []);

  const manageDrive = useCallback(async (payload) => {
    const res = await request('studio/drive/manage', { method: 'POST', body: payload, timeout: 45_000 });
    loadAccounts().catch(() => {});
    return res;
  }, [loadAccounts]);

  const readGoogleDoc = useCallback(async (id) => {
    const data = await request('studio/docs/read', { method: 'POST', body: { id }, timeout: 45_000 });
    return data.doc;
  }, []);

  const createGoogleDoc = useCallback(async ({ title, content = '' }) => {
    const data = await request('studio/docs/create', {
      method: 'POST',
      body: { projectId: stateRef.current.project?.id || null, title, content },
      timeout: 45_000,
    });
    loadAccounts().catch(() => {});
    notify(`Created Google Doc “${data.doc?.title || title}”`, 'ok');
    return data.doc;
  }, [loadAccounts, notify]);

  const updateGoogleDoc = useCallback(async (payload) => {
    const data = await request('studio/docs/update', { method: 'POST', body: payload, timeout: 45_000 });
    notify('Saved changes to Google Docs', 'ok');
    return data.doc;
  }, [notify]);

  /* ======================== GitHub repos & branches ======================= */
  const fetchRepoBranches = useCallback(async (repo) => {
    if (!repo) return null;
    const data = await request(`studio/repos/branches?repo=${encodeURIComponent(repo)}`, { timeout: 30_000 });
    setBranchCache((prev) => ({ ...prev, [data.repo || repo]: data }));
    return data;
  }, []);

  const createRepoBranch = useCallback(async ({ repo, branch, from = '' }) => {
    const p = stateRef.current.project;
    const created = await request('studio/repos/branches', {
      method: 'POST',
      body: { projectId: p?.id || null, repo, branch, from },
      timeout: 35_000,
    });
    if (p) {
      setProject((cur) => (cur ? { ...cur, meta: { ...(cur.meta || {}), repo: created.repo, branch: created.branch } } : cur));
    }
    fetchRepoBranches(created.repo).catch(() => {});
    notify(`Created branch ${created.branch}`, 'ok');
    return created;
  }, [fetchRepoBranches, notify]);

  const importRepo = useCallback(async ({ repo, ref, name, intoCurrent = false } = {}) => {
    const curProj = intoCurrent ? stateRef.current.project : null;
    const prevFiles = curProj ? { ...(stateRef.current.files || {}) } : null;
    const data = await request('studio/repos/import', {
      method: 'POST',
      body: {
        repo,
        ref: ref || '',
        name: name || '',
        ...(curProj ? { projectId: curProj.id } : {}),
      },
      timeout: 180_000,
    });
    const nextFiles = data.project.files || {};
    const projectWithMeta = {
      ...data.project,
      meta: {
        ...(data.project.meta || {}),
        repo: data.repo?.full || repo,
        branch: data.repo?.ref || ref || 'main',
        defaultBranch: data.repo?.defaultBranch || data.repo?.ref || 'main',
      },
    };
    setProject(projectWithMeta);
    setFiles(nextFiles);
    setDiffBaseline({
      label: prevFiles && Object.keys(prevFiles).length ? 'Before branch sync' : `Imported ${data.repo?.full || repo}@${data.repo?.ref || 'main'}`,
      revisionId: null,
      files: { ...nextFiles },
    });
    if (!curProj) {
      setMessages([]);
      setRevisions([]);
      setDeployments([]);
    }
    setDirty({});
    setProjects((prev) => [
      { ...projectWithMeta, files: undefined },
      ...prev.filter((p) => p.id !== projectWithMeta.id),
    ]);
    try { localStorage.setItem(LAST_PROJECT, String(projectWithMeta.id)); } catch { /* private mode */ }
    setActiveFile(projectWithMeta.entry || Object.keys(nextFiles)[0] || null);
    setOpenFiles(projectWithMeta.entry ? [projectWithMeta.entry] : Object.keys(nextFiles).slice(0, 1));
    setTab('preview');
    setWorkspaceOpen(true);
    setActiveView('chat');
    notify(`Imported ${data.repo.imported} files from ${data.repo.full}@${data.repo.ref}`, 'ok');
    loadProjects().catch(() => {});
    return data;
  }, [loadProjects, notify]);

  const commitFileToGithub = useCallback(async ({ repo, path, content, branch = '', message = '' }) => {
    const p = stateRef.current.project;
    const targetRepo = repo || p?.meta?.repo;
    const targetBranch = branch || p?.meta?.branch || '';
    const filePath = path || stateRef.current.activeFile;
    const fileContent = typeof content === 'string' ? content : stateRef.current.files?.[filePath];
    if (!targetRepo || !filePath || typeof fileContent !== 'string') return null;
    const saved = await request('studio/repos/file/save', {
      method: 'POST',
      body: {
        projectId: p?.id || null,
        repo: targetRepo,
        path: filePath,
        content: fileContent,
        branch: targetBranch,
        message: message || `Update ${filePath}`,
      },
      timeout: 45_000,
    });
    setDirty((d) => { const n = { ...d }; delete n[filePath]; return n; });
    notify(`Committed ${filePath} to ${targetRepo}${targetBranch ? `@${targetBranch}` : ''}`, 'ok');
    return saved;
  }, [notify]);

  const pushBranch = useCallback(async ({ repo, branch = '', base = '', message = '', pr = true } = {}) => {
    const p = stateRef.current.project;
    if (!p) return null;
    const baseFiles = stateRef.current.diffBaseline?.files || {};
    const curFiles = stateRef.current.files || {};
    const deletePaths = Object.keys(baseFiles).filter((k) => !(k in curFiles));
    const data = await request('studio/repos/push', {
      method: 'POST',
      body: {
        projectId: p.id,
        repo,
        branch,
        base,
        message,
        pr,
        ...(deletePaths.length ? { deletePaths } : {}),
      },
      timeout: 180_000,
    });
    setProject((cur) => (cur ? {
      ...cur,
      meta: { ...(cur.meta || {}), repo: data.repo || repo, branch: data.branch || branch, defaultBranch: data.base || base || cur.meta?.defaultBranch || 'main' },
    } : cur));
    setDeployments((prev) => [{
      id: data.deployment?.id || Date.now(),
      provider: 'github',
      status: data.pull ? 'pr_open' : 'ready',
      url: data.pull?.url || data.commitUrl || data.url,
      createdAt: new Date().toISOString(),
    }, ...prev]);
    notify(
      data.pull ? `Pull request #${data.pull.number} opened on ${data.repo}` : `Pushed ${data.files} files to ${data.repo}@${data.branch}`,
      'ok',
    );
    return data;
  }, [notify]);

  /* ================================ Vercel ================================ */
  const deployVercel = useCallback(async ({ existingProjectId = null, name = '', target = 'production' } = {}) => {
    const p = stateRef.current.project;
    if (!p) return null;
    try {
      const data = await request(`studio/projects/${p.id}/deploy/vercel`, {
        method: 'POST',
        body: { name: name || p.name, existingProjectId, target },
        timeout: 90_000,
      });
      setDeployments((prev) => [data.deployment, ...prev]);
      notify('Deployment queued on Vercel');
      const id = data.deployment?.id;
      if (id) {
        for (let i = 0; i < 20; i += 1) {
          await wait(3000);
          let state = null;
          try { state = await request(`studio/deploy/vercel/${encodeURIComponent(id)}`, { timeout: 25_000 }); }
          catch { break; }
          setDeployments((prev) => prev.map((d) => (d.id === id ? { ...d, state: state.state, status: state.state, url: state.url || d.url } : d)));
          if (state.state === 'READY') { notify(`Live: ${state.url || data.deployment.url}`, 'ok'); break; }
          if (state.state === 'ERROR' || state.state === 'CANCELED') { notify(`Vercel build ${state.state.toLowerCase()}`, 'error'); break; }
        }
      }
      return data.deployment;
    } catch (e) {
      if (e.code === 'vercel_not_connected') { openSettings('integrations'); notify('Connect Vercel first', 'warn'); }
      else notify(`Deploy failed: ${e.detail || e.code}`, 'error');
      return null;
    }
  }, [notify, openSettings]);

  const followVercelProject = useCallback(async ({ id = null, name = '', attempts = 20 } = {}) => {
    let last = null;
    for (let i = 0; i < attempts; i += 1) {
      try {
        last = await request('studio/vercel/state', { method: 'POST', body: { id, name }, timeout: 25_000 });
      } catch (e) {
        notify(`Vercel: ${e.detail || e.code}`, 'error');
        return null;
      }
      if (!last.hasDeployment) { notify(`${last.name}: no deployment yet`, 'warn'); return last; }
      if (last.state === 'READY') { notify(`Live: ${last.url}`, 'ok'); return last; }
      if (last.state === 'ERROR' || last.state === 'CANCELED') { notify(`Vercel build ${last.state.toLowerCase()}`, 'error'); return last; }
      await wait(3000);
    }
    notify('Vercel is still building — check again in a minute', 'warn');
    return last;
  }, [notify]);

  const pushGithub = useCallback(async ({ repo, isPrivate = true, message, branch = 'main' } = {}) => {
    const p = stateRef.current.project;
    if (!p) return null;
    try {
      const data = await request(`studio/projects/${p.id}/deploy/github`, {
        method: 'POST',
        body: { repo, private: isPrivate, message, branch },
        timeout: 120_000,
      });
      setDeployments((prev) => [data.deployment, ...prev]);
      setProject((cur) => (cur ? {
        ...cur,
        meta: { ...(cur.meta || {}), repo: data.deployment?.repo || repo, branch: data.deployment?.branch || branch },
      } : cur));
      notify(`Pushed to github.com/${data.deployment.repo}`, 'ok');
      loadAccounts().catch(() => {});
      return data.deployment;
    } catch (e) {
      if (e.code === 'github_not_connected') { openSettings('integrations'); notify('Connect GitHub first', 'warn'); }
      else notify(`GitHub failed: ${e.detail || e.code}`, 'error');
      return null;
    }
  }, [loadAccounts, notify, openSettings]);

  /* ======================= keys, OAuth & leaderboard ====================== */
  const saveKey = useCallback(async (provider, key, model) => {
    const data = await request('studio/ai/keys', { method: 'POST', body: { provider, key, model }, timeout: 45_000 });
    await refreshSession();
    return data;
  }, [refreshSession]);

  const removeKey = useCallback(async (provider) => {
    await request(`studio/ai/keys/${provider}`, { method: 'DELETE', timeout: 20_000 });
    await refreshSession();
  }, [refreshSession]);

  const testModel = useCallback(async (provider, key, model) =>
    request('studio/ai/test', { method: 'POST', body: { provider, key, model }, timeout: 40_000 }), []);

  const voteOnMessage = useCallback(async (messageId, vote) => {
    if (!messageId || String(messageId).startsWith('local-')) return null;
    const res = await request(`studio/messages/${messageId}/vote`, {
      method: 'POST',
      body: { vote },
      timeout: 15_000,
    });
    setMessages((prev) => prev.map((m) => (m.id === messageId
      ? { ...m, meta: { ...(m.meta || {}), vote: res.vote } }
      : m)));
    return res;
  }, []);

  const connectIntegration = useCallback(async (provider, token) => {
    const data = await request(`studio/integrations/${provider}`, { method: 'POST', body: { token }, timeout: 40_000 });
    await refreshSession();
    await loadAccounts().catch(() => {});
    return data;
  }, [loadAccounts, refreshSession]);

  const connectOAuth = useCallback(async (provider) => {
    return launchOAuth(provider, {
      onComplete: async (msg) => {
        await refreshSession();
        await loadAccounts().catch(() => {});
        if (!msg?.closed) notify(`Connected ${msg?.account || provider}`, 'ok');
      },
      onError: (err) => notify(String(err || 'OAuth authorization failed'), 'error'),
    });
  }, [loadAccounts, notify, refreshSession]);

  const disconnectIntegration = useCallback(async (provider) => {
    await request(`studio/integrations/${provider}`, { method: 'DELETE', timeout: 20_000 });
    await refreshSession();
    setAccounts((a) => ({ ...a, [provider]: { connected: false } }));
    notify(`Disconnected ${provider}`);
  }, [notify, refreshSession]);

  /* ------------------------------- shortcuts ------------------------------ */
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v); }
      if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        if (!isDesktopViewport()) setSidebarOpen(false);
      }
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
    diffBaseline, setDiffBaseline, projectDiff, diffFocusPath, setDiffFocusPath,
    viewAllChanges, setViewAllChanges, openDiffView, openChecksView,
    compareWithRevision, acceptFileChange, rejectFileChange, rejectFileHunk, acceptAllChanges, rejectAllChanges,
    checks, runChecks,
    openFiles, setOpenFiles, activeFile, setActiveFile, dirty, saving, savedAt,
    activeView, setActiveView,
    tab, setTab: selectWorkspaceTab, workspaceOpen, setWorkspaceOpen,
    device, setDevice,
    settingsOpen, setSettingsOpen, settingsTab, setSettingsTab, openSettings,
    docsModalOpen, setDocsModalOpen, docsModalInit, openDocsModal,
    sidebarOpen, setSidebarOpen,
    controlBarOpen, setControlBarOpen,
    theme, setTheme,
    modelPref, setModelPref,
    paletteOpen, setPaletteOpen,
    agent, terminal, toast, notify,
    previewMode, switchPreview, devServer, startDev, stopDev, previewNonce, setPreviewNonce,
    consoleEntries, logConsole,
    startNewChat, createProject, openProject, deleteProject, renameProject, archiveProject, updateProjectMeta, loadProjects,
    writeFile, addFile, removeFile, renameFile, saveNow, restoreRevision, persistFiles,
    send, stopAgent, fixWithAI, resumeBuild, runTerminal, clearTerminal,
    accounts, loadAccounts, branchCache, fetchRepoBranches, createRepoBranch, commitFileToGithub,
    buildMode, setBuildMode, BUILD_MODES,
    importRepo, pushBranch, followVercelProject,
    readDriveDoc, exportToDrive, searchDriveFiles, manageDrive,
    readGoogleDoc, createGoogleDoc, updateGoogleDoc,
    deployVercel, pushGithub,
    saveKey, removeKey, testModel, voteOnMessage,
    connectIntegration, connectOAuth, disconnectIntegration,
  }), [
    session, booting, bootError, boot, refreshSession,
    projects, project, messages, revisions, deployments, files,
    diffBaseline, projectDiff, diffFocusPath, viewAllChanges, openDiffView, openChecksView,
    compareWithRevision, acceptFileChange, rejectFileChange, rejectFileHunk, acceptAllChanges, rejectAllChanges,
    checks, runChecks,
    openFiles, activeFile, dirty, saving, savedAt,
    activeView, tab, selectWorkspaceTab, workspaceOpen, device,
    settingsOpen, settingsTab, openSettings, docsModalOpen, docsModalInit, openDocsModal,
    sidebarOpen, controlBarOpen, setControlBarOpen, theme, setTheme, modelPref, setModelPref,
    paletteOpen, agent, terminal, toast, notify,
    previewMode, switchPreview, devServer, startDev, stopDev, previewNonce, consoleEntries, logConsole,
    startNewChat, createProject, openProject, deleteProject, renameProject, archiveProject, updateProjectMeta, loadProjects,
    writeFile, addFile, removeFile, renameFile, saveNow, restoreRevision, persistFiles,
    send, stopAgent, fixWithAI, resumeBuild, runTerminal, clearTerminal,
    accounts, loadAccounts, branchCache, fetchRepoBranches, createRepoBranch, commitFileToGithub,
    buildMode, setBuildMode,
    importRepo, pushBranch, followVercelProject,
    readDriveDoc, exportToDrive, searchDriveFiles, manageDrive,
    readGoogleDoc, createGoogleDoc, updateGoogleDoc,
    deployVercel, pushGithub,
    saveKey, removeKey, testModel, voteOnMessage,
    connectIntegration, connectOAuth, disconnectIntegration,
  ]);

  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
}
