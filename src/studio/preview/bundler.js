/* ============================================================================
   NEXORA Studio — in-browser preview compiler
   ----------------------------------------------------------------------------
   Static projects are composed straight from their HTML (local CSS/JS inlined).
   React/TS projects are bundled with esbuild-wasm against the project's virtual
   file system, so the preview shows the real application after every edit with
   no server round-trip.

   Bare imports stay external and are resolved by an import map: React comes
   from locally bundled vendor files, everything else from esm.sh.
   ============================================================================ */

const BASE = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/').replace(/\/$/, '');

let esbuildPromise = null;
async function getEsbuild() {
  if (!esbuildPromise) {
    esbuildPromise = (async () => {
      const esbuild = await import('esbuild-wasm');
      await esbuild.initialize({ wasmURL: `${BASE}/studio/esbuild.wasm`, worker: false });
      return esbuild;
    })().catch((e) => {
      esbuildPromise = null;
      throw new Error('preview compiler failed to load: ' + e.message);
    });
  }
  return esbuildPromise;
}

const JS_EXT = ['.jsx', '.tsx', '.ts', '.js', '.mjs'];
const ASSET_LOADERS = {
  '.css': 'css', '.json': 'json', '.txt': 'text',
  '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.gif': 'dataurl',
  '.svg': 'dataurl', '.webp': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl',
  '.ttf': 'dataurl', '.mp3': 'dataurl', '.mp4': 'dataurl',
};
const REACT_SPECIFIERS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

export function previewKind(files) {
  const paths = Object.keys(files || {});
  if (!paths.length) return 'empty';
  if (paths.some((p) => /^next\.config\./.test(p)) || paths.some((p) => /^app\/(page|layout)\.(jsx|tsx|js|ts)$/.test(p))) return 'server';
  if (paths.some((p) => /\.(jsx|tsx)$/.test(p))) return 'bundle';
  const html = files['index.html'];
  if (html && /<script[^>]+type=["']module["']/.test(html)) return 'bundle';
  if (html) return 'static';
  if (paths.some((p) => p.endsWith('.html'))) return 'static';
  return 'static';
}

/* ------------------------------ shared bits ------------------------------ */
const CONSOLE_BRIDGE = `<script>
(function(){
  var send=function(level,args){try{parent.postMessage({source:'nxs-preview',level:level,args:Array.prototype.map.call(args,function(a){
    if(a instanceof Error)return (a.stack||a.message||String(a)).slice(0,1200);
    if(typeof a==='object'&&a!==null){try{return JSON.stringify(a).slice(0,1200);}catch(e){return String(a);}}
    return String(a);
  })},'*');}catch(e){}};
  ['log','info','warn','error','debug'].forEach(function(level){
    var orig=console[level]?console[level].bind(console):function(){};
    console[level]=function(){send(level,arguments);orig.apply(console,arguments);};
  });
  window.addEventListener('error',function(e){
    send('error',[(e.message||'Script error')+(e.filename?' — '+e.filename.split('/').pop()+(e.lineno?':'+e.lineno:'') : '')]);
  });
  window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise: '+(e.reason&&e.reason.message||e.reason)]);});
})();
</script>`;

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dirOf(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function joinPath(dir, rel) {
  const parts = (dir ? dir + '/' : '').concat(rel).split('/');
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function candidates(path) {
  const list = [path];
  if (!/\.[a-z0-9]+$/i.test(path)) {
    for (const ext of ['.jsx', '.tsx', '.js', '.ts', '.mjs', '.json', '.css']) list.push(path + ext);
    for (const ext of ['.jsx', '.tsx', '.js', '.ts']) list.push(path + '/index' + ext);
  }
  return list;
}

function resolveLocal(files, spec, importer) {
  if (spec.startsWith('@/') || spec.startsWith('~/')) {
    const fromRoot = spec.slice(2);
    return candidates(fromRoot).find((c) => files[c] !== undefined) || null;
  }
  if (spec.startsWith('/')) {
    const fromRoot = spec.slice(1);
    return candidates(fromRoot).find((c) => files[c] !== undefined) || null;
  }
  const target = joinPath(dirOf(importer || ''), spec);
  return candidates(target).find((c) => files[c] !== undefined) || null;
}

/* ------------------------------- static html ----------------------------- */
function composeStatic(files, entry = 'index.html') {
  const htmlPath = files[entry] !== undefined ? entry : (Object.keys(files).find((p) => p.endsWith('.html')) || '');
  let html = htmlPath ? files[htmlPath] : '';
  const warnings = [];
  if (!html) {
    const css = Object.keys(files).filter((p) => p.endsWith('.css')).map((p) => `<style>\n${files[p]}\n</style>`).join('\n');
    const js = Object.keys(files).filter((p) => /\.(m?js)$/.test(p)).map((p) => `<script>\n${files[p]}\n</script>`).join('\n');
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body>${js}</body></html>`;
    return { html: injectBridge(html), warnings: ['no index.html — preview composed from the available files'] };
  }
  const dir = dirOf(htmlPath);

  // local stylesheets
  html = html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (m, pre, href, post) => {
    if (/^https?:|^\/\//i.test(href)) return m;
    const resolved = resolveLocal(files, href, htmlPath);
    if (!resolved || !resolved.endsWith('.css')) { warnings.push(`missing stylesheet: ${href}`); return m; }
    return `<style data-from="${escapeHtml(resolved)}">\n${files[resolved]}\n</style>`;
  });

  // local scripts (keeping module type contract of the original tag)
  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/gi, (m, pre, src, post) => {
    if (/^https?:|^\/\//i.test(src)) return m;
    const resolved = resolveLocal(files, src, htmlPath);
    if (!resolved) { warnings.push(`missing script: ${src}`); return m; }
    const body = files[resolved] || '';
    if (/\btype=["']module["']/.test(pre + post)) return `<script type="module">\n${body}\n</script>`;
    return `<script>\n${body}\n</script>`;
  });

  // inline local assets referenced by src/href that exist as text (svg)
  html = html.replace(/(src|href)=["']([^"':#]+\.svg)["']/gi, (m, attr, url) => {
    const resolved = resolveLocal(files, url, htmlPath);
    if (!resolved) return m;
    return `${attr}="data:image/svg+xml;charset=utf-8,${encodeURIComponent(files[resolved])}"`;
  });

  return { html: injectBridge(html), warnings };
}

function injectBridge(html) {
  const bridge = CONSOLE_BRIDGE;
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, (m) => m + bridge);
  else html = bridge + html;
  // keep links inside the preview instead of navigating the Studio away
  const basePatch = `<base target="_blank">`;
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head([^>]*)>/i, (m) => m + basePatch);
  else html = basePatch + html;
  return html;
}

/* -------------------------------- bundling ------------------------------- */
function pickEntry(files) {
  const order = ['src/main.jsx', 'src/main.tsx', 'src/main.js', 'src/main.ts', 'src/index.jsx', 'src/index.tsx', 'src/index.js', 'main.jsx', 'index.jsx', 'index.js'];
  for (const p of order) if (files[p] !== undefined) return p;
  const html = files['index.html'];
  if (html) {
    const m = html.match(/<script[^>]+src=["']([^"']+)["']/i);
    if (m && !/^https?:/i.test(m[1])) {
      const resolved = resolveLocal(files, m[1], 'index.html');
      if (resolved) return resolved;
    }
  }
  return null;
}

function findHtml(files) {
  if (files['index.html'] !== undefined) return 'index.html';
  return Object.keys(files).find((p) => p.endsWith('.html')) || null;
}

function htmlShell({ title, css, js, imports, bodyClass = '' }) {
  return `<!doctype html>
<html lang="ar" dir="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title || 'Preview')}</title>
${CONSOLE_BRIDGE}
<script type="importmap">${JSON.stringify({ imports }, null, 0)}</script>
<style>${css || ''}</style>
</head>
<body class="${bodyClass}">
<div id="root"></div>
<script type="module">
${js || ''}
</script>
</body>
</html>`;
}

/** Bundle a React/TS project with esbuild-wasm. */
export async function bundleProject(files, { title = 'Preview', esbuild: injected = null } = {}) {
  const entry = pickEntry(files);
  if (!entry) throw new Error('no JavaScript entry point found (expected src/main.jsx or index.js)');
  const esbuild = injected || await getEsbuild();
  const externals = new Set([...REACT_SPECIFIERS]);
  const importedCss = new Set();
  const warnings = [];

  const virtualFs = {
    name: 'nxs-vfs',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path.startsWith('.') || args.path.startsWith('/') || args.path.startsWith('@/') || args.path.startsWith('~/')) {
          // entry points arrive with an empty importer and are already project-relative
          const resolved = args.importer ? resolveLocal(files, args.path, args.importer) : resolveLocal(files, args.path, '');
          if (!resolved) return { errors: [{ text: `cannot resolve "${args.path}" from ${args.importer || entry}` }] };
          if (resolved.endsWith('.css')) importedCss.add(resolved);
          return { path: resolved, namespace: 'nxs' };
        }
        externals.add(args.path);
        return { path: args.path, external: true };
      });
      build.onLoad({ filter: /.*/, namespace: 'nxs' }, (args) => {
        const ext = (args.path.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
        const loader = ASSET_LOADERS[ext] || (JS_EXT.includes(ext) ? (ext === '.tsx' || ext === '.ts' ? 'tsx' : ext === '.jsx' ? 'jsx' : 'js') : 'js');
        const contents = files[args.path];
        if (contents === undefined) return { errors: [{ text: `missing file ${args.path}` }] };
        return { contents, loader, resolveDir: dirOf(args.path) };
      });
    },
  };

  let result;
  try {
    result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      outdir: 'nxs-out',           // names the emitted JS/CSS pair; nothing is written to disk
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      jsx: 'automatic',
      loader: { '.js': 'jsx' },          // tolerate JSX authored in .js files
      define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
      external: [...externals],
      plugins: [virtualFs],
      logLevel: 'silent',
      minify: false,
      sourcemap: false,
    });
  } catch (e) {
    const errors = (e.errors || []).map((err) => `${err.location?.file || ''}${err.location?.line ? ':' + err.location.line : ''} ${err.text}`).join('\n');
    throw new Error(errors || e.message);
  }

  let js = '';
  let css = '';
  for (const out of result.outputFiles || []) {
    if (out.path.endsWith('.css')) css += out.text;
    else js += out.text;
  }
  if (result.warnings?.length) warnings.push(...result.warnings.map((w) => w.text));

  const imports = {};
  for (const spec of externals) {
    if (spec === 'react') imports.react = `${BASE}/studio/vendor/react.js`;
    else if (spec === 'react-dom') imports['react-dom'] = `${BASE}/studio/vendor/react-dom.js`;
    else if (spec === 'react-dom/client') imports['react-dom/client'] = `${BASE}/studio/vendor/react-dom-client.js`;
    else if (spec === 'react/jsx-runtime') imports['react/jsx-runtime'] = `${BASE}/studio/vendor/jsx-runtime.js`;
    else if (spec === 'react/jsx-dev-runtime') imports['react/jsx-dev-runtime'] = `${BASE}/studio/vendor/jsx-runtime.js`;
    else if (/^[a-z@]/i.test(spec) && !spec.startsWith('/')) {
      imports[spec] = `https://esm.sh/${spec}?external=react,react-dom`;
    }
  }
  // global stylesheets in the project (not imported by JS) still apply
  const extraCss = Object.keys(files)
    .filter((p) => p.endsWith('.css') && !importedCss.has(p))
    .slice(0, 6)
    .map((p) => `/* ${p} */\n${files[p]}`)
    .join('\n');
  const titleTag = (files['index.html'] || '').match(/<title>([^<]*)<\/title>/i)?.[1] || title;
  return {
    html: htmlShell({ title: titleTag, css: css + '\n' + extraCss, js, imports }),
    kind: 'bundle',
    entry,
    warnings,
  };
}

/** Compile any project to one preview document. */
export async function buildPreview(files, { title = 'Preview', esbuild = null } = {}) {
  const kind = previewKind(files);
  if (kind === 'empty') {
    return { html: htmlShell({ title: 'Preview', css: 'body{background:#0b0d12;color:#8b93a5;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0}div{text-align:center;padding:24px}', js: '', imports: {}, bodyClass: '' }).replace('<div id="root"></div>', '<div><h3>No files yet</h3><p style="font-size:13px">Describe your app in the chat and NEXORA will write it.</p></div>'), kind };
  }
  if (kind === 'server') {
    throw new Error('This project is a server app (Next.js). Start the dev server to preview it, or deploy it.');
  }
  if (kind === 'bundle') return { ...(await bundleProject(files, { title, esbuild })), kind };
  const composed = composeStatic(files);
  return { html: composed.html, kind: 'static', warnings: composed.warnings };
}

/* ------------------------------ tiny zip --------------------------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Build a valid (stored) ZIP of the project files for export. */
export function zipFiles(files) {
  const enc = new TextEncoder();
  const entries = [];
  let offset = 0;
  const chunks = [];
  for (const [path, content] of Object.entries(files)) {
    const name = enc.encode(path);
    const data = enc.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30);
    chunks.push(local, data);
    entries.push({ name, crc, size: data.length, offset });
    offset += local.length + data.length;
  }
  const central = [];
  let centralSize = 0;
  for (const e of entries) {
    const buf = new Uint8Array(46 + e.name.length);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.size, true);
    dv.setUint32(24, e.size, true);
    dv.setUint16(28, e.name.length, true);
    dv.setUint32(42, e.offset, true);
    buf.set(e.name, 46);
    central.push(buf);
    centralSize += buf.length;
  }
  const end = new Uint8Array(22);
  const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}
