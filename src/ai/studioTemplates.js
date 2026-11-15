/**
 * قوالب NEXORA Studio.
 *
 * كل ما هنا **بيانات تجريبية مولّدة** (sample) — وليس مشاريع إنتاج ولا مخزوناً حقيقياً.
 * لذلك:
 *  - لا صور خارجية (كانت روابط Unsplash تظهر مكسورة داخل المعاينة) — نستخدم SVG محلياً.
 *  - كل قالب مكتفٍ بذاته: HTML + CSS + JS كملفات حقيقية في مشروع، فيختبر المستكشف
 *    والمحرر والمعاينة معاً دون شبكة.
 *  - شريط «بيانات تجريبية» يُحقن تلقائياً في المعاينة (انظر studioPreview.js).
 */

const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="NEXORA logo">'
  + '<defs><linearGradient id="nxg" x1="0" y1="0" x2="1" y2="1">'
  + '<stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>'
  + '<rect width="48" height="48" rx="12" fill="url(#nxg)"/>'
  + '<path d="M13 34V14l22 20V14" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'
  + '</svg>';

const LANDING_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>متجري — قالب تجريبي</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="shop-head">
    <div class="logo">
      <img src="assets/logo.svg" alt="شعار المتجر" width="30" height="30">
      <span>متجري</span>
    </div>
    <div class="cart-badge">🛒 <span id="cart">0</span></div>
  </header>

  <main class="shop-main">
    <h1>واجهة متجر نموذجية</h1>
    <p class="note">هذا قالب تجريبي: المنتجات والأسعار أدناه أمثلة توضيحية وليست مخزوناً حقيقياً.</p>
    <section class="products" id="products" aria-label="منتجات تجريبية"></section>
  </main>

  <footer class="shop-foot">قالب تجريبي مولّد بواسطة NEXORA Studio</footer>
  <script src="app.js"></script>
</body>
</html>`;

const LANDING_CSS = `*{box-sizing:border-box;margin:0;padding:0;font-family:Cairo,system-ui,-apple-system,'Segoe UI',sans-serif}
body{background:#0a0a0f;color:#f5f5f7;min-height:100vh;display:flex;flex-direction:column}
.shop-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#11131a;border-bottom:1px solid #2a2d3a;position:sticky;top:0}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px}
.logo img{display:block;border-radius:8px}
.cart-badge{background:#1a1d27;border:1px solid #2a2d3a;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:700}
.shop-main{flex:1;padding:22px 18px 32px;max-width:1100px;margin:0 auto;width:100%}
.shop-main h1{font-size:20px;margin-bottom:6px}
.note{color:#9ca3af;font-size:13px;line-height:1.7;margin-bottom:18px}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.card{background:#161a22;border:1px solid #2a2d3a;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.card:hover{border-color:#8b5cf6}
.thumb{height:110px;display:flex;align-items:center;justify-content:center;font-size:38px;background:#1f2430}
.card h3{padding:10px 12px 2px;font-size:14px}
.card p{padding:0 12px;color:#9ca3af;font-size:11px}
.price{padding:6px 12px;color:#10b981;font-weight:700;font-size:13px}
.card button{margin:10px 12px 12px;padding:9px;border-radius:10px;border:0;background:linear-gradient(90deg,#8b5cf6,#ec4899);color:#fff;font-weight:700;font-size:12px;cursor:pointer}
.shop-foot{padding:14px;text-align:center;color:#6b7280;font-size:11px;border-top:1px solid #23263a}
`;

const LANDING_JS = `/* قالب تجريبي — البيانات أدناه أمثلة توضيحية فقط (ليست مخزوناً حقيقياً). */
var items = [
  { n: 'سماعات لاسلكية', p: '299 دج', e: '🎧' },
  { n: 'ساعة ذكية', p: '499 دج', e: '⌚' },
  { n: 'حقيبة جلدية', p: '199 دج', e: '🎒' },
  { n: 'نظارات شمسية', p: '149 دج', e: '🕶️' }
];

var grid = document.getElementById('products');
grid.innerHTML = items.map(function (item) {
  return '<article class="card">'
    + '<div class="thumb" aria-hidden="true">' + item.e + '</div>'
    + '<h3>' + item.n + '</h3>'
    + '<p>منتج تجريبي — بيانات توضيحية</p>'
    + '<div class="price">' + item.p + '</div>'
    + '<button type="button">أضف للسلة</button>'
    + '</article>';
}).join('');

var count = 0;
grid.addEventListener('click', function (ev) {
  if (ev.target.tagName !== 'BUTTON') return;
  count += 1;
  document.getElementById('cart').textContent = count;
});
`;

const DASHBOARD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>لوحة التحكم — قالب تجريبي</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,'Noto Sans Arabic',sans-serif}
body{background:#0f0f13;color:#e5e7eb;display:flex;min-height:100vh;flex-wrap:wrap}
aside{width:210px;background:#16161d;border-inline-start:1px solid #2a2d3a;padding:20px}
aside h2{font-size:16px;margin-bottom:18px;color:#8b5cf6}
aside a{display:block;padding:9px 12px;border-radius:8px;color:#9ca3af;text-decoration:none;margin-bottom:4px;font-size:13px}
aside a.active{background:#8b5cf61a;color:#8b5cf6}
main{flex:1;min-width:260px;padding:22px}
main h1{font-size:18px;margin-bottom:4px}
.sub{color:#9ca3af;font-size:12px;margin-bottom:18px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin-bottom:20px}
.stat{background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;padding:16px}
.stat b{font-size:24px;display:block}
.stat span{color:#9ca3af;font-size:12px}
.chart{background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;padding:18px;height:230px;display:flex;align-items:flex-end;gap:8px}
.bar{flex:1;background:linear-gradient(180deg,#8b5cf6,#5b21b6);border-radius:6px 6px 0 0;min-height:16px}
@media(max-width:640px){aside{width:100%;border:0;border-bottom:1px solid #2a2d3a;display:flex;gap:6px;overflow-x:auto}aside h2{display:none}aside a{white-space:nowrap;margin:0}}
</style></head>
<body>
<aside><h2>📊 لوحتي</h2><a class="active">الرئيسية</a><a>الطلبات</a><a>المنتجات</a><a>العملاء</a><a>الإعدادات</a></aside>
<main>
  <h1>لوحة تحكم نموذجية</h1>
  <p class="sub">أرقام هذا القالب وهمية للعرض فقط — ليست بياناتك الحقيقية.</p>
  <div class="stats">
    <div class="stat"><b>—</b><span>إجمالي المبيعات (بيانات تجريبية)</span></div>
    <div class="stat"><b>—</b><span>طلبات جديدة (بيانات تجريبية)</span></div>
    <div class="stat"><b>—</b><span>رضا العملاء (بيانات تجريبية)</span></div>
  </div>
  <div class="chart"><div class="bar" style="height:40%"></div><div class="bar" style="height:70%"></div><div class="bar" style="height:55%"></div><div class="bar" style="height:90%"></div><div class="bar" style="height:60%"></div><div class="bar" style="height:80%"></div></div>
</main>
</body></html>`;

const PORTFOLIO_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>بورتفوليو — قالب تجريبي</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,'Noto Sans Arabic',sans-serif}
body{background:#070a12;color:#fff}
.hero{min-height:78vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px 20px;background:radial-gradient(ellipse at 50% 0%,#5b21b6a0,transparent 62%)}
.hero h1{font-size:clamp(26px,7vw,44px);background:linear-gradient(90deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero p{color:#9ca3af;margin:12px 0 22px;max-width:520px;line-height:1.8;font-size:14px}
.btn{padding:12px 26px;border-radius:999px;border:0;background:linear-gradient(90deg,#8b5cf6,#06b6d4);color:#fff;font-weight:700;cursor:pointer}
.projects{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;padding:28px 20px;max-width:1000px;margin:0 auto}
.proj{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:18px}
.proj h3{color:#8b5cf6;margin-bottom:6px;font-size:15px}.proj p{color:#9ca3af;font-size:12px;line-height:1.6}
</style></head>
<body>
<div class="hero">
  <h1>اسمك هنا</h1>
  <p>هذا قالب بورتفوليو تجريبي — عدّل الاسم والنصوص والأعمال من محرر NEXORA Studio.</p>
  <button class="btn" type="button">تواصل معي</button>
</div>
<div class="projects">
  <div class="proj"><h3>🚀 مشروع أول</h3><p>وصف تجريبي — استبدله بعملك الحقيقي.</p></div>
  <div class="proj"><h3>🛒 مشروع ثانٍ</h3><p>وصف تجريبي — استبدله بعملك الحقيقي.</p></div>
  <div class="proj"><h3>📱 مشروع ثالث</h3><p>وصف تجريبي — استبدله بعملك الحقيقي.</p></div>
</div>
</body></html>`;

const CHAT_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>محادثة AI — قالب تجريبي</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,'Noto Sans Arabic',sans-serif}
body{background:#0f0f0f;color:#fff;height:100vh;display:flex;flex-direction:column}
header{padding:14px;text-align:center;border-bottom:1px solid #222;font-weight:700;font-size:14px}
header small{display:block;color:#9ca3af;font-weight:400;font-size:11px;margin-top:2px}
.msgs{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:82%;padding:10px 14px;border-radius:14px;line-height:1.7;font-size:13px}
.msg.bot{align-self:flex-start;background:#1f1f1f;border:1px solid #2a2a2a}
.msg.user{align-self:flex-end;background:#8b5cf6}
form{display:flex;gap:8px;padding:12px;border-top:1px solid #222}
input{flex:1;min-width:0;padding:11px 14px;border-radius:999px;border:1px solid #333;background:#1a1a1a;color:#fff;font-size:13px}
button{padding:11px 18px;border-radius:999px;border:0;background:#8b5cf6;color:#fff;font-weight:700;cursor:pointer;font-size:13px}
</style></head>
<body>
<header>🤖 مساعد ذكي<small>قالب تجريبي — الردود محلية ووهمية</small></header>
<div class="msgs" id="msgs"><div class="msg bot">مرحباً! هذا قالب محادثة تجريبي. اكتب أي رسالة لترى الشكل فقط — لا يوجد ذكاء اصطناعي متصل هنا.</div></div>
<form id="form"><input id="inp" placeholder="اكتب رسالتك..." autocomplete="off"><button type="submit">إرسال</button></form>
<script>
var msgs=document.getElementById('msgs');
document.getElementById('form').addEventListener('submit',function(ev){
  ev.preventDefault();
  var input=document.getElementById('inp');
  var value=input.value.trim();
  if(!value)return;
  var mine=document.createElement('div');mine.className='msg user';mine.textContent=value;msgs.appendChild(mine);
  input.value='';
  var reply=document.createElement('div');reply.className='msg bot';
  reply.textContent='(قالب تجريبي) هذا رد ثابت للعرض فقط. اربط واجهة برمجة حقيقية لتشغيل محادثة فعلية.';
  setTimeout(function(){msgs.appendChild(reply);msgs.scrollTop=msgs.scrollHeight;},450);
  msgs.scrollTop=msgs.scrollHeight;
});
</script>
</body></html>`;

export const TEMPLATES = [
  {
    id: 'landing',
    name: { ar: 'صفحة هبوط متجر', en: 'Shop landing page' },
    icon: '🛍️',
    desc: { ar: 'متجر بسيط مع سلة — 4 ملفات (HTML/CSS/JS/SVG)', en: 'Simple shop — 4 files (HTML/CSS/JS/SVG)' },
    framework: 'static',
    sample: true,
    files: {
      'index.html': LANDING_HTML,
      'styles.css': LANDING_CSS,
      'app.js': LANDING_JS,
      'assets/logo.svg': LOGO_SVG,
    },
  },
  {
    id: 'dashboard',
    name: { ar: 'لوحة تحكم', en: 'Dashboard' },
    icon: '📊',
    desc: { ar: 'لوحة إحصاءات متجاوبة — بيانات وهمية', en: 'Responsive stats dashboard — dummy data' },
    framework: 'static',
    sample: true,
    files: { 'index.html': DASHBOARD_HTML },
  },
  {
    id: 'portfolio',
    name: { ar: 'بورتفوليو', en: 'Portfolio' },
    icon: '💼',
    desc: { ar: 'موقع شخصي بسيط', en: 'Simple personal site' },
    framework: 'static',
    sample: true,
    files: { 'index.html': PORTFOLIO_HTML },
  },
  {
    id: 'ai-chat',
    name: { ar: 'تطبيق محادثة AI', en: 'AI chat UI' },
    icon: '🤖',
    desc: { ar: 'واجهة محادثة — ردود محلية فقط', en: 'Chat UI — local replies only' },
    framework: 'static',
    sample: true,
    files: { 'index.html': CHAT_HTML },
  },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0];

/** اسم القالب حسب اللغة (بدون تعقيد i18n الكامل). */
export function templateName(t, lang) {
  return (t.name && (t.name[lang] || t.name.ar || t.name.en)) || t.id;
}
export function templateDesc(t, lang) {
  return (t.desc && (t.desc[lang] || t.desc.ar || t.desc.en)) || '';
}
