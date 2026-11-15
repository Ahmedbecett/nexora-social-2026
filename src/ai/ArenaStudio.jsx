import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../api.js';
import { getLang, isRtl } from '../i18n.js';
import { makeStudioT } from './studioStrings.js';
import { TEMPLATES, DEFAULT_TEMPLATE, templateName, templateDesc } from './studioTemplates.js';
import { buildPreviewDocument, entryFile, fileLang, fileIcon } from './studioPreview.js';
import CodeEditor from './CodeEditor.jsx';

/* ── pipeline steps ── */
const STEPS = [
  { id: 'plan', icon: '📋', ar: 'خطط', en: 'Plan' },
  { id: 'create', icon: '⚡', ar: 'أنشئ', en: 'Create' },
  { id: 'execute', icon: '▶️', ar: 'نفّذ', en: 'Execute' },
  { id: 'test', icon: '🧪', ar: 'اختبر', en: 'Test' },
  { id: 'debug', icon: '🐛', ar: 'صحّح', en: 'Debug' },
  { id: 'deploy', icon: '🚀', ar: 'انشر', en: 'Deploy' },
];

const FRAMEWORKS = [
  ['static', 'Static (HTML)'],
  ['vite', 'Vite + React'],
  ['next', 'Next.js'],
  ['api', 'Node API (Express)'],
];

const FILES_KEY = 'nx_arena_files';
const ORIGIN_KEY = 'nx_arena_origin';

/**
 * مصدر الملفات الحالي — لتمييز البيانات التجريبية عن البيانات الحقيقية:
 *  template  = قالب NEXORA جاهز ببيانات توضيحية (sample)
 *  generated = مولّد الآن ولم يُنشر
 *  saved     = مشروع محفوظ في قاعدة البيانات
 *  local     = تعديلات محلية في المتصفح
 */
function loadBoot() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILES_KEY) || 'null');
    if (saved && typeof saved === 'object' && Object.keys(saved).length) {
      const stored = localStorage.getItem(ORIGIN_KEY);
      const origin = stored === 'template' || stored === 'generated' ? stored : 'local';
      return { files: saved, origin };
    }
  } catch { /* ignore */ }
  return { files: { ...DEFAULT_TEMPLATE.files }, origin: 'template' };
}

function useIsMobile(query = '(max-width: 900px)') {
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false);
  const [mobile, setMobile] = useState(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const onChange = (ev) => setMobile(ev.matches);
    setMobile(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, [query]);
  return mobile;
}

function defaultToast(message) {
  try {
    const el = document.createElement('div');
    el.textContent = message;
    el.className = 'nx-s-toast';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  } catch { /* ignore */ }
}

const STATUS_CLASS = { idle: 'idle', running: 'running', success: 'success', validated: 'validated', failed: 'failed' };

export default function ArenaStudio({ toast }) {
  const toastFn = toast || defaultToast;
  const lang = getLang() === 'ar' ? 'ar' : 'en';
  const rtl = isRtl();
  const t = useMemo(() => makeStudioT(lang), [lang]);
  const isMobile = useIsMobile();

  /* ── project state ── */
  const bootRef = useRef(null);
  if (!bootRef.current) bootRef.current = loadBoot();

  const [files, setFiles] = useState(bootRef.current.files);
  const [active, setActive] = useState(() => entryFile(bootRef.current.files) || Object.keys(bootRef.current.files).sort()[0] || 'index.html');
  const [origin, setOrigin] = useState(bootRef.current.origin);
  const [dirty, setDirty] = useState(false);

  const [projects, setProjects] = useState([]);
  const [projectsError, setProjectsError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [framework, setFramework] = useState('static');
  const [capabilities, setCapabilities] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [projectName, setProjectName] = useState(() => (lang === 'ar' ? 'مشروع NEXORA' : 'NEXORA project'));

  /* ── generation pipeline ── */
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [currentStep, setCurrentStep] = useState('plan');
  const [generating, setGenerating] = useState(false);
  const [planning, setPlanning] = useState(false);

  /* ── execution ── */
  const [execLogs, setExecLogs] = useState('');
  const [execStatus, setExecStatus] = useState('idle');
  const [execMode, setExecMode] = useState(null); // 'real' | 'validation'
  const [execAction, setExecAction] = useState('');
  const [execHistory, setExecHistory] = useState([]);
  const [customCmd, setCustomCmd] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);

  /* ── delivery (no fake results) ── */
  const [deploying, setDeploying] = useState(false);
  const [deployState, setDeployState] = useState('idle'); // idle|live|not-deployed|failed
  const [deployUrl, setDeployUrl] = useState(null);
  const [deployLog, setDeployLog] = useState('');

  /* ── agent conversation (real operations only) ── */
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);          // autonomous pipeline in flight
  const [autoRun, setAutoRun] = useState(true);     // generate → install/build/test → self-heal
  const [snapshots, setSnapshots] = useState([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showChat, setShowChat] = useState(!isMobile);
  const [lastRun, setLastRun] = useState(null);     // { provider, model, at }

  /* ── ui state ── */
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [mobileTab, setMobileTab] = useState('code'); // files|code|preview
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(!isMobile);

  /* ── preview ── */
  const [remotePreviewUrl, setRemotePreviewUrl] = useState(null);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const previewSrcRef = useRef(null);
  const previewUrlsRef = useRef([]);

  const terminalRef = useRef(null);
  const chatRef = useRef(null);

  const pushMsg = useCallback((role, kind, text, extra) => {
    setMessages((prev) => [...prev.slice(-40), { role, kind, text, at: Date.now(), ...extra }]);
  }, []);

  /** Model/provider failures get a real, localised sentence — never a silent empty project. */
  const aiErrorText = useCallback((e) => {
    const code = String(e?.code || '');
    if (code === 'ai_invalid_json') return t('aiInvalidJson');
    if (code === 'ai_no_files') return t('aiNoFiles');
    if (code === 'ai_incomplete') return t('aiIncomplete');
    if (code === 'rate_limited' || code === 'provider_rate_limited') return t('aiRateLimited');
    return `${t('aiUnavailable')} (${code || e?.message || 'error'})`;
  }, [t]);

  const activeContent = files[active] || '';
  const activeLang = fileLang(active);

  /* ── capabilities + integrations: never invent a connected state ── */
  useEffect(() => {
    let alive = true;
    api('workspace/capabilities')
      .then((c) => { if (alive) setCapabilities(c); })
      .catch(() => { if (alive) setCapabilities({ e2b: false, mode: 'unavailable', offline: true }); });
    api('workspace/status')
      .then((s) => { if (alive) setIntegrations(s); })
      .catch(() => { if (alive) setIntegrations({ unavailable: true }); });
    return () => { alive = false; };
  }, []);

  /* ── saved projects (DB = source of truth, local files stay local) ── */
  const loadProjects = useCallback(async () => {
    try {
      const r = await api('workspace/projects');
      setProjects(Array.isArray(r?.projects) ? r.projects : []);
      setProjectsError(false);
    } catch {
      setProjectsError(true);
    }
  }, []);
  useEffect(() => { loadProjects(); }, [loadProjects]);

  /* ── persist local mirror ── */
  useEffect(() => {
    try {
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
      localStorage.setItem(ORIGIN_KEY, origin);
    } catch { /* quota */ }
  }, [files, origin]);

  /* ── preview document (debounced so typing stays smooth) ── */
  const previewDoc = useMemo(() => {
    try {
      return buildPreviewDocument(files, { sample: origin === 'template', lang });
    } catch (err) {
      return { html: `<pre style="color:#f87171;padding:16px;font:12px monospace">${String(err?.message || err)}</pre>`, entry: null, inlined: [], brokenRefs: [] };
    }
  }, [files, origin, lang]);

  // One debounce for the whole preview: typing must not rebuild the blob (and reload
  // the iframe) on every keystroke — that caused a render storm on small phones.
  useEffect(() => {
    const id = setTimeout(() => setPreviewHtml(previewDoc.html), 320);
    return () => clearTimeout(id);
  }, [previewDoc.html]);

  useEffect(() => {
    const doc = previewHtml ?? previewDoc.html;
    let url = null;
    try {
      url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    } catch { setPreviewSrc(null); return undefined; }
    previewUrlsRef.current.push(url);
    setPreviewSrc(url);
    setPreviewReady(false);
    const alive = previewUrlsRef.current;
    const id = setTimeout(() => {
      while (alive.length > 5) {
        const old = alive.shift();
        try { URL.revokeObjectURL(old); } catch { /* ignore */ }
      }
    }, 5000);
    return () => clearTimeout(id);
    // previewNonce forces a brand-new URL on "refresh"
  }, [previewHtml, previewNonce]);

  useEffect(() => {
    previewSrcRef.current = previewSrc;
  }, [previewSrc]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch { /* ignore */ } });
  }, []);

  /* ── terminal autoscroll ── */
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [execLogs, terminalOpen]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, showChat]);

  /* ── execution history for the selected project ── */
  const refreshHistory = useCallback(async () => {
    if (!selectedId) { setExecHistory([]); return; }
    try {
      const r = await api(`workspace/projects/${selectedId}/executions`);
      setExecHistory(Array.isArray(r?.executions) ? r.executions : []);
    } catch { /* ignore */ }
  }, [selectedId]);
  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  /* ── editor helpers ── */
  const updateActive = (val) => {
    setFiles((f) => ({ ...f, [active]: val }));
    setDirty(true);
  };

  const addFile = () => {
    const name = window.prompt(t('fileNamePrompt'), 'new-file.html');
    if (!name || files[name]) return;
    let seed = '';
    if (name.endsWith('.html')) seed = '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>New page</title>\n</head>\n<body>\n  <h1>مرحبا</h1>\n</body>\n</html>\n';
    else if (name.endsWith('.css')) seed = '/* styles */\nbody { font-family: system-ui, sans-serif; }\n';
    else if (name.endsWith('.jsx') || name.endsWith('.js')) seed = 'export default function App() {\n  return <div>Hello NEXORA</div>;\n}\n';
    else if (name.endsWith('.json')) seed = '{\n  "name": "nexora"\n}\n';
    else seed = '// new file\n';
    setFiles((f) => ({ ...f, [name]: seed }));
    setActive(name);
    setOrigin((o) => (o === 'saved' ? 'local' : o));
    setDirty(true);
    setDrawerOpen(false);
    setMobileTab('code');
    toastFn(t('fileAdded', { name }));
  };

  const deleteFile = (name) => {
    if (Object.keys(files).length <= 1) { toastFn(t('keepOneFile')); return; }
    if (!window.confirm(t('deleteFileConfirm', { name }))) return;
    const next = { ...files };
    delete next[name];
    setFiles(next);
    if (active === name) setActive(Object.keys(next).sort()[0]);
    setDirty(true);
  };

  const renameFile = (name) => {
    const nextName = window.prompt(t('renamePrompt'), name);
    if (!nextName || nextName === name || files[nextName]) return;
    const next = { ...files, [nextName]: files[name] };
    delete next[name];
    setFiles(next);
    setActive(nextName);
    setDirty(true);
  };

  const loadTemplate = (tpl) => {
    if (!window.confirm(t('loadTemplateConfirm', { name: templateName(tpl, lang) }))) return;
    setFiles({ ...tpl.files });
    setActive(entryFile(tpl.files) || Object.keys(tpl.files).sort()[0]);
    setFramework(tpl.framework || 'static');
    setShowTemplates(false);
    setOrigin('template');
    setDirty(false);
    setSelectedId(null);
    setPlan(null);
    setExecLogs('');
    setExecStatus('idle');
    setExecMode(null);
    setDeployLog('');
    setDeployState('idle');
    setDeployUrl(null);
    setRemotePreviewUrl(null);
    setMobileTab('preview');
    toastFn(t('templateLoaded'));
  };

  const markDirty = () => {
    setDirty(true);
    setOrigin((o) => (o === 'saved' || o === 'template' ? 'local' : o));
  };

  /* ── plan → generate → edit: every call hits a real model ── */
  const doPlan = async (opts = {}) => {
    const p = String(opts.prompt ?? prompt).trim();
    if (!p) { toastFn(t('promptFirst')); return null; }
    setPlanning(true);
    setCurrentStep('plan');
    try {
      const r = await api('workspace/plan', { method: 'POST', body: { prompt: p, framework, lang } });
      setPlan(r.plan);
      setProjectName(r.plan?.title || projectName);
      setFramework(r.plan?.framework || framework);
      setLastRun({ provider: r.provider, model: r.model, at: Date.now() });
      pushMsg('agent', 'plan', `${r.plan?.title || ''}${r.plan?.description ? ' — ' + r.plan.description : ''}`, { plan: r.plan, model: r.model });
      toastFn(t('planReady'));
      setCurrentStep('create');
      return r.plan;
    } catch (e) {
      const msg = aiErrorText(e);
      pushMsg('agent', 'error', msg);
      toastFn(msg);
      return null;
    } finally {
      setPlanning(false);
    }
  };

  /** Create mode builds a new project; edit mode sends the current files plus one instruction
      and only merges back the files the model actually changed. */
  const doGenerate = async (opts = {}) => {
    const instruction = String(opts.instruction ?? '').trim();
    const editing = opts.edit === true || instruction.length > 0;
    if (editing && !instruction) { toastFn(t('promptFirst')); return null; }
    if (!editing && !plan && !prompt.trim()) { toastFn(t('planNeeded')); return null; }
    setGenerating(true);
    if (!editing) setCurrentStep('create');
    try {
      const r = await api('workspace/generate', {
        method: 'POST',
        body: {
          plan,
          prompt: prompt.trim(),
          framework,
          lang,
          instruction: editing ? instruction : undefined,
          files: editing ? files : undefined,
          projectId: selectedId || undefined,
        },
      });
      const next = r.files && typeof r.files === 'object' ? r.files : null;
      if (!next) throw Object.assign(new Error('no files'), { code: 'ai_no_files' });
      setFiles(next);
      setActive((cur) => (next[cur] ? cur : entryFile(next) || Object.keys(next).sort()[0] || 'index.html'));
      setFramework(r.framework || framework);
      setLastRun({ provider: r.provider, model: r.model, at: Date.now() });
      const changedNames = Object.keys(r.changed || next);
      if (editing) {
        setOrigin(r.project ? 'saved' : 'local');
        setDirty(!r.project);
        if (r.project) setSelectedId(r.project.id);
        pushMsg('agent', 'files', r.summary || t('editApplied', { n: changedNames.length }), { files: changedNames });
        toastFn(changedNames.length ? t('editApplied', { n: changedNames.length }) : t('editNoChange'));
      } else {
        setOrigin('generated');
        setDirty(true);
        setExecLogs('');
        setExecStatus('idle');
        setExecMode(null);
        setDeployLog('');
        setDeployState('idle');
        setDeployUrl(null);
        setRemotePreviewUrl(null);
        setMobileTab('preview');
        pushMsg('agent', 'files', r.summary || t('filesReady'), { files: changedNames });
        toastFn(t('filesReady'));
        setCurrentStep('execute');
        if (!selectedId) {
          try {
            const cr = await api('workspace/projects', {
              method: 'POST',
              body: { name: plan?.title || projectName, description: (plan?.description || prompt).slice(0, 200), files: next, framework: r.framework },
            });
            const proj = cr?.project;
            if (!proj?.id) throw new Error('project_not_created');
            setProjects((prev) => [proj, ...prev.filter((x) => x.id !== proj.id)]);
            setSelectedId(proj.id);
            setOrigin('saved');
            setDirty(false);
            toastFn(t('saveDb'));
          } catch { /* stays local — honest */ }
        } else {
          try {
            await api(`workspace/projects/${selectedId}`, { method: 'PATCH', body: { files: next, framework: r.framework } });
            setOrigin('saved');
            setDirty(false);
            toastFn(t('projectUpdated'));
          } catch { /* ignore */ }
        }
      }
      return { files: next, changed: r.changed || {}, mode: r.mode, summary: r.summary };
    } catch (e) {
      const msg = aiErrorText(e);
      setExecLogs((prev) => `${prev}${prev ? '\n' : ''}✗ ${msg}`);
      pushMsg('agent', 'error', msg);
      toastFn(msg);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  /* ── autonomous pipeline: plan → generate → install/build/test → self-heal ── */
  const runPipeline = async ({ create = false } = {}) => {
    if (busy || planning || generating) return;
    const text = prompt.trim();
    if (!text) { toastFn(t('promptFirst')); return; }
    setBusy(true);
    // phones keep the conversation collapsed by default: the workspace is the point there
    if (!isMobile) setShowChat(true);
    setExecLogs('');
    pushMsg('user', 'request', text, { mode: create ? 'build' : 'edit' });
    try {
      if (create) {
        const p = await doPlan({ prompt: text });
        if (!p) return;
      }
      const gen = await doGenerate({ instruction: create ? '' : text, edit: !create });
      if (!gen) return;
      if (create) setPrompt('');
      else setPrompt('');
      if (!autoRun) { pushMsg('agent', 'done', t('filesReady')); return; }

      const steps = framework === 'static' ? ['build'] : ['install', 'build', 'test'];
      let failure = null;
      for (const action of steps) {
        const r = await runAction(action, undefined, { quiet: true });
        if (r && r.exitCode !== 0) { failure = { action, r }; break; }
      }
      for (let round = 0; failure && round < 2; round++) {
        const fix = await doDebug({ logs: failure.r.logs, command: failure.action });
        if (!fix || !Object.keys(fix.patch || {}).length) break;
        pushMsg('agent', 'debug', t('autoFixApplied', { n: Object.keys(fix.patch).length }), { files: Object.keys(fix.patch) });
        const again = await runAction(failure.action, undefined, { quiet: true });
        if (!again || again.exitCode === 0) { failure = null; break; }
        failure = { action: failure.action, r: again };
      }
      if (failure) {
        pushMsg('agent', 'error', `${t('statusFailed')}: ${failure.action}`);
      } else {
        pushMsg('agent', 'done', t('pipelineDone'));
        if (selectedId) {
          try { await api(`workspace/projects/${selectedId}/snapshot`, { method: 'POST', body: { files, message: 'pipeline' } }); } catch { /* ignore */ }
        }
      }
      refreshHistory();
    } finally {
      setBusy(false);
    }
  };

  /* ── execution (never reported as success when it was validation only) ── */
  const runAction = async (action, customCommand, opts = {}) => {
    const quiet = opts.quiet === true;
    setExecStatus('running');
    setExecAction(action);
    setExecMode(null);
    if (!quiet) setExecLogs(`▶ ${action} — ${t('statusRunning')}\n`);
    else setExecLogs((prev) => `${prev}${prev ? '\n' : ''}▶ ${action}…\n`);
    setTerminalOpen(true);
    setCurrentStep(action === 'test' ? 'test' : action === 'debug' ? 'debug' : 'execute');
    if (isMobile) setMobileTab('code');
    try {
      let r;
      if (selectedId) {
        r = await api(`workspace/projects/${selectedId}/execute`, { method: 'POST', body: { action, command: customCommand, files } });
      } else {
        const cmdMap = {
          install: framework === 'static' ? 'echo "static: no install needed"' : 'npm install',
          build: framework === 'static' ? 'echo "static build — validating"' : 'npm run build',
          test: 'npm test --if-present',
          dev: framework === 'next' ? 'npm run dev -- --port 3000 --hostname 0.0.0.0' : 'npm run dev -- --host 0.0.0.0 --port 5173',
          run: customCommand || 'npm start',
        };
        r = await api('workspace/execute', {
          method: 'POST',
          body: { files, command: customCommand || cmdMap[action] || 'echo hello', action, framework },
        });
      }
      const real = r.real === true;
      setExecLogs((prev) => (quiet ? `${prev}${r.logs || ''}\n` : (r.logs || '')));
      setExecMode(real ? 'real' : 'validation');
      setExecStatus(r.exitCode === 0 ? (real ? 'success' : 'validated') : 'failed');
      if (r.previewUrl) {
        setRemotePreviewUrl(r.previewUrl);
        if (isMobile) setMobileTab('preview');
      }
      if (r.exitCode !== 0) {
        setDebugInfo(null);
      } else {
        toastFn(real ? t('execDone') : t('execNotReal'));
        if (action === 'test') setCurrentStep('debug');
        if (action === 'build') setCurrentStep('test');
      }
      refreshHistory();
      return { exitCode: r.exitCode, logs: r.logs || '', real, mode: r.mode || null, previewUrl: r.previewUrl || null };
    } catch (e) {
      setExecLogs((prev) => `${prev}\n✗ ${e.code || 'error'}: ${e.detail || e.message || t('runFailed')}`);
      setExecStatus('failed');
      setExecMode(null);
      toastFn(`${t('runFailed')}: ${e.code || 'error'}`);
      return { exitCode: 1, logs: `${e.code || 'error'}: ${e.detail || e.message || ''}`, real: false, error: true, previewUrl: null };
    }
  };

  const doDebug = async (opts = {}) => {
    const logs = String(opts.logs ?? execLogs);
    const command = String(opts.command ?? execAction);
    if (!logs.trim()) { toastFn(t('noLogs')); return null; }
    setExecAction('debug');
    setExecStatus('running');
    setCurrentStep('debug');
    setExecLogs((prev) => `${prev}${prev ? '\n' : ''}🔍 ${t('stepDebug')}…\n`);
    try {
      const r = await api('workspace/debug', { method: 'POST', body: { logs, files, command, lang } });
      setDebugInfo(r);
      let out = `\n── ${t('debugTitle')} ──\n${r.diagnosis || ''}\n`;
      const patched = Object.keys(r.patch || {});
      if (patched.length) out += `Patch: ${patched.join(', ')}\n`;
      if (r.rerun) out += `Rerun: ${r.rerun}\n`;
      setExecLogs((prev) => prev + out);
      setExecStatus('validated');
      setExecMode('validation');
      if (r.diagnosis) pushMsg('agent', 'debug', r.diagnosis, { files: patched });
      if (r.fixedFiles && patched.length) {
        setFiles(r.fixedFiles);
        setDirty(true);
        if (selectedId) {
          try { await api(`workspace/projects/${selectedId}`, { method: 'PATCH', body: { files: r.fixedFiles } }); } catch { /* ignore */ }
        }
        toastFn(t('editApplied', { n: patched.length }));
      }
      return r;
    } catch (e) {
      const msg = aiErrorText(e);
      setExecLogs((prev) => `${prev}\n✗ ${msg}`);
      setExecStatus('failed');
      pushMsg('agent', 'error', msg);
      return null;
    }
  };

  /* ── delivery actions: report exactly what happened, never more ── */
  const handleDeploy = async () => {
    setDeploying(true);
    setDeployState('idle');
    setDeployUrl(null);
    setDeployLog(`🚀 ${t('deploying')}\n`);
    setCurrentStep('deploy');
    if (isMobile) setMobileTab('preview');
    try {
      const r = await api('workspace/deploy', { method: 'POST', body: { files, projectId: selectedId || undefined, name: projectName } });
      if (r?.real && r?.url) {
        setDeployState('live');
        setDeployUrl(r.url);
        setDeployLog((prev) => `${prev}✅ ${t('deployLive')}\n🔗 ${r.url}\n`);
        toastFn(`✓ ${t('deployLive')}`);
        try { window.open(r.url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
      } else {
        setDeployState('not-deployed');
        setDeployLog((prev) => `${prev}⚠ ${t('deployNotConfigured')}\n${r?.note || ''}\n${t('deployNoFake')}\n`);
        toastFn(t('deployNotConfigured'));
      }
    } catch (e) {
      setDeployState('failed');
      setDeployLog((prev) => `${prev}❌ ${t('deployFailed')}: ${e.code || e.message || 'error'}\n`);
      toastFn(`${t('deployFailed')}: ${e.code || 'error'}`);
    }
    setDeploying(false);
  };

  const handlePushGitHub = async () => {
    setDeploying(true);
    setDeployLog((prev) => `${prev}⬆ GitHub...\n`);
    try {
      const r = await api('workspace/github/push', { method: 'POST', body: { files, projectId: selectedId || undefined } });
      if (r?.real) {
        setDeployLog((prev) => `${prev}✅ ${t('githubPushed')} — ${r.repo}@${r.branch}\n${r.url ? `🔗 ${r.url}\n` : ''}`);
        toastFn(`✓ ${t('githubPushed')}`);
        if (selectedId) {
          try { await api(`workspace/projects/${selectedId}/snapshot`, { method: 'POST', body: { files, message: 'github push' } }); } catch { /* ignore */ }
        }
        refreshHistory();
      } else {
        setDeployLog((prev) => `${prev}⚠ ${t('githubNotPushed')}\n${r?.note || ''}\n`);
        toastFn(t('githubNotPushed'));
      }
    } catch (e) {
      setDeployLog((prev) => `${prev}❌ ${e.code || 'error'}\n`);
      toastFn(`${t('githubNotPushed')} (${e.code || 'error'})`);
    }
    setDeploying(false);
  };

  const saveToDrive = async () => {
    setDeploying(true);
    setDeployLog((prev) => `${prev}💾 Drive...\n`);
    try {
      const r = await api('workspace/drive/save', { method: 'POST', body: { files, name: `${projectName}-${Date.now()}` } });
      if (r?.real) {
        setDeployLog((prev) => `${prev}✅ ${t('driveSaved')}\n${r.url ? `🔗 ${r.url}\n` : ''}`);
        toastFn(`✓ ${t('driveSaved')}`);
      } else {
        setDeployLog((prev) => `${prev}⚠ ${t('driveNotSaved')}\n${r?.note || ''}\n`);
        toastFn(t('driveNotSaved'));
      }
    } catch (e) {
      setDeployLog((prev) => `${prev}❌ ${e.code || 'error'}\n`);
      toastFn(`${t('driveNotSaved')} (${e.code || 'error'})`);
    }
    setDeploying(false);
  };

  /* ── projects ── */
  const selectProject = async (p) => {
    setSelectedId(p.id);
    setProjectName(p.name);
    setFramework(p.framework || 'static');
    setFiles(p.files || {});
    setActive(entryFile(p.files || {}) || Object.keys(p.files || {}).sort()[0] || 'index.html');
    setPlan({ title: p.name, description: p.description, framework: p.framework });
    setOrigin('saved');
    setDirty(false);
    setCurrentStep('execute');
    setDrawerOpen(false);
    if (isMobile) setMobileTab('code');
    try {
      const r = await api(`workspace/projects/${p.id}/executions`);
      setExecHistory(Array.isArray(r?.executions) ? r.executions : []);
    } catch { /* ignore */ }
  };

  const createNewProject = () => {
    const name = window.prompt(t('projectNamePrompt'), projectName);
    if (!name) return;
    setProjectName(name);
    const tpl = DEFAULT_TEMPLATE;
    setFiles({ ...tpl.files });
    setActive(entryFile(tpl.files) || Object.keys(tpl.files).sort()[0]);
    setSelectedId(null);
    setPlan(null);
    setCurrentStep('plan');
    setExecLogs('');
    setExecStatus('idle');
    setExecMode(null);
    setOrigin('template');
    setDirty(false);
    setShowTemplates(false);
    toastFn(t('newProjectCreated'));
  };

  const deleteProject = async (p) => {
    if (!window.confirm(`${t('deleteFailed')}? ${p.name}`)) return;
    try {
      await api(`workspace/projects/${p.id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      if (selectedId === p.id) {
        setSelectedId(null);
        setFiles({ ...DEFAULT_TEMPLATE.files });
        setActive(entryFile(DEFAULT_TEMPLATE.files) || Object.keys(DEFAULT_TEMPLATE.files).sort()[0]);
        setOrigin('template');
      }
      toastFn(t('projectDeleted'));
    } catch {
      toastFn(t('deleteFailed'));
    }
  };

  const saveProject = async () => {
    const name = projectName.trim() || (lang === 'ar' ? 'مشروع NEXORA' : 'NEXORA project');
    try {
      if (selectedId) {
        const r = await api(`workspace/projects/${selectedId}`, { method: 'PATCH', body: { name, files, framework } });
        setProjects((prev) => prev.map((x) => (x.id === selectedId ? r.project : x)));
        await api(`workspace/projects/${selectedId}/snapshot`, { method: 'POST', body: { files, message: 'manual save' } });
        setDirty(false);
        setOrigin('saved');
        toastFn(`✓ ${t('saveDb')}`);
      } else {
        const r = await api('workspace/projects', { method: 'POST', body: { name, description: prompt.slice(0, 300), files, framework } });
        setProjects((prev) => [r.project, ...prev]);
        setSelectedId(r.project.id);
        setDirty(false);
        setOrigin('saved');
        toastFn(`✓ ${t('projectSaved')}`);
      }
    } catch {
      try { localStorage.setItem(FILES_KEY, JSON.stringify(files)); } catch { /* ignore */ }
      toastFn(t('saveLocal'));
    }
  };

  /* ── snapshots: durable project history ── */
  const loadSnapshots = async () => {
    if (!selectedId) return;
    try {
      const r = await api(`workspace/projects/${selectedId}/snapshots`);
      setSnapshots(Array.isArray(r?.snapshots) ? r.snapshots : []);
      setShowSnapshots(true);
    } catch { toastFn(t('saveLocal')); }
  };

  const restoreSnapshot = async (id) => {
    try {
      const r = await api(`workspace/snapshots/${id}`);
      const restored = r?.snapshot?.files;
      if (!restored || !Object.keys(restored).length) return;
      setFiles(restored);
      setActive(entryFile(restored) || Object.keys(restored).sort()[0]);
      setDirty(true);
      setOrigin('local');
      toastFn(`✓ ${t('snapshotRestored')}`);
    } catch { toastFn(t('saveLocal')); }
  };

  /* ── clipboard / download ── */
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(activeContent); toastFn(t('copied')); } catch { toastFn(t('copied')); }
  };
  const downloadFile = () => {
    const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = active.split('/').pop() || 'file.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const refreshPreview = () => {
    setPreviewReady(false);
    setPreviewNonce((n) => n + 1);
  };

  const openPreview = () => {
    const url = previewSrcRef.current || previewSrc;
    if (url) {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win) return;
    }
    const win = window.open('', '_blank');
    if (!win) { toastFn(t('popupBlocked')); return; }
    try {
      win.document.open();
      win.document.write(previewDoc.html);
      win.document.close();
    } catch { toastFn(t('popupBlocked')); }
  };

  /* ── labels ── */
  const originMeta = {
    template: { cls: 'sample', label: t('originTemplate'), note: t('originTemplateNote') },
    generated: { cls: 'sample', label: t('originGenerated'), note: t('originGeneratedNote') },
    saved: { cls: 'saved', label: t('originSaved'), note: t('originSavedNote') },
    local: { cls: 'local', label: t('originLocal'), note: t('originLocalNote') },
  }[origin] || { cls: 'local', label: t('originLocal'), note: t('originLocalNote') };

  const statusLabel = {
    idle: t('statusIdle'),
    running: t('statusRunning'),
    success: t('statusSuccess'),
    validated: t('statusValidated'),
    failed: t('statusFailed'),
  }[execStatus] || execStatus;

  const execFull = !capabilities
    ? { cls: 'unknown', label: t('unknown') }
    : capabilities.offline
      ? { cls: 'unknown', label: t('capUnknown') }
      : capabilities.e2b
        ? { cls: 'ok', label: t('execE2B') }
        : { cls: 'warn', label: t('execFallback') };
  // narrow screens show only the headline ("check only"), the qualifier stays in the title/aria text
  const execCapability = { ...execFull, short: execFull.label.split(' — ')[0] };

  const connState = (key) => (integrations?.unavailable ? 'unknown' : integrations?.[key]?.connected ? 'ok' : 'off');
  const connWord = (key) => (integrations?.unavailable ? t('unknown') : integrations?.[key]?.connected ? t('connected') : t('notConnected'));
  const conns = [
    { key: 'vercel', name: 'Vercel' },
    { key: 'github', name: 'GitHub' },
    { key: 'drive', name: 'Drive' },
  ];

  const fileNames = useMemo(() => Object.keys(files).sort(), [files]);
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const iframeSrc = remotePreviewUrl || previewSrc;

  /* The composer builds a new project while the workspace still holds a starter or nothing,
     and switches to "apply change" once a real project exists (Arena-style continuity). */
  const needsBuild = origin === 'template' || !plan;
  const submitRequest = () => { if (!prompt.trim()) { toastFn(t('promptFirst')); return; } runPipeline({ create: needsBuild }); };

  return (
    <div className={'nx-s' + (rtl ? ' is-rtl' : '')} dir={rtl ? 'rtl' : 'ltr'} data-view={isMobile ? 'mobile' : 'desktop'}>
      {/* ── header ── */}
      <header className="nx-s-top">
        <div className="nx-s-brand">
          <span className="nx-s-mark" aria-hidden="true">N</span>
          <div className="nx-s-brand-text">
            <b>NEXORA Studio</b>
          </div>
        </div>
        <div className="nx-s-top-actions">
          <button type="button" className="nx-s-btn" onClick={() => setShowTemplates((v) => !v)} aria-expanded={showTemplates}>
            📦 <span className="nx-s-btn-label">{t('templates')}</span>
          </button>
          <button type="button" className="nx-s-btn" onClick={saveProject} disabled={deploying}>
            💾 <span className="nx-s-btn-label">{t('save')}</span>
          </button>
          <button type="button" className="nx-s-btn" onClick={handlePushGitHub} disabled={deploying}>
            📤 <span className="nx-s-btn-label">GitHub</span>
          </button>
          <button type="button" className="nx-s-btn nx-s-btn-primary" onClick={handleDeploy} disabled={deploying}>
            🚀 <span className="nx-s-btn-label">{deploying ? t('deploying') : t('deploy')}</span>
          </button>
        </div>
      </header>

      {/* ── status: capabilities + real connection state ── */}
      <div className="nx-s-status" role="status">
        <span className={'nx-s-badge ' + originMeta.cls} title={originMeta.note}>{originMeta.label}</span>
        <span className="nx-s-chip" title={execCapability.label} aria-label={execCapability.label}>
          <i className={'nx-s-dot ' + execCapability.cls} />
          <span className="nx-s-chip-name">{execCapability.short}</span>
          <span className="nx-s-chip-state">{execCapability.label.slice(execCapability.short.length)}</span>
        </span>
        {conns.map((c) => (
          <span className="nx-s-chip" key={c.key} title={`${c.name}: ${connWord(c.key)}`} aria-label={`${c.name}: ${connWord(c.key)}`}>
            <i className={'nx-s-dot ' + connState(c.key)} />
            <span className="nx-s-chip-name">{c.name}</span>
            <span className="nx-s-chip-state"> · {connWord(c.key)}</span>
          </span>
        ))}
        <span className="nx-s-chip muted">{t('dbProjects')}: {projects.length}</span>
      </div>

      <div className="nx-s-body">
        <aside className="nx-s-side" aria-label={t('chatTitle')}>

      {/* ── pipeline ── */}
      <div className="nx-s-pipeline" role="tablist" aria-label="pipeline">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={'nx-s-step' + (currentStep === s.id ? ' active' : '') + (i < stepIndex ? ' done' : '')}
            onClick={() => setCurrentStep(s.id)}
          >
            <span aria-hidden="true">{s.icon}</span>
            <b>{lang === 'ar' ? s.ar : s.en}</b>
          </button>
        ))}
        <span className={'nx-s-exec-badge ' + (STATUS_CLASS[execStatus] || 'idle')}>
          {execStatus === 'running' ? '⏳ ' : execStatus === 'failed' ? '❌ ' : execStatus === 'idle' ? '• ' : execStatus === 'validated' ? '⚠️ ' : '✅ '}
          {statusLabel}
        </span>
      </div>

      {/* ── templates ── */}
      {showTemplates && (
        <div className="nx-s-templates">
          <div className="nx-s-templates-head">
            <b>{t('templatesTitle')}</b>
            <button type="button" className="nx-s-icon-btn" onClick={() => setShowTemplates(false)} aria-label={t('close')}>×</button>
          </div>
          <div className="nx-s-templates-grid">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" className="nx-s-tpl" onClick={() => loadTemplate(tpl)}>
                <span className="nx-s-tpl-icon" aria-hidden="true">{tpl.icon}</span>
                <b>{templateName(tpl, lang)}</b>
                <small>{templateDesc(tpl, lang)}</small>
                <span className="nx-s-tpl-tag">{t('sampleBadge')}</span>
              </button>
            ))}
            <button type="button" className="nx-s-tpl dashed" onClick={createNewProject}>
              <span className="nx-s-tpl-icon" aria-hidden="true">➕</span>
              <b>{t('blankProject')}</b>
              <small>{t('blankProjectDesc')}</small>
              <span className="nx-s-tpl-tag">{t('create')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── agent conversation ── */}
      {messages.length > 0 && (
        <section className={'nx-s-chat' + (showChat ? '' : ' is-collapsed')} aria-label={t('chatTitle')}>
          <header className="nx-s-chat-head">
            <b>🤖 {t('chatTitle')}</b>
            <span className="nx-s-muted ltr">{busy ? t('pipelineRunning') : (lastRun?.model || '')}</span>
            <button type="button" className="nx-s-icon-btn" onClick={() => setShowChat((v) => !v)} aria-expanded={showChat}>
              {showChat ? '−' : '+'}
            </button>
          </header>
          {showChat && (
            <div className="nx-s-chat-log" ref={chatRef}>
              {messages.map((m, i) => (
                <div key={i} className={'nx-s-msg ' + m.role + ' ' + m.kind}>
                  <span className="nx-s-msg-icon" aria-hidden="true">
                    {m.role === 'user' ? '🧑' : m.kind === 'error' ? '⚠️' : m.kind === 'plan' ? '📋' : m.kind === 'files' ? '⚡' : m.kind === 'debug' ? '🐛' : '✅'}
                  </span>
                  <span className="nx-s-msg-text" dir="auto">{m.text}</span>
                </div>
              ))}
              {busy && <div className="nx-s-msg agent running"><span className="nx-s-msg-icon">⏳</span><span className="nx-s-msg-text">{t('pipelineRunning')}</span></div>}
            </div>
          )}
        </section>
      )}

      {/* ── plan card ── */}
      {plan && (
        <div className="nx-s-plan">
          <div className="nx-s-plan-head">
            <b>📋 {t('planTitle')}: {plan.title}</b>
            <span className="nx-s-chip accent">{plan.framework}</span>
            <button type="button" className="nx-s-icon-btn" onClick={() => setPlan(null)} aria-label={t('close')}>×</button>
          </div>
          <p dir="auto">{plan.description}</p>
          <div className="nx-s-plan-grid">
            <div><b>{t('features')}</b><ul>{(plan.features || []).map((f, i) => <li key={i} dir="auto">{f}</li>)}</ul></div>
            <div><b>{t('filesLabel')}</b><ul>{(plan.fileStructure || fileNames).map((f, i) => <li key={i} className="ltr">{f}</li>)}</ul></div>
            <div><b>{t('steps')}</b><ol>{(plan.steps || STEPS.map((s) => (lang === 'ar' ? s.ar : s.en))).map((s, i) => <li key={i} dir="auto">{s}</li>)}</ol></div>
          </div>
          {plan.fallback && <small className="nx-s-muted">{t('planFallback')}</small>}
        </div>
      )}

      {/* ── composer (bottom of the side column) ── */}
      <div className="nx-s-ai">
        <select value={framework} onChange={(e) => setFramework(e.target.value)} className="nx-s-fw" aria-label="framework">
          {FRAMEWORKS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input
          className="nx-s-ai-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitRequest(); } }}
          placeholder={needsBuild ? t('planPlaceholder') : t('composerPlaceholder')}
          dir="auto"
          disabled={busy}
          aria-label={needsBuild ? t('planPlaceholder') : t('composerPlaceholder')}
        />
        <label className="nx-s-auto" title={t('autoRunHint')}>
          <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} />
          <span>{t('autoRun')}</span>
        </label>
        <div className="nx-s-ai-actions">
          <button type="button" className="nx-s-btn" onClick={() => doPlan()} disabled={busy || planning || !prompt.trim()}>
            📋 {planning ? t('planning') : t('plan')}
          </button>
          <button type="button" className="nx-s-btn nx-s-btn-accent" onClick={submitRequest} disabled={busy || !prompt.trim()}>
            {busy ? '⏳' : needsBuild ? '⚡' : '✎'} {busy ? t('pipelineRunning') : needsBuild ? t('composerBuild') : t('composerEdit')}
          </button>
        </div>
      </div>

        </aside>

      {/* ── mobile tabs ── */}
      <div className="nx-s-tabs" role="tablist" aria-label="workspace panels">
        <button
          type="button"
          role="tab"
          aria-selected={drawerOpen}
          aria-expanded={drawerOpen}
          className={'nx-s-tab' + (drawerOpen ? ' on' : '')}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <span aria-hidden="true">🗂️</span> {t('filesTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!drawerOpen && mobileTab === 'code'}
          className={'nx-s-tab' + (!drawerOpen && mobileTab === 'code' ? ' on' : '')}
          onClick={() => { setMobileTab('code'); setDrawerOpen(false); }}
        >
          <span aria-hidden="true">⌨️</span> {t('codeTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!drawerOpen && mobileTab === 'preview'}
          className={'nx-s-tab' + (!drawerOpen && mobileTab === 'preview' ? ' on' : '')}
          onClick={() => { setMobileTab('preview'); setDrawerOpen(false); }}
        >
          <span aria-hidden="true">👁️</span> {t('previewTab')}
        </button>
      </div>

      {/* ── workspace ── */}
      <div className={'nx-s-workspace' + (isMobile ? ' is-mobile' : '')}>
        {isMobile && drawerOpen && (
          <button type="button" className="nx-s-backdrop" aria-label={t('close')} onClick={() => setDrawerOpen(false)} />
        )}

        {/* file explorer / drawer */}
        <aside className={'nx-s-panel nx-s-files' + (drawerOpen ? ' is-open' : '')} aria-label={t('explorer')}>
          <div className="nx-s-panel-head">
            <b>🗂️ {t('explorer')}</b>
            <span className="nx-s-head-actions">
              <button type="button" className="nx-s-icon-btn" onClick={addFile} title={t('newFile')}>+</button>
              <button type="button" className="nx-s-icon-btn" onClick={saveProject} title={t('save')}>💾</button>
              {isMobile && <button type="button" className="nx-s-icon-btn" onClick={() => setDrawerOpen(false)} aria-label={t('close')}>×</button>}
            </span>
          </div>

          <div className={'nx-s-origin ' + originMeta.cls}>
            <b>{originMeta.label}</b>
            <small dir="auto">{originMeta.note}</small>
            {origin === 'template' && <span className="nx-s-origin-tag">{t('sampleNotice')}</span>}
          </div>

          <div className="nx-s-projects">
            <div className="nx-s-section-title">
              <span>{t('projectsTitle')}</span>
              <button type="button" onClick={createNewProject}>{t('newProject')}</button>
            </div>
            {projectsError && <div className="nx-s-empty warn">{t('projectsError')}</div>}
            {!projectsError && projects.length === 0 && <div className="nx-s-empty">{t('noProjects')}</div>}
            {projects.map((p) => (
              <div
                key={p.id}
                className={'nx-s-proj' + (selectedId === p.id ? ' active' : '')}
                onClick={() => selectProject(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectProject(p); }}
              >
                <span className="nx-s-proj-name" dir="auto">{p.name}</span>
                <small className="ltr">{p.framework} · {p.updated_at ? new Date(p.updated_at).toLocaleDateString(lang === 'ar' ? 'ar' : 'en') : ''}</small>
                <button type="button" onClick={(e) => { e.stopPropagation(); deleteProject(p); }} title="delete">×</button>
              </div>
            ))}
            {selectedId && (
              <button type="button" className="nx-s-link" onClick={() => setShowHistory((v) => !v)}>
                {showHistory ? '−' : '+'} {t('history')} ({execHistory.length})
              </button>
            )}
            {showHistory && execHistory.map((ex) => (
              <div key={ex.id} className="nx-s-history-item">
                <b>{ex.action}</b>
                <small>{ex.status} · {new Date(ex.created_at).toLocaleTimeString(lang === 'ar' ? 'ar' : 'en')}</small>
                <pre>{(ex.logs || '').slice(0, 120)}…</pre>
              </div>
            ))}
            {selectedId && (
              <button type="button" className="nx-s-link" onClick={loadSnapshots}>
                {showSnapshots ? '−' : '+'} {t('snapshots')} ({snapshots.length})
              </button>
            )}
            {showSnapshots && snapshots.length === 0 && <div className="nx-s-empty">{t('noSnapshots')}</div>}
            {showSnapshots && snapshots.map((sn) => (
              <div key={sn.id} className="nx-s-history-item">
                <b dir="auto">{(sn.message || '').slice(0, 40)}</b>
                <small>{new Date(sn.created_at).toLocaleString(lang === 'ar' ? 'ar' : 'en')}</small>
                <button type="button" className="nx-s-link" onClick={() => restoreSnapshot(sn.id)}>↺ {t('restoreSnapshot')}</button>
              </div>
            ))}
          </div>

          <div className="nx-s-section-title files">
            <span>{t('filesLabel')} ({fileNames.length})</span>
          </div>
          <div className="nx-s-file-list">
            {fileNames.map((name) => (
              <div
                key={name}
                className={'nx-s-file' + (active === name ? ' active' : '')}
                onClick={() => { setActive(name); setDrawerOpen(false); if (isMobile) setMobileTab('code'); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setActive(name); setDrawerOpen(false); setMobileTab('code'); } }}
              >
                <span className="nx-s-file-name">
                  <span aria-hidden="true">{fileIcon(name)}</span>
                  <span dir="ltr">{name}</span>
                </span>
                <span className="nx-s-file-ops">
                  <button type="button" onClick={(e) => { e.stopPropagation(); renameFile(name); }} title="rename">✏️</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); deleteFile(name); }} title="delete">×</button>
                </span>
              </div>
            ))}
          </div>

          <div className="nx-s-files-foot">
            <label className="nx-s-field">
              <span>{t('projectName')}</span>
              <input value={projectName} onChange={(e) => { setProjectName(e.target.value); markDirty(); }} dir="auto" />
            </label>
            <small className="nx-s-muted">{dirty ? `● ${t('unsaved')}` : `✓ ${t('saved2')}`}</small>
          </div>
        </aside>

        {/* code editor */}
        <main className={'nx-s-panel nx-s-editor' + (mobileTab === 'code' ? ' is-active' : '')} aria-label={t('codeTab')}>
          <div className="nx-s-panel-head">
            <span className="nx-s-file-current">
              {isMobile && (
                <button type="button" className="nx-s-icon-btn" onClick={() => setDrawerOpen(true)} aria-label={t('filesTab')}>🗂️</button>
              )}
              <b dir="ltr">{active}</b>
              <small className="ltr">{activeLang} · {t('chars', { n: activeContent.length })}</small>
            </span>
            <span className="nx-s-head-actions">
              <button type="button" className="nx-s-btn tiny" onClick={copyCode}>📋 <span className="nx-s-btn-label">{t('copy')}</span></button>
              <button type="button" className="nx-s-btn tiny" onClick={downloadFile}>⬇️ <span className="nx-s-btn-label">{t('download')}</span></button>
              <button type="button" className="nx-s-btn tiny primary" onClick={saveProject}>💾 <span className="nx-s-btn-label">{t('save')}</span></button>
            </span>
          </div>

          <div className="nx-s-editor-meta">
            <span className="ltr">{t('lines', { n: activeContent.split('\n').length })}</span>
            <span>{t('noWrap')}</span>
            <span className="nx-s-ltr-pill" dir="ltr">LTR</span>
          </div>

          <CodeEditor
            value={activeContent}
            onChange={updateActive}
            fileName={active}
            onSave={saveProject}
            label={`${active} — ${t('codeTab')}`}
          />

          {/* terminal */}
          <section className={'nx-s-terminal' + (terminalOpen ? '' : ' is-collapsed')} aria-label={t('terminal')}>
            <div className="nx-s-terminal-bar">
              <b><span className="nx-s-term-emoji">🖥️</span> {t('terminal')}</b>
              <span className="nx-s-terminal-tools">
                <button type="button" onClick={() => runAction('install')} disabled={execStatus === 'running'} title={t('install')} aria-label={t('install')}>
                  📦 <span className="nx-s-tool-label">{t('install')}</span>
                </button>
                <button type="button" onClick={() => runAction('build')} disabled={execStatus === 'running'} title={t('build')} aria-label={t('build')}>
                  🔨 <span className="nx-s-tool-label">{t('build')}</span>
                </button>
                <button type="button" onClick={() => runAction('test')} disabled={execStatus === 'running'} title={t('test')} aria-label={t('test')}>
                  🧪 <span className="nx-s-tool-label">{t('test')}</span>
                </button>
                <button type="button" onClick={doDebug} disabled={execStatus === 'running' || !execLogs} title={t('debug')} aria-label={t('debug')}>
                  🐛 <span className="nx-s-tool-label">{t('debug')}</span>
                </button>
                <button type="button" onClick={() => runAction('dev')} disabled={execStatus === 'running'} title={t('dev')} aria-label={t('dev')}>
                  ▶️ <span className="nx-s-tool-label">{t('dev')}</span>
                </button>
                <button
                  type="button"
                  className="nx-s-terminal-toggle"
                  onClick={() => setTerminalOpen((v) => !v)}
                  aria-expanded={terminalOpen}
                  aria-label={terminalOpen ? t('clear') : t('terminal')}
                >
                  {terminalOpen ? '−' : '+'}
                </button>
              </span>
            </div>
            {terminalOpen && (
              <>
                <div className="nx-s-terminal-cmd">
                  <input
                    value={customCmd}
                    onChange={(e) => setCustomCmd(e.target.value)}
                    placeholder={t('customCmd')}
                    dir="ltr"
                    onKeyDown={(e) => { if (e.key === 'Enter' && customCmd.trim()) runAction('exec', customCmd); }}
                  />
                  <button type="button" onClick={() => runAction('exec', customCmd)} disabled={!customCmd.trim() || execStatus === 'running'}>{t('run')}</button>
                  <button type="button" className="ghost" onClick={() => { setExecLogs(''); setExecStatus('idle'); setExecMode(null); setDebugInfo(null); }}>{t('clear')}</button>
                </div>
                <pre ref={terminalRef} className="nx-s-terminal-log">
{execLogs
  || `${t('terminalIdle')}\n${execCapability.label}\n${execMode === 'validation' ? t('execNotReal') : execMode === 'real' ? t('execReal') : ''}`}
                </pre>
                {execMode === 'validation' && execStatus !== 'idle' && (
                  <div className="nx-s-hint warn">⚠ {t('execNotReal')}</div>
                )}
                {execMode === 'real' && (
                  <div className="nx-s-hint ok">● {t('execReal')}</div>
                )}
                {debugInfo && (
                  <div className="nx-s-debug">
                    <b>🐛 {t('debugTitle')}</b>
                    <ul>{(debugInfo.suggestions || []).map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul>
                  </div>
                )}
              </>
            )}
          </section>
        </main>

        {/* live preview */}
        <section className={'nx-s-panel nx-s-preview' + (mobileTab === 'preview' ? ' is-active' : '')} aria-label={t('previewTab')}>
          <div className="nx-s-panel-head preview">
            <span className="nx-s-preview-title">
              <b>👁️ {t('previewTab')}</b>
              <small className="ltr">
                {remotePreviewUrl ? t('previewRemote') : t('previewLocal')} · {previewDoc.entry || '—'}
              </small>
            </span>
            <span className="nx-s-head-actions">
              {remotePreviewUrl && (
                <button type="button" className="nx-s-btn tiny" onClick={() => setRemotePreviewUrl(null)}>{t('backToLocal')}</button>
              )}
              <button type="button" className="nx-s-btn tiny" onClick={refreshPreview}>🔄 <span className="nx-s-btn-label">{t('refresh')}</span></button>
              <button type="button" className="nx-s-btn tiny primary" onClick={openPreview}>🔗 <span className="nx-s-btn-label">{t('open')}</span></button>
            </span>
          </div>

          <div className="nx-s-preview-stage">
            {!previewReady && <span className="nx-s-preview-loading" aria-live="polite">{t('statusRunning')}</span>}
            {iframeSrc ? (
              <iframe
                key="nx-preview-frame"
                title={t('previewTab')}
                className="nx-s-iframe"
                src={iframeSrc}
                onLoad={() => setPreviewReady(true)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            ) : (
              <div className="nx-s-empty big">{t('noPreviewTitle')}</div>
            )}
          </div>

          <div className="nx-s-preview-foot">
            {previewDoc.entry
              ? <span className="ltr">{t('previewEntry', { name: previewDoc.entry })}{previewDoc.inlined?.length ? ` · ${t('previewInlined', { n: previewDoc.inlined.length })}` : ''}</span>
              : <span>{t('noPreviewBody')}</span>}
            <span className="nx-s-muted">{t('previewAuto')}</span>
          </div>

          {deployLog && (
            <pre className="nx-s-deploy-log">{deployLog}</pre>
          )}
          {deployState === 'live' && deployUrl && (
            <a className="nx-s-deploy-link" href={deployUrl} target="_blank" rel="noreferrer">{t('deployLive')} ↗</a>
          )}

          <div className="nx-s-statusbar">
            <span className="ltr">⚙️ {framework}</span>
            <span className={'nx-s-dot-label ' + (STATUS_CLASS[execStatus] || 'idle')}>● {execAction || 'idle'} · {statusLabel}</span>
            <span>{dirty ? `● ${t('unsaved')}` : `✓ ${t('saved2')}`} · {fileNames.length}</span>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
