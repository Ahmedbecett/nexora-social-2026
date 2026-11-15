/**
 * NEXORA Studio — بناء مستند المعاينة الحية.
 *
 * لماذا هذا الملف منفصل؟
 *  - المعاينة كانت تُبنى بـ `new Blob([files['index.html']])` فقط، فكانت أي صفحة
 *    تعتمد على `styles.css` أو `app.js` أو `assets/logo.svg` تظهر مكسورة تماماً
 *    (لا تنسيق، لا صور، لا سكربت). هذا هو سبب «الصور المكسورة» في التقرير.
 *  - هنا نبني مستنداً واحداً مكتفياً بذاته: نُضمّن ملفات CSS/JS من المشروع،
 *    ونحوّل الأصول المحلية (svg/png/woff…) إلى data URI، ونضيف طبقة احتياط
 *    لأي صورة تفشل في التحميل (شبكة مقطوعة، رابط خارجي ميت…).
 *  - الدوال هنا نقية (بدون React/بدون DOM) حتى يمكن اختبارها في tests/*.test.mjs.
 */

const IMAGE_MIME = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
};

const FONT_MIME = { woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };

const TEXT_EXT = new Set(['css', 'js', 'mjs', 'jsx', 'ts', 'tsx', 'json', 'md', 'txt', 'html', 'htm', 'svg']);

const HLJS_LANG = {
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  css: 'css',
  scss: 'css',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  sh: 'bash',
  bash: 'bash',
};

/** امتداد الملف بأحرف صغيرة، بدون نقطة. */
export function extOf(name) {
  const n = String(name || '');
  const i = n.lastIndexOf('.');
  return i < 0 ? '' : n.slice(i + 1).toLowerCase();
}

/** لغة العرض/التلوين لملف في المحرر. */
export function fileLang(name) {
  const ext = extOf(name);
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css' || ext === 'scss') return 'css';
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs' || ext === 'jsx') return 'javascript';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'json') return 'json';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'svg') return 'xml';
  return 'text';
}

/** اسم لغة highlight.js المقابل (أو null للنص العادي). */
export function highlightLang(name) {
  return HLJS_LANG[extOf(name)] || null;
}

export function fileIcon(name) {
  const ext = extOf(name);
  if (ext === 'html' || ext === 'htm') return '🌐';
  if (ext === 'css' || ext === 'scss') return '🎨';
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'ts' || ext === 'tsx') return '⚡';
  if (ext === 'json') return '📦';
  if (ext === 'md') return '📄';
  if (ext === 'svg' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif') return '🖼️';
  if (ext === 'woff' || ext === 'woff2' || ext === 'ttf') return '🔤';
  return '📄';
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function escapeAttr(s) {
  return escapeHtml(s);
}

/** تنظيف مسار داخل المشروع: ./x، /x، a\b → x */
export function normPath(ref) {
  return String(ref ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .trim();
}

function isExternalRef(ref) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(String(ref || '').trim());
}

/** أول ملف HTML صالح لعرضه كصفحة. */
export function entryFile(files) {
  const names = Object.keys(files || {});
  if (names.includes('index.html')) return 'index.html';
  return names.find((n) => /\.html?$/i.test(n)) || null;
}

/**
 * إيجاد ملف المشروع المطابق لمرجع داخل HTML/CSS.
 * يدعم `styles.css`، `./styles.css`، `/styles.css`، `src/styles.css`، ومطابقة الاسم المجرد.
 * يعيد null للمراجع الخارجية (http, data, blob, #) وللملفات غير الموجودة.
 */
export function resolveProjectFile(files, ref) {
  if (!files || ref == null) return null;
  const raw = String(ref).trim();
  if (!raw || isExternalRef(raw)) return null;
  const clean = normPath(raw.split('#')[0].split('?')[0]);
  if (!clean) return null;
  const map = new Map(Object.keys(files).map((k) => [normPath(k), k]));
  if (map.has(clean)) {
    const key = map.get(clean);
    return { name: key, content: String(files[key] ?? '') };
  }
  // مطابقة بالاسم المجرد (index.html قد يشير إلى style.css بينما الملف css/style.css)
  const base = clean.split('/').pop();
  for (const [norm, key] of map) {
    if (norm.split('/').pop() === base) return { name: key, content: String(files[key] ?? '') };
  }
  return null;
}

function toBase64(str) {
  const text = String(str ?? '');
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  // بيئة Node (اختبارات)
  return Buffer.from(text, 'utf8').toString('base64');
}

const looksBase64 = (s) => /^[A-Za-z0-9+/\s]+={0,2}$/.test(String(s || '').trim()) && String(s).trim().length > 64;

/** تحويل ملف مشروع إلى data URI إن أمكن (صور/خطوط)، وإلا null. */
export function assetDataUri(name, content) {
  const ext = extOf(name);
  const body = String(content ?? '');
  if (!body) return null;
  if (IMAGE_MIME[ext]) {
    // SVG is text: encode the markup as-is.
    if (ext === 'svg') {
      return body.includes('<') ? `data:${IMAGE_MIME[ext]};base64,${toBase64(body)}` : null;
    }
    // Raster images must already be base64 in the project file map.
    if (looksBase64(body) && !body.includes('<')) {
      return `data:${IMAGE_MIME[ext]};base64,${body.replace(/\s+/g, '')}`;
    }
    return null;
  }
  if (FONT_MIME[ext]) {
    if (looksBase64(body)) return `data:${FONT_MIME[ext]};base64,${body.replace(/\s+/g, '')}`;
    return null;
  }
  return null;
}

/** مخطط بديل يظهر مكان أي صورة يتعذّر تحميلها. */
export const IMAGE_PLACEHOLDER_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" role="img">',
  '<rect width="320" height="200" fill="#eef1f6"/>',
  '<rect x="1" y="1" width="318" height="198" fill="none" stroke="#c8d0dd" stroke-width="2" stroke-dasharray="8 6" rx="10"/>',
  '<path d="M96 132l38-44 30 34 22-24 38 46H96z" fill="#aab6c8"/>',
  '<circle cx="132" cy="70" r="14" fill="#aab6c8"/>',
  '<text x="160" y="176" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#7c8798">image unavailable</text>',
  '</svg>',
].join('');

export const IMAGE_PLACEHOLDER_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(IMAGE_PLACEHOLDER_SVG)}`;

/** سكربت يُحقن في المعاينة: يعوّض أي صورة مكسورة ويعلّمها بكلاس واضح. */
export const IMAGE_FALLBACK_SCRIPT = `(function(){
  var PH = ${JSON.stringify(IMAGE_PLACEHOLDER_URI)};
  function patch(img){
    if (!img || img.tagName !== 'IMG' || img.getAttribute('data-nx-fallback')) return;
    img.setAttribute('data-nx-fallback', '1');
    img.classList.add('nx-img-broken');
    if (!img.getAttribute('alt')) img.setAttribute('alt', 'صورة غير متاحة / image unavailable');
    img.removeAttribute('srcset');
    img.src = PH;
  }
  document.addEventListener('error', function(e){ patch(e.target); }, true);
  function sweep(){
    var list = document.images || [];
    for (var i = 0; i < list.length; i++) {
      var im = list[i];
      if (im.complete && im.naturalWidth === 0) patch(im);
    }
  }
  document.addEventListener('DOMContentLoaded', sweep);
  window.addEventListener('load', sweep);
  setTimeout(sweep, 1200);
})();`;

const BASE_CSS = `
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0}
img{max-width:100%;height:auto}
img.nx-img-broken{min-width:120px;min-height:80px;object-fit:contain!important;background:#eef1f6;border-radius:10px}
#nx-sample-note{position:relative;z-index:2147483000;display:flex;flex-direction:column;gap:2px;
  padding:9px 14px;background:#fff8e6;color:#7a4a00;border-bottom:1px solid #f0d8a8;
  font:600 12px/1.5 system-ui,-apple-system,'Noto Sans Arabic',sans-serif;text-align:start}
#nx-sample-note span[dir=ltr]{font-weight:500;opacity:.85;font-size:11px}
#nx-sample-note .nx-sn-short{display:none}
@media (max-width:520px){
  #nx-sample-note{padding:7px 10px;font-size:11px;line-height:1.4;gap:1px}
  #nx-sample-note span[dir=ltr]{font-size:10px}
  #nx-sample-note .nx-sn-full{display:none}
  #nx-sample-note .nx-sn-short{display:block}
}
`;

const SAMPLE_NOTE_ID = 'nx-sample-note';

/** بطاقة تنبيه تُحقن أعلى الصفحة عندما تكون الملفات قالباً مولّداً (بيانات تجريبية). */
export function sampleNoteHtml() {
  return `<div id="${SAMPLE_NOTE_ID}" role="note">
  <span dir="rtl" class="nx-sn-full">ℹ️ بيانات تجريبية — مشروع مولّد: المنتجات والأسعار والصور أمثلة توضيحية، وليست مخزوناً حقيقياً متصلاً بأي متجر.</span>
  <span dir="rtl" class="nx-sn-short">ℹ️ بيانات تجريبية — ليست مخزوناً حقيقياً</span>
  <span dir="ltr" class="nx-sn-full">Sample project — products, prices and images are placeholders, not real connected inventory.</span>
  <span dir="ltr" class="nx-sn-short">Sample data — not real inventory.</span>
</div>`;
}

function ensureDocument(html) {
  let out = String(html || '');
  if (!/<html[\s>]/i.test(out)) {
    out = `<!doctype html><html dir="auto"><head><meta charset="utf-8"></head><body>${out}</body></html>`;
  }
  if (!/<head[\s>]/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, '<html$1><head><meta charset="utf-8"></head>');
  }
  if (!/name=["']viewport["']/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width, initial-scale=1">');
  }
  return out;
}

function injectBeforeClose(html, tag, markup) {
  const re = new RegExp(`</${tag}\\s*>`, 'i');
  if (re.test(html)) return html.replace(re, `${markup}\n</${tag}>`);
  return `${html}\n${markup}`;
}

/** صفحة بديلة صادقة عندما لا يوجد ملف HTML في المشروع. */
export function noPreviewDocument(files, lang = 'ar') {
  const names = Object.keys(files || {});
  const title = lang === 'ar' ? 'لا توجد صفحة HTML للمعاينة' : 'No HTML page to preview';
  const body = lang === 'ar'
    ? 'هذا المشروع لا يحتوي على ملف HTML. أضف <code>index.html</code> لعرض معاينة حية.'
    : 'This project has no HTML file. Add <code>index.html</code> to get a live preview.';
  return `<!doctype html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f1118;
color:#e5e7eb;font:14px/1.7 system-ui,'Noto Sans Arabic',sans-serif;padding:24px;text-align:center}
.card{max-width:420px}h1{font-size:16px;margin:0 0 8px}p{color:#9ca3af;margin:0 0 14px}
code{background:#1a1d27;padding:2px 6px;border-radius:6px;color:#8b5cf6}
ul{list-style:none;padding:0;margin:0;color:#6b7280;font-size:12px}</style></head><body><div class="card">
<h1>🖥️ ${escapeHtml(title)}</h1><p>${body}</p><ul>${names.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
</div></body></html>`;
}

/**
 * بناء مستند المعاينة الكامل من خريطة ملفات المشروع.
 * @param {Record<string,string>} files
 * @param {{ entry?: string, sample?: boolean, lang?: 'ar'|'en' }} [opts]
 * @returns {{ html: string, entry: string|null, inlined: string[], brokenRefs: string[] }}
 */
export function buildPreviewDocument(files, opts = {}) {
  const safeFiles = files && typeof files === 'object' ? files : {};
  const lang = opts.lang === 'en' ? 'en' : 'ar';
  const sample = !!opts.sample;
  const entry = opts.entry || entryFile(safeFiles);

  if (!entry) {
    return { html: noPreviewDocument(safeFiles, lang), entry: null, inlined: [], brokenRefs: [] };
  }

  let html = String(safeFiles[entry] ?? '');
  if (!html.trim()) {
    return { html: noPreviewDocument(safeFiles, lang), entry, inlined: [], brokenRefs: [] };
  }

  const inlined = [];
  const brokenRefs = [];

  // 1) <img src="local"> → data URI
  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    if (!m) return tag;
    if (isExternalRef(m[2])) return tag;
    const f = resolveProjectFile(safeFiles, m[2]);
    if (!f) {
      brokenRefs.push(m[2]);
      return tag;
    }
    const uri = assetDataUri(f.name, f.content);
    if (!uri) {
      brokenRefs.push(f.name);
      return tag;
    }
    if (!inlined.includes(f.name)) inlined.push(f.name);
    return tag.replace(m[0], `src="${uri}"`);
  });

  // 2) <link rel=stylesheet href="local.css"> → <style>
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const m = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
    if (!m || isExternalRef(m[2])) return tag;
    const f = resolveProjectFile(safeFiles, m[2]);
    if (!f) {
      brokenRefs.push(m[2]);
      return tag;
    }
    if (!inlined.includes(f.name)) inlined.push(f.name);
    return `<style data-nx-file="${escapeAttr(f.name)}">\n${f.content}\n</style>`;
  });

  // 3) <script src="local.js"> → <script>
  html = html.replace(/<script\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*?)>\s*<\/script\s*>/gi, (tag, pre, _q, src, post) => {
    if (isExternalRef(src)) return tag;
    const f = resolveProjectFile(safeFiles, src);
    if (!f) {
      brokenRefs.push(src);
      return tag;
    }
    if (!inlined.includes(f.name)) inlined.push(f.name);
    const attrs = `${pre}${post}`.replace(/\s+/g, ' ').trim();
    return `<script ${attrs} data-nx-file="${escapeAttr(f.name)}">\n${f.content.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });

  // 4) url(...) داخل CSS مضمّن → data URI
  html = html.replace(/url\(\s*(["']?)([^"'()]+)\1\s*\)/gi, (whole, _q, ref) => {
    if (isExternalRef(ref)) return whole;
    const f = resolveProjectFile(safeFiles, ref);
    if (!f) return whole;
    const uri = assetDataUri(f.name, f.content);
    if (!uri) return whole;
    if (!inlined.includes(f.name)) inlined.push(f.name);
    return `url("${uri}")`;
  });

  // 5) ضمان بنية مستند + viewport (المعاينة على الهاتف تحتاج ذلك)
  html = ensureDocument(html);

  // 6) طبقة CSS الأساسية + ملاحظة المشروع التجريبي
  html = injectBeforeClose(html, 'head', `<style data-nx-base>${BASE_CSS}</style>`);
  html = html.replace(/<body([^>]*)>/i, `<body$1>${sample ? sampleNoteHtml() : ''}`);

  // 7) سكربت احتياط الصور (آخر شيء كي يلتقط كل الصور)
  html = injectBeforeClose(html, 'body', `<script data-nx-fallback>${IMAGE_FALLBACK_SCRIPT}</script>`);

  return { html, entry, inlined, brokenRefs };
}

/** توليد ملف نصي قابل للتنزيل من المشروع (كل الملفات في ملف واحد). */
export function projectBundle(files) {
  const parts = Object.keys(files || {}).sort().map((name) => `/* ───── ${name} ───── */\n${files[name]}`);
  return parts.join('\n\n');
}
