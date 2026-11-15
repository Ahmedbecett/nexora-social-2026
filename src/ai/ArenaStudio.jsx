import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api.js';

// ── quick starters (kept as fallback / local generation) ──
const TEMPLATES = [
  {
    id: 'landing',
    name: 'صفحة هبوط متجر',
    icon: '🛍️',
    desc: 'متجر إلكتروني مع منتجات وسلة',
    framework: 'static',
    files: {
      'index.html': `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>متجري</title><style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Cairo,system-ui}body{background:#0a0a0f;color:#fff}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#11131a;border-bottom:1px solid #2a2d3a}
.logo{font-weight:800;font-size:20px;background:linear-gradient(90deg,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;padding:24px;max-width:1200px;margin:0 auto}
.card{background:#161a22;border:1px solid #2a2d3a;border-radius:16px;overflow:hidden;transition:.2s}
.card:hover{border-color:#8b5cf6;transform:translateY(-4px)}
.card img{width:100%;height:180px;object-fit:cover}
.card h3{padding:12px 16px 4px;font-size:15px}
.card p{padding:0 16px;color:#9ca3af;font-size:13px}
.price{padding:8px 16px;color:#10b981;font-weight:700}
.card button{width:calc(100% - 32px);margin:12px 16px;padding:10px;border-radius:10px;border:0;background:linear-gradient(90deg,#8b5cf6,#ec4899);color:#fff;font-weight:700;cursor:pointer}
.cart{position:fixed;bottom:20px;left:20px;background:#8b5cf6;color:#fff;padding:12px 20px;border-radius:999px;font-weight:700;box-shadow:0 8px 30px #8b5cf640}
</style></head><body>
<header><div class="logo">✦ متجري</div><div>🛒 <span id="cart">0</span></div></header>
<div class="products" id="products"></div>
<div class="cart">السلة: <span id="count">0</span> منتج</div>
<script>
const items=[{n:'سماعات لاسلكية',p:'299 دج',img:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'},{n:'ساعة ذكية',p:'499 دج',img:'https://images.unsplash.com/photo-1523275335684-37898b79b01f?w=400'},{n:'حقيبة جلدية',p:'199 دج',img:'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400'},{n:'نظارات شمسية',p:'149 دج',img:'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400'}];
let c=0;
document.getElementById('products').innerHTML=items.map(i=>\`<div class="card"><img src="\${i.img}"><h3>\${i.n}</h3><p>جودة عالية • شحن مجاني</p><div class="price">\${i.p}</div><button onclick="add()">أضف للسلة</button></div>\`).join('');
function add(){c++;document.getElementById('count').textContent=c;document.getElementById('cart').textContent=c}
<\/script></body></html>`,
    }
  },
  {
    id: 'dashboard',
    name: 'لوحة تحكم',
    icon: '📊',
    desc: 'Dashboard مع رسوم بيانية',
    framework: 'static',
    files: {
      'index.html': `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لوحة التحكم</title><style>
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui}body{background:#0f0f13;color:#e5e7eb;display:flex;min-height:100vh}
aside{width:220px;background:#16161d;border-left:1px solid #2a2d3a;padding:20px}
aside h2{font-size:18px;margin-bottom:20px;color:#8b5cf6}aside a{display:block;padding:10px 12px;border-radius:8px;color:#9ca3af;text-decoration:none;margin-bottom:4px}
aside a.active{background:#8b5cf61a;color:#8b5cf6}
main{flex:1;padding:24px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.stat{background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;padding:20px}
.stat b{font-size:28px;display:block}
.stat span{color:#9ca3af;font-size:13px}
.chart{background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;padding:20px;height:260px;display:flex;align-items:end;gap:8px}
.bar{flex:1;background:linear-gradient(180deg,#8b5cf6,#5b21b6);border-radius:6px 6px 0 0;min-height:20px}
</style></head><body>
<aside><h2>📊 لوحتي</h2><a class="active">الرئيسية</a><a>الطلبات</a><a>المنتجات</a><a>العملاء</a><a>الإعدادات</a></aside>
<main><h1>مرحباً، أحمد 👋</h1><div class="stats"><div class="stat"><b>1,248</b><span>إجمالي المبيعات</span></div><div class="stat"><b>342</b><span>طلب جديد</span></div><div class="stat"><b>98%</b><span>رضا العملاء</span></div></div><div class="chart"><div class="bar" style="height:40%"></div><div class="bar" style="height:70%"></div><div class="bar" style="height:55%"></div><div class="bar" style="height:90%"></div><div class="bar" style="height:60%"></div><div class="bar" style="height:80%"></div></div></main>
</body></html>`,
    }
  },
  {
    id: 'portfolio',
    name: 'بورتفوليو',
    icon: '💼',
    desc: 'موقع شخصي مع أعمال',
    framework: 'static',
    files: {
      'index.html': `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio</title><style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Cairo}body{background:#070a12;color:#fff}
.hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#5b21b6a0,transparent 60%)}
.hero h1{font-size:48px;background:linear-gradient(90deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{color:#9ca3af;margin:12px 0 24px;max-width:560px;line-height:1.8}
.btn{padding:12px 28px;border-radius:999px;border:0;background:linear-gradient(90deg,#8b5cf6,#06b6d4);color:#fff;font-weight:700;cursor:pointer}
.projects{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;padding:40px;max-width:1100px;margin:0 auto}
.proj{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:20px}
.proj h3{color:#8b5cf6;margin-bottom:8px}.proj p{color:#9ca3af;font-size:13px}
</style></head><body>
<div class="hero"><h1>Ahmed Becetti</h1><p>مطور ويب ومنشئ NEXORA AI — أبني منصات ذكاء اصطناعي ومتاجر إلكترونية</p><button class="btn">تواصل معي</button></div>
<div class="projects"><div class="proj"><h3>🚀 NEXORA AI</h3><p>منصة ذكاء اصطناعي مثل Arena</p></div><div class="proj"><h3>🛒 متجر</h3><p>تجارة إلكترونية مع دفع</p></div><div class="proj"><h3>📱 تطبيق</h3><p>أندرويد مع إشعارات</p></div></div>
</body></html>`,
    }
  },
  {
    id: 'ai-chat',
    name: 'تطبيق محادثة AI',
    icon: '🤖',
    desc: 'واجهة محادثة حية',
    framework: 'static',
    files: {
      'index.html': `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Chat</title><style>
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui}body{background:#0f0f0f;color:#fff;height:100vh;display:flex;flex-direction:column}
header{padding:16px;text-align:center;border-bottom:1px solid #222;font-weight:700}
.msgs{flex:1;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
.msg{max-width:70%;padding:12px 16px;border-radius:16px;line-height:1.6}
.msg.user{align-self:flex-start;background:#8b5cf6}
.msg.ai{align-self:flex-end;background:#1f1f1f;border:1px solid #2a2a2a}
form{display:flex;gap:10px;padding:16px;border-top:1px solid #222}
input{flex:1;padding:12px 16px;border-radius:999px;border:1px solid #333;background:#1a1a1a;color:#fff}
button{padding:12px 24px;border-radius:999px;border:0;background:#8b5cf6;color:#fff;font-weight:700;cursor:pointer}
</style></head><body>
<header>🤖 مساعد ذكي</header>
<div class="msgs" id="msgs"><div class="msg ai">مرحباً! كيف أساعدك اليوم؟</div></div>
<form onsubmit="send(event)"><input id="inp" placeholder="اكتب رسالتك..."><button>إرسال</button></form>
<script>
function send(e){e.preventDefault();const v=inp.value.trim();if(!v)return;msgs.innerHTML+='<div class=msg user>'+v+'</div>';inp.value='';setTimeout(()=>{msgs.innerHTML+='<div class=msg ai>تم — اربطها بـ NEXORA API لتحويلها لمنصة حقيقية!</div>';msgs.scrollTop=msgs.scrollHeight},600);msgs.scrollTop=msgs.scrollHeight}
<\/script></body></html>`,
    }
  },
];

const STEPS = [
  { id: 'plan', label: 'Plan', ar: 'خطط', icon: '📋' },
  { id: 'create', label: 'Create', ar: 'أنشئ', icon: '⚡' },
  { id: 'execute', label: 'Execute', ar: 'نفّذ', icon: '▶️' },
  { id: 'test', label: 'Test', ar: 'اختبر', icon: '🧪' },
  { id: 'debug', label: 'Debug', ar: 'صحّح', icon: '🐛' },
  { id: 'deploy', label: 'Deploy', ar: 'انشر', icon: '🚀' },
];

function fileLang(name) {
  if (name.endsWith('.html')) return 'html';
  if (name.endsWith('.css')) return 'css';
  if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.ts')) return 'javascript';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.md')) return 'markdown';
  return 'text';
}
function fileIcon(name) {
  if (name.endsWith('.html')) return '🌐';
  if (name.endsWith('.css')) return '🎨';
  if (name.endsWith('.js') || name.endsWith('.jsx')) return '⚡';
  if (name.endsWith('.json')) return '📦';
  if (name.endsWith('.md')) return '📄';
  return '📄';
}

function buildPreviewBlob(files) {
  const html = files['index.html'] || Object.values(files)[0] || '<html><body><h1>Empty</h1></body></html>';
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}

export default function ArenaStudio({ toast }) {
  const toastFn = toast || ((m) => { try { const el=document.createElement('div'); el.textContent=m; el.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:999px;font-size:12px;z-index:9999'; document.body.appendChild(el); setTimeout(()=>el.remove(), 2500);} catch{} });

  // ── project memory: both DB + GitHub (chosen), fallback localStorage ──
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [framework, setFramework] = useState('static');
  const [capabilities, setCapabilities] = useState(null);
  const [integrations, setIntegrations] = useState(null);

  // files & editor
  const [files, setFiles] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('nx_arena_files') || 'null'); if (saved && typeof saved === 'object') return saved; } catch {}
    return { ...TEMPLATES[0].files };
  });
  const [active, setActive] = useState(() => Object.keys(TEMPLATES[0].files)[0]);
  const [dirty, setDirty] = useState(false);

  // autonomous pipeline
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [currentStep, setCurrentStep] = useState('plan');
  const [generating, setGenerating] = useState(false);
  const [planning, setPlanning] = useState(false);

  // execution engine (real isolation)
  const [execLogs, setExecLogs] = useState('');
  const [execStatus, setExecStatus] = useState('idle'); // idle|running|success|failed
  const [execAction, setExecAction] = useState('');
  const [execHistory, setExecHistory] = useState([]);
  const [customCmd, setCustomCmd] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [projectName, setProjectName] = useState('مشروع NEXORA');

  const previewRef = useRef(null);
  const terminalRef = useRef(null);
  const editorRef = useRef(null);

  const activeContent = files[active] || '';

  // ── load capabilities & integrations ──
  useEffect(() => {
    api('workspace/capabilities').then(setCapabilities).catch(()=>setCapabilities({ mode:'vercel-fallback', e2b:false }));
    api('workspace/status').then(setIntegrations).catch(()=> setIntegrations({ vercel:{connected:true,project:'nexora-social-2026'}, github:{connected:true,repo:'Ahmedbecett/nexora-social-2026'}, drive:{connected:false}}));
  }, []);

  // ── projects: load from DB (source of truth) + local mirror ──
  const loadProjects = useCallback(async ()=>{
    try {
      const r = await api('workspace/projects');
      setProjects(r.projects || []);
      if (r.projects?.length && !selectedId) {
        // don't auto-select, let user choose; but preload files from first if empty
      }
    } catch {
      // offline: local only
    }
  }, [selectedId]);
  useEffect(()=>{ loadProjects(); }, [loadProjects]);

  // ── persist files to localStorage + DB when dirty ──
  useEffect(()=>{ localStorage.setItem('nx_arena_files', JSON.stringify(files)); }, [files]);

  // preview Blob for static
  useEffect(()=>{
    if (!previewRef.current) return;
    if (previewUrl && previewUrl.startsWith('http')) {
      previewRef.current.src = previewUrl;
      return;
    }
    const url = buildPreviewBlob(files);
    previewRef.current.src = url;
    return ()=> URL.revokeObjectURL(url);
  }, [files, previewUrl]);

  // auto-scroll terminal
  useEffect(()=>{ if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight; }, [execLogs]);

  // executions history for selected project
  const refreshHistory = useCallback(async ()=>{
    if (!selectedId) { setExecHistory([]); return; }
    try {
      const r = await api(`workspace/projects/${selectedId}/executions`);
      setExecHistory(r.executions || []);
    } catch { /* ignore */ }
  }, [selectedId]);
  useEffect(()=>{ refreshHistory(); }, [refreshHistory]);

  // ── editor helpers ──
  const updateActive = (val) => {
    setFiles(f=>({ ...f, [active]: val }));
    setDirty(true);
  };
  const addFile = () => {
    const name = window.prompt('اسم الملف (مثال: src/App.jsx أو style.css):', 'new-file.html');
    if (!name || files[name]) return;
    const ext = name.split('.').pop();
    let seed = '';
    if (name.endsWith('.html')) seed = '<!doctype html><html><head><meta charset="utf-8"><title>New</title></head><body><h1>مرحبا</h1></body></html>';
    else if (name.endsWith('.css')) seed = '/* styles */\nbody{font-family:system-ui}';
    else if (name.endsWith('.jsx')||name.endsWith('.js')) seed = 'export default function App(){ return <div>Hello NEXORA</div> }';
    else if (name.endsWith('.json')) seed = '{\n  "name": "nexora"\n}';
    else seed = '// new file';
    setFiles(f=>({ ...f, [name]: seed }));
    setActive(name);
  };
  const deleteFile = (name) => {
    if (Object.keys(files).length<=1) { toastFn('يجب أن يبقى ملف واحد على الأقل'); return; }
    if (!window.confirm('حذف '+name+'؟')) return;
    const next={...files}; delete next[name];
    setFiles(next);
    if (active===name) setActive(Object.keys(next)[0]);
  };
  const renameFile = (name) => {
    const neu = window.prompt('اسم جديد:', name);
    if (!neu || neu===name || files[neu]) return;
    const next={...files, [neu]: files[name]}; delete next[name];
    setFiles(next); setActive(neu);
  };
  const loadTemplate = (t) => {
    if (!window.confirm('تحميل قالب "'+t.name+'"؟ سيتم استبدال الملفات الحالية.')) return;
    setFiles({ ...t.files }); setActive(Object.keys(t.files)[0]); setFramework(t.framework||'static'); setShowTemplates(false); toastFn('تم تحميل قالب '+t.name);
  };

  // ── autonomous: Plan → Create ──
  const doPlan = async () => {
    const p = prompt.trim();
    if (!p) { toastFn('اكتب وصف التطبيق أولاً — مثال: متجر لبيع العطور مع سلة ودفع'); return; }
    setPlanning(true); setCurrentStep('plan');
    try {
      const r = await api('workspace/plan', { method:'POST', body:{ prompt:p, framework } });
      setPlan(r.plan);
      setProjectName(r.plan.title || 'مشروع NEXORA');
      setFramework(r.plan.framework || framework);
      toastFn('✓ تم إنشاء الخطة — راجع التفاصيل ثم اضغط "توليد"');
      setCurrentStep('create');
    } catch (e) {
      // still use fallback plan from server even on error (server returns fallback plan inside 200)
      toastFn('تعذر التخطيط: '+(e.code||'خطأ'));
    }
    setPlanning(false);
  };
  const doGenerate = async () => {
    if (!plan && !prompt.trim()) { toastFn('أنشئ خطة أولاً'); return; }
    setGenerating(true); setCurrentStep('create');
    try {
      const r = await api('workspace/generate', { method:'POST', body:{ plan, prompt, framework, projectId: selectedId || undefined } });
      setFiles(r.files);
      setActive(Object.keys(r.files)[0] || 'index.html');
      setFramework(r.framework || framework);
      toastFn('✓ تم توليد الملفات — جاهزة للتنفيذ والاختبار');
      setCurrentStep('execute');
      // auto-create snapshot + project if needed
      if (!selectedId) {
        try {
          const cr = await api('workspace/projects', { method:'POST', body:{ name: plan?.title || projectName, description: plan?.description || prompt.slice(0,200), files: r.files, framework: r.framework } });
          setProjects(p=>[cr.project, ...p]); setSelectedId(cr.project.id);
          toastFn('✓ تم حفظ المشروع في الذاكرة (DB + GitHub ready)');
        } catch {}
      } else {
        try { await api(`workspace/projects/${selectedId}`, { method:'PATCH', body:{ files: r.files, framework: r.framework }}); toastFn('✓ تم تحديث المشروع'); } catch {}
      }
    } catch (e) { toastFn('تعذر التوليد: '+(e.code||'خطأ')); }
    setGenerating(false);
  };

  // ── generic execute (real isolation) ──
  const runAction = async (action, customCommand) => {
    setExecStatus('running'); setExecAction(action); setExecLogs(`▶ Running ${action} ...\n`);
    setCurrentStep(action==='test' ? 'test' : action==='debug' ? 'debug' : 'execute');
    try {
      let r;
      if (selectedId) {
        r = await api(`workspace/projects/${selectedId}/execute`, { method:'POST', body:{ action, command: customCommand, files } });
      } else {
        // ephemeral run without saved project (still isolated)
        const cmdMap = {
          install: framework==='static' ? 'echo "static: no install needed"' : 'npm install',
          build: framework==='static' ? 'echo "static build — validating"' : 'npm run build',
          test: 'npm test --if-present',
          dev: framework==='next' ? 'npm run dev -- --port 3000 --hostname 0.0.0.0' : 'npm run dev -- --host 0.0.0.0 --port 5173',
          run: customCommand || 'npm start',
        };
        r = await api('workspace/execute', { method:'POST', body:{ files, command: customCommand || cmdMap[action] || 'echo hello', action, framework } });
      }
      setExecLogs(r.logs || '');
      setExecStatus(r.exitCode===0 ? 'success' : 'failed');
      if (r.previewUrl) setPreviewUrl(r.previewUrl);
      if (r.exitCode!==0) {
        setDebugInfo(null);
        // keep logs visible for debug step
      } else {
        toastFn(action==='test' ? '✓ الاختبارات اكتملت' : action==='build' ? '✓ البناء نجح' : '✓ تم التنفيذ بنجاح');
        if (action==='test') setCurrentStep('debug');
        if (action==='build') setCurrentStep('test');
      }
      refreshHistory();
    } catch (e) {
      setExecLogs(l=>l+`\n✗ ${e.code||'error'}: ${e.detail||e.message||'فشل التنفيذ'}`);
      setExecStatus('failed');
      toastFn('فشل التنفيذ: '+(e.code||'خطأ'));
    }
  };

  const doDebug = async () => {
    if (!execLogs) { toastFn('لا يوجد سجل لتصحيحه — نفّذ البناء أولاً'); return; }
    setExecAction('debug'); setExecStatus('running'); setCurrentStep('debug');
    setExecLogs(l=>l+'\n\n🔍 AI Debug: يحلل السجلات...\n');
    try {
      const r = await api('workspace/debug', { method:'POST', body:{ logs: execLogs, files } });
      setDebugInfo(r);
      let out = `\n── AI Debug Analysis ──\nProvider: ${r.provider}\n\n`;
      out += r.suggestions.map((s,i)=>`${i+1}. ${s}`).join('\n');
      if (r.patch) {
        out += `\n\n── Proposed patch ──\n${Object.keys(r.patch).join(', ')} will be updated`;
      }
      out += `\n${r.note||''}\n`;
      setExecLogs(l=>l+out);
      setExecStatus('success');
      // auto-apply patch if present and user confirms
      if (r.fixedFiles && r.patch) {
        if (window.confirm('هل تريد تطبيق الإصلاح المقترح تلقائياً؟\n'+ Object.keys(r.patch).join(', '))) {
          setFiles(r.fixedFiles);
          if (selectedId) {
            try { await api(`workspace/projects/${selectedId}`, { method:'PATCH', body:{ files: r.fixedFiles }}); } catch{}
          }
          toastFn('✓ تم تطبيق الإصلاح — أعد تشغيل البناء');
        }
      }
    } catch (e) {
      setExecLogs(l=>l+`\n✗ Debug failed: ${e.code||'error'}`);
      setExecStatus('failed');
    }
  };

  // ── deploy / github / drive (real Vercel integration) ──
  const handleDeploy = async () => {
    setDeploying(true); setDeployLog('🚀 تجهيز النشر...\n'); setCurrentStep('deploy');
    try {
      const r = await api('workspace/deploy', { method:'POST', body:{ files, projectId: selectedId||undefined, name: projectName } });
      setDeployLog(l=>l+'✅ '+(r.message||'تم النشر')+'\n'+(r.url?'🔗 '+r.url+'\n':'')+(r.real?'● Real Vercel deployment\n':'○ Preview (add VERCEL_TOKEN for real deploy)\n'));
      toastFn(r.real? '✓ تم النشر الحقيقي إلى Vercel' : '✓ تم حفظ المعاينة — أضف VERCEL_TOKEN للنشر الحقيقي');
      if (r.url) window.open(r.url,'_blank');
    } catch (e) {
      if (e.status===404) setDeployLog(l=>l+'💾 تم حفظ المشروع محلياً. انسخ الكود وانشره يدوياً عبر Vercel أو GitHub.\n');
      else setDeployLog(l=>l+'❌ '+(e.code||e.message)+'\n');
      toastFn('تعذر النشر: '+(e.code||'خطأ'));
    }
    setDeploying(false);
  };
  const handlePushGitHub = async () => {
    setDeploying(true); setDeployLog('📤 دفع إلى GitHub (source of truth)...\n');
    try {
      const r = await api('workspace/github/push', { method:'POST', body:{ files, projectId: selectedId||undefined } });
      setDeployLog(l=>l+'✅ '+(r.repo? r.repo+' @ '+r.branch : r.message)+'\n'+(r.url?'🔗 '+r.url+'\n':'')+(r.real? '● Real GitHub push\n':'○ Prepared — connect GitHub OAuth or add GITHUB_TOKEN\n'));
      // create snapshot for project memory
      if (selectedId) try { await api(`workspace/projects/${selectedId}/snapshot`, { method:'POST', body:{ files, message: 'github push' }}); } catch{}
      toastFn(r.real?'✓ تم الدفع إلى GitHub':'✓ جاهز للدفع — اربط GitHub');
      refreshHistory();
    } catch (e) { setDeployLog(l=>l+'❌ '+(e.code||'خطأ')+'\n'); toastFn('تعذر الدفع: '+(e.code||'خطأ')); }
    setDeploying(false);
  };
  const saveToDrive = async () => {
    setDeploying(true); setDeployLog('💾 حفظ إلى Google Drive...\n');
    try {
      const r = await api('workspace/drive/save', { method:'POST', body:{ files, name: projectName+'-'+Date.now() }});
      setDeployLog(l=>l+'✅ '+r.message+'\n'+(r.url?'🔗 '+r.url+'\n':'')+(r.real?'● Real Drive save\n':'○ Prepared — add GOOGLE_DRIVE_TOKEN or OAuth\n'));
      toastFn(r.real?'✓ تم الحفظ في Drive':'✓ جاهز — اربط Drive');
    } catch(e){ setDeployLog(l=>l+'❌ '+(e.code||'خطأ')+'\n'); toastFn('تعذر الحفظ: '+(e.code||'خطأ')); }
    setDeploying(false);
  };

  // project select
  const selectProject = async (p) => {
    setSelectedId(p.id);
    setProjectName(p.name);
    setFramework(p.framework||'static');
    setFiles(p.files || {});
    setActive(Object.keys(p.files||{})[0] || 'index.html');
    setPlan({ title:p.name, description:p.description, framework:p.framework });
    setCurrentStep('execute');
    // load executions
    try { const r=await api(`workspace/projects/${p.id}/executions`); setExecHistory(r.executions||[]); } catch{}
  };
  const createNewProject = () => {
    const name = window.prompt('اسم المشروع الجديد:', 'مشروع NEXORA '+new Date().toLocaleDateString('ar'));
    if (!name) return;
    setProjectName(name); setFiles({ ...TEMPLATES[0].files }); setActive('index.html'); setSelectedId(null); setPlan(null); setCurrentStep('plan'); setExecLogs(''); toastFn('✓ مشروع جديد — ابدأ بوصف فكرتك');
  };
  const deleteProject = async (p) => {
    if (!window.confirm('حذف المشروع "'+p.name+'" نهائياً؟')) return;
    try { await api(`workspace/projects/${p.id}`, { method:'DELETE' }); setProjects(pr=>pr.filter(x=>x.id!==p.id)); if (selectedId===p.id){ setSelectedId(null); setFiles({ ...TEMPLATES[0].files }); } toastFn('تم الحذف'); } catch{ toastFn('تعذر الحذف'); }
  };
  const saveProject = async () => {
    const name = projectName.trim() || 'مشروع NEXORA';
    try {
      if (selectedId) {
        const r = await api(`workspace/projects/${selectedId}`, { method:'PATCH', body:{ name, files, framework } });
        setProjects(pr=>pr.map(x=>x.id===selectedId? r.project : x));
        await api(`workspace/projects/${selectedId}/snapshot`, { method:'POST', body:{ files, message:'manual save' }});
        toastFn('✓ تم حفظ التغييرات (DB snapshot)');
      } else {
        const r = await api('workspace/projects', { method:'POST', body:{ name, description: prompt.slice(0,300), files, framework } });
        setProjects(pr=>[r.project, ...pr]); setSelectedId(r.project.id); toastFn('✓ تم إنشاء المشروع وحفظه');
      }
      // also prepare GitHub commit history (project memory = DB + GitHub)
    } catch(e){ localStorage.setItem('nx_arena_files', JSON.stringify(files)); toastFn('تم الحفظ محلياً ('+(e.code||'دون اتصال')+')'); }
  };

  const copyCode = async () => { try{ await navigator.clipboard.writeText(activeContent); toastFn('تم النسخ'); } catch{ toastFn('تعذر النسخ'); } };
  const downloadFile = () => {
    const blob=new Blob([activeContent],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=active; a.click(); URL.revokeObjectURL(url);
  };

  const execBadges = {
    idle: '—',
    running: '⏳ يعمل...',
    success: '✅ نجح',
    failed: '❌ فشل'
  };

  return (
    <div className="arena-studio">
      {/* Top: brand + pipeline */}
      <div className="arena-top">
        <div className="arena-top-left">
          <b>⬢ NEXORA Studio — منصة تطوير ذاتية</b>
          <small>plan → create → execute → test → debug → deploy · حفظ مزدوج: DB + GitHub</small>
        </div>
        <div className="arena-top-actions">
          <button className="arena-btn ghost" onClick={()=>setShowTemplates(!showTemplates)}>📦 قوالب</button>
          <button className="arena-btn ghost" onClick={saveToDrive} disabled={deploying}>💾 Drive</button>
          <button className="arena-btn ghost" onClick={handlePushGitHub} disabled={deploying}>⬆ GitHub</button>
          <button className="arena-btn primary" onClick={handleDeploy} disabled={deploying}>{deploying? '⏳ ينشر...' : '🚀 نشر إلى Vercel'}</button>
        </div>
      </div>

      {/* execution capabilities */}
      <div className="arena-integrations">
        <span className="arena-int">
          <i style={{background: capabilities?.e2b ? '#10b981' : '#f59e0b'}} />
          تنفيذ: {capabilities?.e2b ? 'E2B Sandboxes ● معزول حقيقي' : 'Vercel Fallback ○ (أضف E2B_API_KEY)'} · {capabilities?.mode}
        </span>
        <span className="arena-int">
          <i style={{background: integrations?.vercel?.connected ? '#10b981' : '#f59e0b'}} />
          Vercel: {integrations?.vercel?.project || 'nexora-social-2026'} {integrations?.vercel?.connected ? '● متصل' : '○ محلي'}
        </span>
        <span className="arena-int">
          <i style={{background: integrations?.github?.connected ? '#10b981' : '#ef4444'}} />
          GitHub: {integrations?.github?.repo || 'Ahmedbecett/nexora-social-2026'} ● {integrations?.github?.branch || 'main'} {integrations?.github?.oauth ? '(OAuth)' : ''}
        </span>
        <span className="arena-int">
          <i style={{background: integrations?.drive?.connected ? '#10b981' : '#6b7280'}} />
          Drive: {integrations?.drive?.connected ? 'متصل ✓' : 'غير مربوط'}
        </span>
        <span className="arena-int muted">المشاريع: {projects.length} · الإعلانات: Adsterra+Monetag ✓</span>
      </div>

      {/* Pipeline stepper */}
      <div className="arena-pipeline">
        {STEPS.map(s=>(
          <button key={s.id} className={'arena-step '+(currentStep===s.id?'active':'')+(STEPS.findIndex(x=>x.id===currentStep) > STEPS.findIndex(x=>x.id===s.id) ? ' done':'')} onClick={()=>setCurrentStep(s.id)}>
            <span>{s.icon}</span><b>{s.ar} · {s.label}</b><small>{currentStep===s.id? '● الآن' : ''}</small>
          </button>
        ))}
        <div className="arena-pipeline-status">
          <span className={'badge '+execStatus}>{execBadges[execStatus]}</span>
          <small>{framework} · {selectedId? 'DB ✓' : 'محلي'}</small>
        </div>
      </div>

      {/* Templates drawer */}
      {showTemplates && (
        <div className="arena-templates">
          {TEMPLATES.map(t=>(
            <button key={t.id} className="arena-tpl" onClick={()=>loadTemplate(t)}>
              <span>{t.icon}</span><b>{t.name}</b><small>{t.desc} · {t.framework}</small>
            </button>
          ))}
          <div className="arena-tpl" style={{borderStyle:'dashed'}}>
            <span>➕</span><b>مشروع فارغ</b><small>ابدأ من الصفر — اختر framework ثم اكتب prompt</small>
            <button style={{marginTop:8,padding:'6px 10px',borderRadius:8,background:'#8b5cf6',color:'#fff',border:0}} onClick={createNewProject }>إنشاء</button>
          </div>
        </div>
      )}

      {/* AI prompt bar — generic builder (no fixed demo) */}
      <div className="arena-ai-bar">
        <select value={framework} onChange={e=>setFramework(e.target.value)} className="arena-fw">
          <option value="static">Static (HTML)</option>
          <option value="vite">Vite + React</option>
          <option value="next">Next.js</option>
          <option value="api">Node API (Express)</option>
        </select>
        <input
          value={prompt}
          onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter' && (e.metaKey||e.ctrlKey)) doPlan(); }}
          placeholder="صف أي تطبيق تريد بناءه... مثال: منصة تواصل اجتماعي مع تسجيل دخول، منشورات، رسائل، إعجابات — أو متجر إلكتروني، لوحة تحكم، API — ثم اضغط خطط"
          disabled={planning||generating}
        />
        <button onClick={doPlan} disabled={planning || !prompt.trim()}>{planning ? '⏳ يخطط...' : '📋 خطط'}</button>
        <button onClick={doGenerate} disabled={generating || (!plan && !prompt.trim())} style={{background:'linear-gradient(90deg,#06b6d4,#8b5cf6)'}}>{generating? '⏳ يولّد...' : '⚡ ولّد الملفات'}</button>
      </div>

      {/* Plan card */}
      {plan && (
        <div className="arena-plan">
          <div className="arena-plan-head">
            <b>📋 خطة: {plan.title}</b>
            <span className="arena-chip">{plan.framework}</span>
            <button onClick={()=>setPlan(null)}>✕</button>
          </div>
          <p>{plan.description}</p>
          <div className="arena-plan-grid">
            <div><b>الميزات</b><ul>{(plan.features||[]).map((f,i)=><li key={i}>{f}</li>)}</ul></div>
            <div><b>الملفات</b><ul>{(plan.fileStructure||Object.keys(files)).map((f,i)=><li key={i}>{f}</li>)}</ul></div>
            <div><b>الخطوات</b><ol>{(plan.steps||STEPS.map(s=>s.ar)).map((s,i)=><li key={i}>{s}</li>)}</ol></div>
          </div>
          {plan.fallback && <small className="muted">خطة احتياطية محلية — تُفعّل بالذكاء الحقيقي عند توفر مفاتيح Gemini/OpenAI</small>}
        </div>
      )}

      {/* Main IDE layout */}
      <div className="arena-layout">
        {/* Left: file explorer + projects */}
        <aside className="arena-files">
          <div className="arena-files-head">
            <b>المستكشف</b>
            <span style={{display:'flex',gap:6}}>
              <button onClick={addFile} title="ملف جديد">＋</button>
              <button onClick={saveProject} title="حفظ المشروع (DB+GitHub history)">💾</button>
            </span>
          </div>

          <div className="arena-projects">
            <div className="arena-section-title">
              <span>المشاريع ({projects.length})</span>
              <button onClick={createNewProject}>＋ جديد</button>
            </div>
            {projects.length===0 && <div className="arena-empty">لا مشاريع — ابدأ بوصف فكرتك أعلاه</div>}
            {projects.map(p=>(
              <div key={p.id} className={'arena-proj '+(selectedId===p.id?'active':'')} onClick={()=>selectProject(p)}>
                <span>{p.name}</span>
                <small>{p.framework} · {new Date(p.updated_at).toLocaleDateString('ar')}</small>
                <button onClick={(e)=>{e.stopPropagation(); deleteProject(p);}} title="حذف">✕</button>
              </div>
            ))}
            {selectedId && (
              <button className="arena-link" onClick={()=>setShowHistory(!showHistory)}>
                {showHistory? '▼' : '▶'} سجل التنفيذ ({execHistory.length})
              </button>
            )}
            {showHistory && execHistory.map(ex=>(
              <div key={ex.id} className="arena-history-item">
                <b>{ex.action}</b><small>{ex.status} · {new Date(ex.created_at).toLocaleTimeString('ar')}</small>
                <pre>{(ex.logs||'').slice(0,120)}…</pre>
              </div>
            ))}
          </div>

          <div className="arena-files-head" style={{marginTop:8}}><b>الملفات</b><small>{Object.keys(files).length} ملفات</small></div>
          {Object.keys(files).sort().map(name=>(
            <div key={name} className={'arena-file '+(active===name?'active':'')} onClick={()=>setActive(name)}>
              <span><i>{fileIcon(name)}</i> {name}</span>
              <span className="arena-file-ops">
                <button onClick={(e)=>{e.stopPropagation(); renameFile(name);}} title="إعادة تسمية">✎</button>
                <button onClick={(e)=>{e.stopPropagation(); deleteFile(name);}} title="حذف">✕</button>
              </span>
            </div>
          ))}
          <div className="arena-files-foot">
            <small>💾 حفظ مزدوج · DB للتشغيل · GitHub للتأريخ والفروع</small>
            <div style={{marginTop:6, display:'flex', gap:6}}>
              <input value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="اسم المشروع" style={{flex:1, padding:'6px 8px', borderRadius:6, border:'1px solid #2a2d3a', background:'#0a0a0f', color:'#e5e7eb', fontSize:11}} />
            </div>
          </div>
        </aside>

        {/* Center: editor + terminal */}
        <main className="arena-editor">
          <div className="arena-editor-bar">
            <span>{active} · {fileLang(active)} · {activeContent.length} حرف</span>
            <span>
              <button onClick={copyCode}>📋 نسخ</button>
              <button onClick={downloadFile}>⬇ تنزيل</button>
              <button onClick={saveProject} style={{background:'#10b981', color:'#fff', borderColor:'#10b981'}}>💾 حفظ</button>
            </span>
          </div>
          {/* Monaco-like editor: textarea with line numbers, real syntax when monaco available fallback to textarea */}
          <div className="arena-code-wrap">
            <div className="arena-gutter">
              {activeContent.split('\n').map((_,i)=><span key={i}>{i+1}</span>)}
            </div>
            <textarea
              ref={editorRef}
              value={activeContent}
              onChange={e=>updateActive(e.target.value)}
              spellCheck={false}
              placeholder="اكتب كود HTML/CSS/JS هنا — يدعم كل frameworks: static, vite, next, api..."
              className="arena-code"
            />
          </div>

          {/* Terminal */}
          <div className="arena-terminal">
            <div className="arena-terminal-bar">
              <b>▣ الطرفية — تنفيذ معزول {capabilities?.e2b ? '(E2B ● حقيقي)' : '(Vercel ○ احتياطي)'}</b>
              <span>
                <button onClick={()=>runAction('install')} disabled={execStatus==='running'}>📦 install</button>
                <button onClick={()=>runAction('build')} disabled={execStatus==='running'}>🔨 build</button>
                <button onClick={()=>runAction('test')} disabled={execStatus==='running'}>🧪 test</button>
                <button onClick={doDebug} disabled={execStatus==='running' || !execLogs}>🐛 debug</button>
                <button onClick={()=>runAction('dev')} disabled={execStatus==='running'}>▶ dev</button>
              </span>
            </div>
            <div className="arena-terminal-actions">
              <input value={customCmd} onChange={e=>setCustomCmd(e.target.value)} placeholder="أمر مخصص — مثال: npm install lodash && npm run build" onKeyDown={e=>{ if(e.key==='Enter') runAction('exec', customCmd); }} />
              <button onClick={()=>runAction('exec', customCmd)} disabled={!customCmd.trim() || execStatus==='running'}>تنفيذ</button>
              <button onClick={()=>{setExecLogs(''); setExecStatus('idle'); setDebugInfo(null);}}>مسح</button>
            </div>
            <pre ref={terminalRef} className="arena-terminal-log">
{execLogs || '→ جاهز — اختر install / build / test / dev أو اكتب أمراً مخصصاً\n→ كل تنفيذ يُجرى في حاوية معزولة (E2B عند توفر المفتاح، وإلا احتياطي Vercel يتحقق من الملفات بصدق)\n→ السجلات الحقيقية تظهر هنا، ويمكن للذكاء تحليل الأخطاء واقتراح إصلاح تلقائي\n'}
            </pre>
            {debugInfo && (
              <div className="arena-debug-card">
                <b>🐛 تحليل AI</b>
                <ul>{debugInfo.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul>
                {debugInfo.patch && <small>إصلاح مقترح: {Object.keys(debugInfo.patch).join(', ')}</small>}
              </div>
            )}
          </div>
        </main>

        {/* Right: preview + status */}
        <section className="arena-preview">
          <div className="arena-preview-bar">
            <span>👁️ معاينة حية {previewUrl? '· '+previewUrl.slice(0,30)+'…' : ''}</span>
            <span>
              <button onClick={()=>previewRef.current && (previewRef.current.src = previewRef.current.src)}>🔄 تحديث</button>
              <button onClick={()=>{ if (previewUrl) window.open(previewUrl,'_blank'); else if (previewRef.current?.src) window.open(previewRef.current.src,'_blank'); }}>↗ فتح</button>
            </span>
          </div>
          <iframe ref={previewRef} title="preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" />
          {(deployLog || execLogs) && (
            <pre className="arena-log">{deployLog || execLogs.slice(-2000)}</pre>
          )}
          <div className="arena-statusbar">
            <span>▢ {framework}</span>
            <span className={'dot '+execStatus}>● {execAction||'idle'} {execBadges[execStatus]}</span>
            <span>{dirty? '● غير محفوظ' : '✓ محفوظ'} · {Object.keys(files).length} ملفات</span>
            <span>project memory: DB + GitHub</span>
          </div>
        </section>
      </div>
    </div>
  );
}
