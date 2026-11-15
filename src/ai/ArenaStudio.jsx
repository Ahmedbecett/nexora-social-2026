import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../api.js';
import { getLang, isRtl } from '../i18n.js';
import { makeStudioT } from './studioStrings.js';
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
      if (stored === 'template') return { files: {}, origin: 'local' };
      const origin = stored === 'template' || stored === 'generated' ? stored : 'local';
      return { files: saved, origin };
    }
  } catch { /* ignore */ }
  return { files: {}, origin: 'local' };
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

const textForNoTests = (lang) => lang === 'ar' ? 'لم يُشغّل اختبار: لا يوجد أمر اختبار في المشروع.' : 'No tests were run: the project has no test script.';

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
  const [active, setActive] = useState(() => entryFile(bootRef.current.files) || Object.keys(bootRef.current.files).sort()[0] || '');
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
  const [showHistory, setShowHistory] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat'); // files|code|preview
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
    if (!active || !(active in files)) return;
    setFiles((f) => ({ ...f, [active]: val }));
    setDirty(true);
  };

  const addFile = () => {
    const name = window.prompt(t('fileNamePrompt'), 'new-file.html');
    if (!name || files[name]) return;
    setFiles((f) => ({ ...f, [name]: '' }));
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
          plan: opts.plan ?? plan,
          prompt: prompt.trim(),
          framework: opts.plan?.framework || framework,
          lang,
          instruction: editing ? instruction : undefined,
          files: editing ? files : undefined,
          projectId: selectedId || undefined,
        },
      });
      const next = r.files && typeof r.files === 'object' ? r.files : null;
      let generatedProjectId = selectedId;
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
              body: { name: opts.plan?.title || plan?.title || projectName, description: (opts.plan?.description || plan?.description || prompt).slice(0, 200), files: next, framework: r.framework },
            });
            const proj = cr?.project;
            if (!proj?.id) throw new Error('project_not_created');
            setProjects((prev) => [proj, ...prev.filter((x) => x.id !== proj.id)]);
            setSelectedId(proj.id);
            generatedProjectId = proj.id;
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
      return { files: next, changed: r.changed || {}, mode: r.mode, summary: r.summary, projectId: generatedProjectId };
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
      let newPlan = plan;
      if (create) {
        newPlan = await doPlan({ prompt: text });
        if (!newPlan) return;
      }
      const gen = await doGenerate({ instruction: create ? '' : text, edit: !create, plan: newPlan });
      if (!gen) return;
      if (create) setPrompt('');
      else setPrompt('');
      if (!autoRun) { pushMsg('agent', 'done', t('filesReady')); return; }

      let hasTests = false;
      try { hasTests = !!JSON.parse(gen.files['package.json'] || '{}').scripts?.test; } catch { /* build will report invalid package.json */ }
      const steps = (newPlan?.framework || framework) === 'static' ? ['dev'] : ['install', 'build', ...(hasTests ? ['test'] : []), 'dev'];
      if (!hasTests) pushMsg('agent', 'info', textForNoTests(lang));
      let currentFiles = gen.files;
      let failure = null;
      for (const action of steps) {
        const r = await runAction(action, undefined, { quiet: true, files: currentFiles, framework: newPlan?.framework || framework, projectId: gen.projectId });
        if (!r || r.exitCode !== 0 || !r.real) { failure = { action, r: r || { logs: '', exitCode: 1 } }; break; }
      }
      for (let round = 0; failure && failure.r.real && round < 2; round++) {
        const fix = await doDebug({ logs: failure.r.logs, command: failure.action, files: currentFiles });
        if (!failure.r.real || !fix || !Object.keys(fix.patch || {}).length) break;
        currentFiles = fix.fixedFiles || currentFiles;
        pushMsg('agent', 'debug', t('autoFixApplied', { n: Object.keys(fix.patch).length }), { files: Object.keys(fix.patch) });
        const again = await runAction(failure.action, undefined, { quiet: true, files: currentFiles, framework: newPlan?.framework || framework, projectId: gen.projectId });
        if (again && again.real && again.exitCode === 0) { failure = null; break; }
        failure = { action: failure.action, r: again };
      }
      if (failure) {
        pushMsg('agent', 'error', `${t('statusFailed')}: ${failure.action}`);
      } else {
        pushMsg('agent', 'done', t('pipelineDone'));
        if (gen.projectId) {
          try { await api(`workspace/projects/${gen.projectId}/snapshot`, { method: 'POST', body: { files: currentFiles, message: 'pipeline' } }); } catch { /* ignore */ }
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
      if (opts.projectId || selectedId) {
        r = await api(`workspace/projects/${opts.projectId || selectedId}/execute`, { method: 'POST', body: { action, command: customCommand, files: opts.files || files, framework: opts.framework || framework } });
      } else {
        const cmdMap = {
          install: (opts.framework || framework) === 'static' ? 'echo "static: no install needed"' : 'npm install',
          build: (opts.framework || framework) === 'static' ? 'echo "static build — validating"' : 'npm run build',
          test: 'npm test',
          dev: (opts.framework || framework) === 'static' ? 'python3 -m http.server 5173 --bind 0.0.0.0' : (opts.framework || framework) === 'next' ? 'npm run dev -- --port 3000 --hostname 0.0.0.0' : 'npm run dev -- --host 0.0.0.0 --port 5173',
          run: customCommand || 'npm start',
        };
        r = await api('workspace/execute', {
          method: 'POST',
          body: { files: opts.files || files, command: customCommand || cmdMap[action] || 'echo hello', action, framework: opts.framework || framework },
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
      const r = await api('workspace/debug', { method: 'POST', body: { logs, files: opts.files || files, command, lang } });
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
        if (r.state !== 'READY') {
          setDeployState('idle');
          setDeployLog((prev) => `${prev}Vercel: ${r.state || 'QUEUED'} — ${r.url}\n`);
          toastFn(lang === 'ar' ? 'بدأ النشر؛ تحقق من حالته في Vercel' : 'Deployment started; check its status in Vercel');
          setDeploying(false);
          return;
        }
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
    const repo = window.prompt(lang === 'ar' ? 'مستودع GitHub (المالك/المستودع)' : 'GitHub repository (owner/repo)');
    if (!repo) return;
    const branch = window.prompt(lang === 'ar' ? 'الفرع' : 'Branch', 'main');
    if (!branch) return;
    setDeploying(true);
    setDeployLog((prev) => `${prev}⬆ GitHub...\n`);
    try {
      const r = await api('workspace/github/push', { method: 'POST', body: { files, projectId: selectedId || undefined, repo, branch } });
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
    setRemotePreviewUrl(null);
    setMessages([]);
    setExecLogs('');
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
    setFiles({});
    setActive('');
    setMessages([]);
    setRemotePreviewUrl(null);
    setSelectedId(null);
    setPlan(null);
    setCurrentStep('plan');
    setExecLogs('');
    setExecStatus('idle');
    setExecMode(null);
    setOrigin('local');
    setDirty(false);
    toastFn(t('newProjectCreated'));
  };

  const deleteProject = async (p) => {
    if (!window.confirm(`${t('deleteFailed')}? ${p.name}`)) return;
    try {
      await api(`workspace/projects/${p.id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      if (selectedId === p.id) {
        setSelectedId(null);
        setFiles({});
        setActive('');
        setPlan(null);
        setRemotePreviewUrl(null);
        setOrigin('local');
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
    // Blob documents inherit the application's origin; never open untrusted code unsandboxed.
    const url = remotePreviewUrl;
    if (url) {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win) return;
    }
    toastFn(t('popupBlocked'));
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
  const needsBuild = Object.keys(files).length === 0;
  const submitRequest = () => { if (!prompt.trim()) { toastFn(t('promptFirst')); return; } runPipeline({ create: needsBuild }); };

  const text = (ar, en) => lang === 'ar' ? ar : en;
  return (
    <div className="nxs2" dir={rtl ? 'rtl' : 'ltr'}>
      <header className="nxs2-header">
        <strong>nexora studio</strong>
        <div className="nxs2-actions">
          <button onClick={createNewProject}>{text('مشروع جديد', 'New project')}</button>
          <button onClick={saveProject} disabled={!fileNames.length}>{t('save')}</button>
          <button onClick={handlePushGitHub} disabled={!fileNames.length || deploying}>GitHub</button>
          <button className="nxs2-primary" onClick={handleDeploy} disabled={!fileNames.length || deploying}>{t('deploy')}</button>
        </div>
      </header>
      <nav className="nxs2-mobile-tabs" aria-label={text('لوحات مساحة العمل', 'Workspace panels')}>
        {['chat', 'files', 'code', 'preview'].map((tab) => <button key={tab} className={mobileTab === tab ? 'selected' : ''} onClick={() => setMobileTab(tab)}>{tab === 'chat' ? text('المحادثة', 'Chat') : t(tab === 'files' ? 'filesTab' : tab === 'code' ? 'codeTab' : 'previewTab')}</button>)}
      </nav>
      <div className="nxs2-layout">
        <section className={'nxs2-chat nxs2-panel' + (mobileTab === 'chat' ? ' nxs2-active' : '')}>
          <div className="nxs2-panel-title"><b>{text('المحادثة', 'Chat')}</b><span>{lastRun?.model || ''}</span></div>
          <div className="nxs2-messages" ref={chatRef} aria-live="polite">
            {messages.map((m, i) => <div key={i} className={'nxs2-message ' + m.role}><span>{m.role === 'user' ? text('أنت', 'You') : 'nexora'}</span><p dir="auto">{m.text}</p></div>)}
            {busy && <p className="nxs2-muted">{t('pipelineRunning')}</p>}
          </div>
          <div className="nxs2-compose">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={needsBuild ? text('صف التطبيق الذي تريد إنشاءه', 'Describe the app you want to build') : text('صف التعديل الذي تريده', 'Describe the change you want')} dir="auto" rows={3} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitRequest(); }} />
            <div className="nxs2-compose-actions">
              <select value={framework} onChange={(e) => setFramework(e.target.value)} aria-label="Framework">{FRAMEWORKS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
              <button onClick={() => doPlan()} disabled={busy || planning || !prompt.trim()}>{t('stepPlan')}</button>
              <button className="nxs2-primary" onClick={submitRequest} disabled={busy || !prompt.trim()}>{needsBuild ? text('إنشاء', 'Create') : text('تعديل', 'Edit')}</button>
            </div>
            <label className="nxs2-auto"><input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} /> {text('التشغيل تلقائيًا', 'Run automatically')}</label>
          </div>
        </section>
        <aside className={'nxs2-explorer nxs2-panel' + (mobileTab === 'files' ? ' nxs2-active' : '')}>
          <div className="nxs2-panel-title"><b>{t('projectsTitle')}</b><button onClick={createNewProject} aria-label={t('newProject')}>+</button></div>
          <div className="nxs2-projects">
            {projectsError && <p className="nxs2-muted">{t('projectsError')}</p>}
            {projects.map((p) => <div className="nxs2-project" key={p.id}><button className={selectedId === p.id ? 'selected' : ''} onClick={() => selectProject(p)} dir="auto">{p.name}</button><button onClick={() => deleteProject(p)} aria-label={text('حذف المشروع', 'Delete project')}>×</button></div>)}
          </div>
          <div className="nxs2-panel-title"><b>{t('filesTab')}</b><button onClick={addFile} aria-label={t('newFile')}>+</button></div>
          <div className="nxs2-file-list">{fileNames.map((name) => <div className="nxs2-file" key={name}><button dir="ltr" className={active === name ? 'selected' : ''} onClick={() => { setActive(name); setMobileTab('code'); }}>{name}</button><button onClick={() => renameFile(name)} aria-label={text('إعادة تسمية', 'Rename')}>✎</button><button onClick={() => deleteFile(name)} aria-label={text('حذف', 'Delete')}>×</button></div>)}</div>
          <div className="nxs2-explorer-foot"><input value={projectName} onChange={(e) => { setProjectName(e.target.value); markDirty(); }} aria-label={t('projectName')} dir="auto" /><small>{dirty ? t('unsaved') : selectedId ? t('saved2') : ''}</small>
          {selectedId && <><button onClick={() => { setShowHistory(!showHistory); refreshHistory(); }}>{t('history')}</button><button onClick={loadSnapshots}>{t('snapshots')}</button></>}
          {showHistory && execHistory.map((ex) => <div key={ex.id} className="nxs2-muted">{ex.action} · {ex.status}</div>)}
          {showSnapshots && snapshots.map((sn) => <button key={sn.id} onClick={() => restoreSnapshot(sn.id)}>{sn.message || t('restoreSnapshot')} · {new Date(sn.created_at).toLocaleString()}</button>)}
          </div>
        </aside>
        <main className={'nxs2-code nxs2-panel' + (mobileTab === 'code' ? ' nxs2-active' : '')}>
          <div className="nxs2-panel-title"><b dir="ltr">{active || t('codeTab')}</b><div><button onClick={copyCode} disabled={!active}>{t('copy')}</button><button onClick={downloadFile} disabled={!active}>{t('download')}</button></div></div>
          {active && Object.hasOwn(files, active) ? <CodeEditor value={activeContent} onChange={updateActive} fileName={active} onSave={saveProject} label={active} /> : <div className="nxs2-empty">{text('لا توجد ملفات بعد', 'No files yet')}</div>}
          <section className="nxs2-terminal"><div className="nxs2-panel-title"><button onClick={() => setTerminalOpen(!terminalOpen)}>{t('terminal')} {terminalOpen ? '−' : '+'}</button><div>{['install', 'build', 'test', 'dev'].map((action) => <button key={action} disabled={execStatus === 'running' || !fileNames.length} onClick={() => runAction(action)}>{t(action)}</button>)}<button onClick={() => doDebug()} disabled={!execLogs || execStatus === 'running'}>{t('debug')}</button></div></div>
          {terminalOpen && <><pre ref={terminalRef}>{execLogs || t('terminalIdle')}</pre><div className="nxs2-command"><input dir="ltr" value={customCmd} onChange={(e) => setCustomCmd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && customCmd.trim()) runAction('exec', customCmd); }} placeholder={t('customCmd')} /><button onClick={() => runAction('exec', customCmd)} disabled={!customCmd.trim() || execStatus === 'running'}>{t('run')}</button></div></>}</section>
        </main>
        <section className={'nxs2-preview nxs2-panel' + (mobileTab === 'preview' ? ' nxs2-active' : '')}>
          <div className="nxs2-panel-title"><div><b>{t('previewTab')}</b><small>{remotePreviewUrl ? t('previewRemote') : t('previewLocal')}</small></div><div><button onClick={refreshPreview}>{t('refresh')}</button><button onClick={openPreview} disabled={!remotePreviewUrl}>{t('open')}</button></div></div>
          <div className="nxs2-preview-body">{iframeSrc && fileNames.length ? <iframe key={previewNonce} title={t('previewTab')} src={iframeSrc} onLoad={() => setPreviewReady(true)} sandbox={remotePreviewUrl ? 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals' : 'allow-scripts allow-forms allow-popups allow-modals'} /> : <div className="nxs2-empty">{t('noPreviewTitle')}</div>}</div>
          {deployLog && <pre className="nxs2-deploy-log">{deployLog}</pre>}{deployUrl && <a href={deployUrl} target="_blank" rel="noreferrer">{deployUrl}</a>}
        </section>
      </div>
    </div>
  );
}
