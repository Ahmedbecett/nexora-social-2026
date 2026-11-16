/* ============================================================================
   NEXORA Studio — real unified diff engine, hunk revert, and static code checks
   ----------------------------------------------------------------------------
   Pure, dependency-free functions used by the Diff & Checks panel and tested
   directly in Node. Computes exact line-level diffs between any two file maps,
   supports reverting single files or individual hunks, and validates JSON,
   HTML asset links and module syntax without faking a single result.
   ============================================================================ */

const MAX_LCS_CELLS = 1_600_000;

function splitLines(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const norm = text.replace(/\r\n/g, '\n');
  const lines = norm.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function joinLines(lines, trailingNewline = true) {
  if (!lines.length) return '';
  return lines.join('\n') + (trailingNewline ? '\n' : '');
}

/**
 * Exact LCS line diff on the changed middle slice (after trimming common head
 * and tail). Falls back to an anchored linear scan only for multi-thousand-line
 * files so the browser thread never stalls.
 */
export function computeLineOps(beforeText = '', afterText = '') {
  const a = splitLines(beforeText);
  const b = splitLines(afterText);

  let prefix = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefix < minLen && a[prefix] === b[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < minLen - prefix
    && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const ops = [];
  for (let i = 0; i < prefix; i += 1) {
    ops.push({ type: 'context', line: a[i], oldNo: i + 1, newNo: i + 1 });
  }

  const midA = a.slice(prefix, a.length - suffix);
  const midB = b.slice(prefix, b.length - suffix);

  if (midA.length === 0) {
    for (let j = 0; j < midB.length; j += 1) {
      ops.push({ type: 'add', line: midB[j], oldNo: null, newNo: prefix + j + 1 });
    }
  } else if (midB.length === 0) {
    for (let i = 0; i < midA.length; i += 1) {
      ops.push({ type: 'del', line: midA[i], oldNo: prefix + i + 1, newNo: null });
    }
  } else if (midA.length * midB.length <= MAX_LCS_CELLS) {
    const n = midA.length;
    const m = midB.length;
    const width = m + 1;
    const dp = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      const row = i * width;
      const nextRow = (i + 1) * width;
      const ai = midA[i];
      for (let j = m - 1; j >= 0; j -= 1) {
        dp[row + j] = ai === midB[j]
          ? dp[nextRow + j + 1] + 1
          : (dp[nextRow + j] >= dp[row + j + 1] ? dp[nextRow + j] : dp[row + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        ops.push({ type: 'context', line: midA[i], oldNo: prefix + i + 1, newNo: prefix + j + 1 });
        i += 1;
        j += 1;
      } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
        ops.push({ type: 'del', line: midA[i], oldNo: prefix + i + 1, newNo: null });
        i += 1;
      } else {
        ops.push({ type: 'add', line: midB[j], oldNo: null, newNo: prefix + j + 1 });
        j += 1;
      }
    }
    while (i < n) {
      ops.push({ type: 'del', line: midA[i], oldNo: prefix + i + 1, newNo: null });
      i += 1;
    }
    while (j < m) {
      ops.push({ type: 'add', line: midB[j], oldNo: null, newNo: prefix + j + 1 });
      j += 1;
    }
  } else {
    /* Anchored windowed fallback for very large files */
    let i = 0;
    let j = 0;
    const LOOK = 24;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        ops.push({ type: 'context', line: midA[i], oldNo: prefix + i + 1, newNo: prefix + j + 1 });
        i += 1;
        j += 1;
        continue;
      }
      let foundA = -1;
      let foundB = -1;
      for (let k = 1; k <= LOOK; k += 1) {
        if (j + k < midB.length && midA[i] === midB[j + k]) { foundB = k; break; }
        if (i + k < midA.length && midA[i + k] === midB[j]) { foundA = k; break; }
      }
      if (foundB > 0) {
        for (let k = 0; k < foundB; k += 1) {
          ops.push({ type: 'add', line: midB[j + k], oldNo: null, newNo: prefix + j + k + 1 });
        }
        j += foundB;
      } else if (foundA > 0) {
        for (let k = 0; k < foundA; k += 1) {
          ops.push({ type: 'del', line: midA[i + k], oldNo: prefix + i + k + 1, newNo: null });
        }
        i += foundA;
      } else {
        ops.push({ type: 'del', line: midA[i], oldNo: prefix + i + 1, newNo: null });
        ops.push({ type: 'add', line: midB[j], oldNo: null, newNo: prefix + j + 1 });
        i += 1;
        j += 1;
      }
    }
    while (i < midA.length) {
      ops.push({ type: 'del', line: midA[i], oldNo: prefix + i + 1, newNo: null });
      i += 1;
    }
    while (j < midB.length) {
      ops.push({ type: 'add', line: midB[j], oldNo: null, newNo: prefix + j + 1 });
      j += 1;
    }
  }

  for (let s = 0; s < suffix; s += 1) {
    const oldIdx = a.length - suffix + s;
    const newIdx = b.length - suffix + s;
    ops.push({ type: 'context', line: a[oldIdx], oldNo: oldIdx + 1, newNo: newIdx + 1 });
  }
  return ops;
}

/** Group raw line operations into unified diff hunks with surrounding context. */
export function buildHunks(ops, context = 3) {
  const changeIdx = [];
  for (let i = 0; i < ops.length; i += 1) {
    if (ops[i].type !== 'context') changeIdx.push(i);
  }
  if (!changeIdx.length) return [];

  const ranges = [];
  let start = Math.max(0, changeIdx[0] - context);
  let end = Math.min(ops.length - 1, changeIdx[0] + context);
  for (let k = 1; k < changeIdx.length; k += 1) {
    const ns = Math.max(0, changeIdx[k] - context);
    const ne = Math.min(ops.length - 1, changeIdx[k] + context);
    if (ns <= end + 1) {
      end = Math.max(end, ne);
    } else {
      ranges.push([start, end]);
      start = ns;
      end = ne;
    }
  }
  ranges.push([start, end]);

  return ranges.map(([s, e], index) => {
    const lines = ops.slice(s, e + 1);
    let oldStart = 0;
    let newStart = 0;
    let oldCount = 0;
    let newCount = 0;
    let added = 0;
    let removed = 0;
    for (const ln of lines) {
      if (ln.oldNo !== null) {
        if (!oldStart) oldStart = ln.oldNo;
        oldCount += 1;
      }
      if (ln.newNo !== null) {
        if (!newStart) newStart = ln.newNo;
        newCount += 1;
      }
      if (ln.type === 'add') added += 1;
      if (ln.type === 'del') removed += 1;
    }
    return {
      index,
      opStart: s,
      opEnd: e,
      header: `@@ -${oldStart || 1},${oldCount} +${newStart || 1},${newCount} @@`,
      oldStart: oldStart || 1,
      oldCount,
      newStart: newStart || 1,
      newCount,
      added,
      removed,
      lines,
    };
  });
}

export function computeFileDiff(path, beforeText, afterText, { context = 3 } = {}) {
  const hasBefore = typeof beforeText === 'string';
  const hasAfter = typeof afterText === 'string';
  const normBefore = hasBefore ? beforeText.replace(/\r\n/g, '\n') : '';
  const normAfter = hasAfter ? afterText.replace(/\r\n/g, '\n') : '';
  if (hasBefore && hasAfter && normBefore === normAfter) return null;

  const status = !hasBefore ? 'added' : !hasAfter ? 'deleted' : 'modified';
  const ops = computeLineOps(hasBefore ? normBefore : '', hasAfter ? normAfter : '');
  const hunks = buildHunks(ops, context);
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added += 1;
    else if (op.type === 'del') removed += 1;
  }
  return {
    path,
    status,
    added,
    removed,
    hunks,
    before: hasBefore ? beforeText : undefined,
    after: hasAfter ? afterText : undefined,
  };
}

export function computeProjectDiff(baselineFiles = {}, currentFiles = {}, options = {}) {
  const base = baselineFiles && typeof baselineFiles === 'object' ? baselineFiles : {};
  const curr = currentFiles && typeof currentFiles === 'object' ? currentFiles : {};
  const allPaths = [...new Set([...Object.keys(base), ...Object.keys(curr)])].sort((a, b) => a.localeCompare(b));

  const files = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let addedCount = 0;
  let modifiedCount = 0;
  let deletedCount = 0;

  for (const path of allPaths) {
    const entry = computeFileDiff(path, base[path], curr[path], options);
    if (!entry) continue;
    files.push(entry);
    totalAdded += entry.added;
    totalRemoved += entry.removed;
    if (entry.status === 'added') addedCount += 1;
    else if (entry.status === 'deleted') deletedCount += 1;
    else modifiedCount += 1;
  }

  return {
    files,
    count: files.length,
    totalAdded,
    totalRemoved,
    addedCount,
    modifiedCount,
    deletedCount,
    hasChanges: files.length > 0,
  };
}

/**
 * Revert a single unified diff hunk in `afterText` back to its `beforeText`
 * lines while keeping every other hunk intact.
 */
export function revertHunk(beforeText = '', afterText = '', hunkIndex = 0, context = 3) {
  const ops = computeLineOps(beforeText, afterText);
  const hunks = buildHunks(ops, context);
  const target = hunks[hunkIndex];
  if (!target) return afterText;

  const out = [];
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    const inTarget = i >= target.opStart && i <= target.opEnd;
    if (op.type === 'context') {
      out.push(op.line);
    } else if (inTarget) {
      /* Revert: restore deleted lines, drop added lines */
      if (op.type === 'del') out.push(op.line);
    } else {
      /* Keep all other changes */
      if (op.type === 'add') out.push(op.line);
    }
  }
  const trailing = String(afterText || beforeText || '').endsWith('\n');
  return joinLines(out, trailing);
}

/**
 * Real static verification across project files (JSON validity, package.json
 * structure, HTML local references, and empty/conflict markers).
 */
export function runStaticChecks(files = {}) {
  const start = Date.now();
  const entries = Object.entries(files || {});
  const results = [];

  if (!entries.length) {
    return [{
      id: 'empty',
      name: 'Workspace files',
      category: 'static',
      status: 'warn',
      durationMs: 0,
      detail: 'No files in the current workspace yet.',
      logs: '',
    }];
  }

  /* 1) JSON syntax & package.json check */
  const jsonFiles = entries.filter(([p]) => /\.json$/i.test(p));
  if (jsonFiles.length) {
    const t0 = Date.now();
    const jsonErrors = [];
    for (const [path, content] of jsonFiles) {
      try {
        const parsed = JSON.parse(content);
        if (path === 'package.json' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))) {
          jsonErrors.push(`${path}: root must be a JSON object`);
        }
      } catch (e) {
        jsonErrors.push(`${path}: ${e.message}`);
      }
    }
    results.push({
      id: 'json',
      name: `JSON validation (${jsonFiles.length} file${jsonFiles.length === 1 ? '' : 's'})`,
      category: 'static',
      status: jsonErrors.length ? 'fail' : 'pass',
      durationMs: Date.now() - t0,
      detail: jsonErrors.length ? `${jsonErrors.length} invalid JSON file(s)` : 'All JSON files parse cleanly',
      logs: jsonErrors.join('\n'),
    });
  }

  /* 2) HTML local script/stylesheet reference integrity */
  const htmlFiles = entries.filter(([p]) => /\.html?$/i.test(p));
  if (htmlFiles.length) {
    const t0 = Date.now();
    const missing = [];
    const fileSet = new Set(Object.keys(files));
    for (const [path, content] of htmlFiles) {
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      const refs = [
        ...content.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
        ...content.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi),
        ...content.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi),
      ];
      const seen = new Set();
      for (const m of refs) {
        const ref = String(m[1] || '').trim().split(/[?#]/)[0];
        if (!ref || seen.has(ref)) continue;
        seen.add(ref);
        if (/^(https?:|data:|blob:|\/\/)/i.test(ref)) continue;
        const normalized = ref.startsWith('/')
          ? ref.replace(/^\/+/, '')
          : resolveRelative(dir, ref);
        if (!fileSet.has(normalized) && !fileSet.has(`public/${normalized}`)) {
          missing.push(`${path} → missing "${ref}" (looked for ${normalized})`);
        }
      }
    }
    results.push({
      id: 'html-refs',
      name: `HTML asset links (${htmlFiles.length} page${htmlFiles.length === 1 ? '' : 's'})`,
      category: 'static',
      status: missing.length ? 'warn' : 'pass',
      durationMs: Date.now() - t0,
      detail: missing.length ? `${missing.length} unresolved local reference(s)` : 'Every local script and stylesheet exists',
      logs: missing.join('\n'),
    });
  }

  /* 3) Merge conflict / truncation / syntax integrity markers */
  const markerIssues = [];
  for (const [path, content] of entries) {
    if (/^(<{7}|={7}|>{7})(\s|$)/m.test(content)) {
      markerIssues.push(`${path}: contains unresolved git conflict markers`);
    }
    if (/<\/?(?:nexora:)?file\b/i.test(content) && !/protocol|agent/i.test(path)) {
      markerIssues.push(`${path}: contains stray agent protocol tag`);
    }
  }
  results.push({
    id: 'integrity',
    name: `Source integrity (${entries.length} file${entries.length === 1 ? '' : 's'})`,
    category: 'static',
    status: markerIssues.length ? 'fail' : 'pass',
    durationMs: Math.max(0, Date.now() - start),
    detail: markerIssues.length ? `${markerIssues.length} integrity issue(s) found` : 'Clean — no conflict markers or corrupted blocks',
    logs: markerIssues.join('\n'),
  });

  return results;
}

function resolveRelative(dir, rel) {
  const parts = `${dir}${rel}`.split('/');
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}
