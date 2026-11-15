/* ============================================================================
   NEXORA Studio — project file helpers
   Pure functions shared by the agent, the REST layer and the tests.
   ============================================================================ */

const MAX_FILES = 400;
const MAX_FILE_BYTES = 400_000;
const MAX_TOTAL_BYTES = 3_000_000;

/** A safe, portable relative path or null. */
export function normalizePath(raw) {
  if (typeof raw !== 'string') return null;
  let p = raw.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  if (!p || p.length > 200) return null;
  if (p.includes('\u0000')) return null;
  const parts = p.split('/');
  if (parts.some((seg) => !seg || seg === '.' || seg === '..')) return null;
  if (!/^[\w@.\-+/ ]+$/.test(p)) return null;
  if (p.startsWith('node_modules/')) return null;
  return p;
}

/** Keep only real, safe text files within size limits. */
export function sanitizeFiles(input, limits = {}) {
  const maxFiles = limits.maxFiles || MAX_FILES;
  const maxFile = limits.maxFileBytes || MAX_FILE_BYTES;
  const maxTotal = limits.maxTotalBytes || MAX_TOTAL_BYTES;
  const out = {};
  let total = 0;
  let count = 0;
  for (const [rawPath, rawValue] of Object.entries(input || {})) {
    if (count >= maxFiles) break;
    const path = normalizePath(rawPath);
    if (!path) continue;
    if (typeof rawValue !== 'string') continue;
    if (rawValue.length > maxFile) continue;
    if (total + rawValue.length > maxTotal) break;
    out[path] = rawValue;
    total += rawValue.length;
    count += 1;
  }
  return out;
}

const STACKS = [
  { id: 'next', test: (f) => /next\.config\.(js|mjs|ts)$/.test(Object.keys(f).join('\n')) || has(f, 'app/page.tsx') || has(f, 'app/page.jsx') || has(f, 'pages/index.jsx') },
  { id: 'vite-react', test: (f) => /\.(jsx|tsx)$/.test(Object.keys(f).join('\n')) || (hasDep(f, 'react') && Object.keys(f).some((p) => p.startsWith('src/'))) },
  { id: 'node', test: (f) => has(f, 'server.js') || has(f, 'server.mjs') || has(f, 'index.js') && hasDep(f, 'express') },
  { id: 'static', test: () => true },
];

function has(files, p) { return Object.prototype.hasOwnProperty.call(files, p); }
function hasDep(files, dep) {
  try {
    const pkg = JSON.parse(files['package.json'] || '{}');
    return Boolean(pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]);
  } catch { return false; }
}

/** Best-effort classification used to pick the preview and run strategy. */
export function detectStack(files) {
  const keys = Object.keys(files || {});
  if (!keys.length) return 'static';
  if (keys.some((p) => /^next\.config\./.test(p)) || keys.some((p) => /^app\/(page|layout)\.(jsx|tsx|js|ts)$/.test(p))) return 'next';
  if (keys.some((p) => /\.(jsx|tsx)$/.test(p)) || hasDep(files, 'react')) return 'vite-react';
  if (keys.some((p) => /^(server|api|index)\.(m?js|ts)$/.test(p)) && hasDep(files, 'express')) return 'node';
  return 'static';
}

export function guessEntry(files, stack = detectStack(files)) {
  const keys = Object.keys(files || {});
  if (stack === 'next') return 'app/page.tsx' in files ? 'app/page.tsx' : (keys.find((p) => p.startsWith('app/')) || keys[0] || '');
  if (stack === 'vite-react') return 'src/App.jsx' in files ? 'src/App.jsx' : (keys.find((p) => p.endsWith('.jsx')) || 'index.html');
  if (stack === 'node') return 'server.js' in files ? 'server.js' : (keys.find((p) => /^(server|index)\./.test(p)) || 'server.js');
  return 'index.html' in files ? 'index.html' : (keys[0] || '');
}

/** Apply write/delete operations produced by the agent (or the editor). */
export function applyOps(files, ops = []) {
  const next = { ...files };
  const changedByPath = new Map();
  for (const op of ops) {
    const path = normalizePath(op?.path);
    if (!path) continue;
    if (op.op === 'delete') {
      if (path in next) {
        delete next[path];
        changedByPath.set(path, { path, op: 'delete' });
      }
      continue;
    }
    if (typeof op.content !== 'string') continue;
    if (op.append) {
      const joined = appendPart(next[path] || '', op.content);
      if (joined === next[path]) continue;
      next[path] = joined;
      changedByPath.set(path, { path, op: 'append' });
      continue;
    }
    if (next[path] === op.content) continue;
    next[path] = op.content;
    changedByPath.set(path, { path, op: 'write' });
  }
  return { files: next, changed: [...changedByPath.values()] };
}

/* ------------------------------- images ---------------------------------- */
export const IMAGE_LIMITS = { maxCount: 3, maxBytes: 1_400_000, mimes: ['image/jpeg', 'image/png', 'image/webp'] };

/**
 * Screenshots and photos the user attaches are sent to a vision model as base64
 * data. Nothing else is accepted: no remote URLs (the server would fetch an
 * unknown host) and no SVG (it can carry script).
 */
export function sanitizeImages(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const mime = String(raw.mime || '').toLowerCase().trim();
    const data = String(raw.data || '').replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
    if (!IMAGE_LIMITS.mimes.includes(mime)) continue;
    if (!data || data.length > IMAGE_LIMITS.maxBytes) continue;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) continue;
    out.push({ mime, data, name: String(raw.name || '').slice(0, 120) || null });
    if (out.length >= IMAGE_LIMITS.maxCount) break;
  }
  return out;
}

/**
 * Long-form text arrives in sections; sections must not be glued onto the last
 * line of the previous one, so a blank line is inserted when needed.
 */
export function appendPart(previous, next) {
  const prev = typeof previous === 'string' ? previous : '';
  const add = typeof next === 'string' ? next : '';
  if (!add) return prev;
  if (!prev) return add;
  if (/\n\s*$/.test(prev)) return prev + add;
  return prev + '\n\n' + add;
}

/** A compact directory view for prompts (dirs first, indented). */
export function renderTree(files, limit = 120) {
  const paths = Object.keys(files || {}).sort();
  const lines = paths.slice(0, limit).map((p) => `- ${p} (${files[p].split('\n').length} lines, ${Math.ceil(files[p].length / 1024)}kb)`);
  if (paths.length > limit) lines.push(`… +${paths.length - limit} more files`);
  return lines.join('\n');
}

/**
 * Choose which file bodies fit in the model context.
 * `prefer` paths are always included first (the selected file, entry points).
 */
export function pickContext(files, { maxChars = 60_000, prefer = [] } = {}) {
  const entries = Object.entries(files || {});
  const priority = (path) => {
    const i = prefer.indexOf(path);
    if (i >= 0) return -100 + i;
    if (/package\.json$/.test(path)) return -50;
    if (/^(index\.html|src\/main\.|src\/App\.|app\/page\.)/.test(path)) return -40;
    if (/\.(md|lock|svg|png|jpg)$/.test(path)) return 50;
    return 0;
  };
  const sorted = entries.sort((a, b) => priority(a[0]) - priority(b[0]));
  const chunks = [];
  let used = 0;
  let skipped = 0;
  for (const [path, content] of sorted) {
    if (used + content.length > maxChars) { skipped += 1; continue; }
    chunks.push(`### FILE: ${path}\n\`\`\`\n${content}\n\`\`\`\n`);
    used += content.length;
  }
  return { text: chunks.join('\n'), skipped, used };
}

export function summarizeFiles(files) {
  const paths = Object.keys(files || {});
  const bytes = paths.reduce((n, p) => n + (files[p]?.length || 0), 0);
  return { count: paths.length, bytes };
}

export const FILE_LIMITS = { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES };
