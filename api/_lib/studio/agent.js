/* ============================================================================
   NEXORA Studio — the agent protocol
   ----------------------------------------------------------------------------
   The model answers with a small, provider-agnostic tag protocol:

     <plan>{ json }</plan>
     <file path="src/App.jsx">…full file…</file>
     <file path="article.md" append>…next section only…</file>
     <delete path="old.css"/>
     <message>one short paragraph</message>

   The same parser is used live (while tokens stream in) and after the fact, so
   the editor fills in as the model writes instead of waiting for the end.
   ============================================================================ */

import { normalizePath, renderTree, pickContext } from './files.js';

export const STUDIO_SYSTEM = `You are NEXORA Studio, an autonomous AI software engineer working inside a real IDE.
You plan, write files and run commands for the user. The user describes what they want in natural language, in any language.

OUTPUT PROTOCOL — this is a strict contract:
- Produce complete files with <file path="relative/path"> … </file>. The content is the ENTIRE file.
- Only when the task asks for long-form text may you continue an existing file with <file path="same/path" append> … </file>, which carries ONLY the next section.
- Delete a file with <delete path="relative/path"/>.
- Return the project plan only with <plan>{valid JSON}</plan>.
- End with <message>one short paragraph</message> written in Saudi-friendly Modern Standard Arabic unless the user writes in another language — then use that language.
- No markdown fences around the tags. No explanations of the protocol. Short prose between blocks is allowed but is NOT how files are delivered.

HARD RULES
- Never claim you ran, tested or deployed anything: the system runs commands and shows real logs.
- Never write diffs, "… unchanged", or partial files. Every <file> tag carries the full content.
- Never leave TODOs, placeholder functions or fake data unless the user explicitly asks for sample content.
- Prefer a zero-dependency static app (HTML/CSS/JS) unless the request needs React or a server. When you use React, emit package.json, index.html and src/main.jsx so the built-in bundler can preview it.
- The result must run immediately in the live preview with no build step.
- Production quality: responsive layout, real typography scale, accessible contrast, focus states, no console errors.
- Keep a file under ~350 lines; split modules when it grows.
- Use only packages that exist on npm. If unsure, implement it yourself.

You are precise, terse and you ship working software.`;

const planShape = `{"title":"string","summary":"string","stack":"static|vite-react|node|next","features":["string"],"files":[{"path":"string","purpose":"string"}],"steps":["string"]}`;

export function buildPlanPrompt({ project, userMessage, history = [] }) {
  const tree = Object.keys(project.files || {}).length ? renderTree(project.files, 60) : '(empty project)';
  return {
    instructions: STUDIO_SYSTEM,
    messages: [
      ...history,
      {
        role: 'user',
        content: `TASK: produce a build plan for the user's request. Do not write files yet.

Existing project: "${project.name}" (stack: ${project.stack || 'unknown'})
Existing files:
${tree}

User request:
${userMessage}

Answer with exactly one <plan> block containing this JSON shape:
${planShape}

Pick the smallest stack that satisfies the request. The "files" list must be the complete set needed for a working app. Then add a <message> with 2–4 sentences in the user's language describing what will be built.`,
      },
    ],
  };
}

export function buildCreatePrompt({ project, plan, userMessage, missing = [], existingContext = true, batch = 3, askPlan = false }) {
  const files = project.files || {};
  const ctx = existingContext && Object.keys(files).length
    ? pickContext(files, { maxChars: 24_000, prefer: [project.entry] }).text
    : '';
  /* One request never asks for the whole app: a serverless function has a hard
     time limit, and a cut-off response used to lose every file. The next round
     is requested by the client until nothing is missing. */
  const thisTurn = missing.slice(0, batch);
  const rest = missing.length - thisTurn.length;
  const missingList = thisTurn.length
    ? thisTurn.map((m) => `- ${m.path}${m.purpose ? ' — ' + m.purpose : ''}`).join('\n')
      + (rest ? `\n(${rest} more file(s) are queued for the next request — do NOT write them now)` : '')
    : '';
  return {
    instructions: STUDIO_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `TASK: ${missing.length ? 'continue generating the project' : 'create the project'} by writing complete files.

Project: "${project.name}"
Stack: ${plan?.stack || project.stack || 'static'}
Request:
${userMessage}

Plan:
${JSON.stringify(plan || {}, null, 2)}

${ctx ? `Existing files (replace only when you output them again):\n${ctx}\n` : ''}
${missingList ? `FILES TO WRITE IN THIS REQUEST — output these now, and only these:\n${missingList}\n` : 'Write the files the app still needs to run.'}

${askPlan ? 'Start this answer with one <plan>{…}</plan> block (JSON, the same shape as a build plan) so the system knows the complete file list, then write the files.\n' : ''}Rules for this turn: at most ${Math.max(1, batch)} complete files, each ONE whole file, smallest stack that works, no placeholder content. Start with the entry point (index.html) so the preview can render immediately. Stop after these files — the system asks for the rest.`,
      },
    ],
  };
}

/**
 * Long-text mode: the same markdown file grows section by section. The first
 * section replaces the file, every later section is appended, so a very long
 * document never has to fit in one response.
 */
export function buildTextPrompt({ project, userMessage, targetPath = 'document.md', part = 1, parts = 4, existing = '' }) {
  const tail = existing ? existing.slice(-2_400) : '';
  const first = part <= 1;
  const rules = [
    `Write section ${part} of ${parts} of the requested document.`,
    first
      ? `Start the document at the very beginning and end with <file path="${targetPath}">.</file>.`
      : `Continue EXACTLY where the previous section stopped — do not repeat what is already written, do not summarise it, and do not add headings that already exist.`,
    first
      ? 'Use informative markdown structure (title, sections, lists).'
      : `Answer with ONE block: <file path="${targetPath}" append> … only the new text … </file>`,
    'Write real, finished prose — no placeholders, no "continue here" notes, no meta commentary.',
  ];
  return {
    instructions: STUDIO_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `TASK: long-form writing.

Request:
${userMessage}

Target file: ${targetPath}
${tail ? `The end of what is already written:\n…${tail}\n` : '(the file does not exist yet)'}

${rules.map((r) => '- ' + r).join('\n')}

Section length: 700–1100 words. ${first ? 'The opening section must stand on its own.' : 'Pick up mid-thought if that is where the previous section ended.'}`,
      },
    ],
  };
}

export function buildEditPrompt({ project, userMessage, selectedPath = '', history = [] }) {
  const files = project.files || {};
  const prefer = [selectedPath, project.entry].filter(Boolean);
  const ctx = pickContext(files, { maxChars: 70_000, prefer }).text;
  return {
    instructions: STUDIO_SYSTEM,
    messages: [
      ...history.slice(-6),
      {
        role: 'user',
        content: `TASK: modify the existing project to satisfy the request.

Project: "${project.name}" (stack: ${project.stack})
${renderTree(files, 120)}

Current file contents:
${ctx}

Request:
${userMessage}
${selectedPath ? `\nThe user is currently looking at: ${selectedPath}` : ''}

Return the FULL content of every file you change or create, and nothing else. If no file change is needed (a question, an explanation), answer with <message> only.`,
      },
    ],
  };
}

export function buildFixPrompt({ project, logs, userMessage = '' }) {
  const files = project.files || {};
  return {
    instructions: STUDIO_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `TASK: fix the failure shown in the real command output.

Project: "${project.name}" (stack: ${project.stack})
${renderTree(files, 120)}

Files:
${pickContext(files, { maxChars: 60_000, prefer: [project.entry] }).text}

Command output (real, unedited):
\`\`\`
${String(logs || '').slice(-12_000)}
\`\`\`
${userMessage ? '\nUser note: ' + userMessage : ''}

Find the root cause and return the FULL corrected content of only the files that must change. If the failure is environmental (missing API key, network), say so in <message> and change nothing.`,
      },
    ],
  };
}

/**
 * The user's images belong to the instruction they came with, so they ride on
 * the last message of whichever prompt is being built.
 */
export function attachImages(prompt, images = []) {
  if (!Array.isArray(images) || !images.length || !prompt?.messages?.length) return prompt;
  const messages = prompt.messages.slice();
  const last = { ...messages[messages.length - 1] };
  last.images = images;
  last.content = `${last.content || ''}\n\nThe user attached ${images.length} image${images.length > 1 ? 's' : ''} — read the layout, colours and copy from ${images.length > 1 ? 'them' : 'it'} and build exactly that.`;
  messages[messages.length - 1] = last;
  return { ...prompt, messages };
}

/* ------------------------------- parsing --------------------------------- */
function stripFences(content) {
  let c = String(content || '');
  const m = c.match(/^\s*```[a-zA-Z0-9+#.-]*\n([\s\S]*?)\n?```\s*$/);
  if (m) c = m[1];
  return c.replace(/^\n+/, '').replace(/\n+$/, '\n');
}

const hasAppend = (attrs) => /(^|\s)append\b/i.test(String(attrs || ''));

function parseJsonLoose(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { /* repair below */ }
  // common repairs: trailing commas, smart quotes
  const repaired = s.slice(start, end + 1)
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u201c\u201d]/g, '"');
  try { return JSON.parse(repaired); } catch { return null; }
}

function normalizePlan(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const files = Array.isArray(obj.files)
    ? obj.files.map((f) => (typeof f === 'string' ? { path: f, purpose: '' } : { path: normalizePath(f?.path) || String(f?.path || ''), purpose: String(f?.purpose || '') })).filter((f) => f.path)
    : [];
  const stack = ['static', 'vite-react', 'node', 'next'].includes(obj.stack) ? obj.stack : 'static';
  return {
    title: String(obj.title || '').slice(0, 120),
    summary: String(obj.summary || '').slice(0, 800),
    stack,
    features: Array.isArray(obj.features) ? obj.features.map((x) => String(x).slice(0, 200)).slice(0, 12) : [],
    files: files.slice(0, 80),
    steps: Array.isArray(obj.steps) ? obj.steps.map((x) => String(x).slice(0, 200)).slice(0, 12) : [],
  };
}

/** Parse a complete model answer into plan / file operations / prose. */
export function parseAgentOutput(raw) {
  const out = { plan: null, ops: [], prose: '', message: '', truncatedFiles: [] };
  const text = String(raw || '');
  const openRe = /<(?:nexora:)?(file|delete|plan|message)\b([^>]*)>/gi;
  let last = 0;
  let m;
  while ((m = openRe.exec(text))) {
    const between = text.slice(last, m.index).trim();
    if (between) out.prose += (out.prose ? '\n' : '') + between;
    const kind = m[1].toLowerCase();
    const attrs = m[2] || '';
    const selfClosing = /\/\s*$/.test(attrs) || kind === 'delete';
    const path = normalizePath((attrs.match(/path\s*=\s*("([^"]*)"|'([^']*)')/) || [])[2] || (attrs.match(/path\s*=\s*'([^']*)'/) || [])[1]);

    if (selfClosing || kind === 'delete') {
      if (path) out.ops.push({ op: 'delete', path });
      last = openRe.lastIndex;
      continue;
    }

    const closeRe = new RegExp(`</(?:nexora:)?${kind}>`, 'i');
    const rest = text.slice(openRe.lastIndex);
    const close = closeRe.exec(rest);
    if (!close) {
      out.truncatedFiles.push(`unclosed <${kind}> block`);
      last = openRe.lastIndex;
      continue;
    }
    const body = rest.slice(0, close.index);
    last = openRe.lastIndex + close.index + close[0].length;
    openRe.lastIndex = last;

    if (kind === 'file') {
      if (path) out.ops.push({ op: 'write', path, content: stripFences(body), append: hasAppend(attrs) });
    } else if (kind === 'plan') {
      const plan = normalizePlan(parseJsonLoose(body));
      if (plan) out.plan = plan;
    } else {
      out.message = body.trim().slice(0, 4000);
    }
  }
  const tail = text.slice(last).trim();
  if (tail) out.prose += (out.prose ? '\n' : '') + tail;
  out.prose = out.prose.replace(/(?:<\/?(?:nexora:)?(?:file|delete|plan|message)\b[^>]*>)/gi, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);

  // JSON fallback for models that ignore the tag protocol
  if (!out.ops.length && !out.plan) {
    const obj = parseJsonLoose(text);
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj.files)) {
        for (const f of obj.files) {
          const path = normalizePath(f?.path);
          if (path && typeof f?.content === 'string') out.ops.push({ op: 'write', path, content: f.content });
        }
      } else if (obj.files && typeof obj.files === 'object') {
        for (const [p, c] of Object.entries(obj.files)) {
          const path = normalizePath(p);
          if (path && typeof c === 'string') out.ops.push({ op: 'write', path, content: c });
        }
      }
      if (obj.plan) out.plan = normalizePlan(obj.plan);
      else if (obj.title && obj.stack) out.plan = normalizePlan(obj);
      if (!out.message && typeof obj.message === 'string') out.message = obj.message;
    }
  }
  return out;
}

/**
 * Incremental parser for live streaming.
 * `push(accumulatedText)` is designed for providers that send the full text so
 * far; only newly completed blocks are emitted.
 */
export function createProtocolStreamer({ onProse, onFile, onDelete, onPlan, onMessage, onFilePartial } = {}) {
  let buffer = '';
  let cursor = 0;
  let proseEmitted = 0;
  /* partial-file streaming: the editor window shows the code as it is written */
  let lastPartialAt = 0;
  let lastPartialLen = 0;
  let partialPath = null;

  const emitProse = (chunk) => {
    const clean = chunk.replace(/\n{3,}/g, '\n\n');
    if (!clean.trim()) return;
    if (onProse) onProse(clean);
  };

  const findOpen = (from) => {
    const re = /<(?:nexora:)?(file|delete|plan|message)\b([^>]*)>/gi;
    re.lastIndex = from;
    const m = re.exec(buffer);
    return m ? { index: m.index, end: re.lastIndex, kind: m[1].toLowerCase(), attrs: m[2] || '' } : null;
  };

  const drain = () => {
    for (;;) {
      const open = findOpen(cursor);
      if (!open) {
        // emit safe prose (keep a tail that might be a partial tag)
        const safeEnd = Math.max(cursor, buffer.length - 80);
        const chunk = buffer.slice(cursor, safeEnd);
        if (chunk.length) { emitProse(chunk); proseEmitted += chunk.length; cursor = safeEnd; }
        return;
      }
      if (open.index > cursor) {
        const chunk = buffer.slice(cursor, open.index);
        emitProse(chunk);
        proseEmitted += chunk.length;
        cursor = open.index;
      }
      if (open.kind === 'delete' || /\/\s*$/.test(open.attrs)) {
        const m = open.attrs.match(/path\s*=\s*("([^"]*)"|'([^']*)')/);
        const path = normalizePath(m ? (m[2] || m[3]) : '');
        if (path && onDelete) onDelete(path);
        cursor = open.end;
        continue;
      }
      const closeTag = `</${buffer.slice(open.index + 1).match(/^(?:nexora:)?[a-z]+/i)?.[0] || open.kind}>`;
      const closeIdx = buffer.toLowerCase().indexOf(closeTag.toLowerCase(), open.end);
      if (closeIdx < 0) {
        /* still inside this block: stream the partial body of a <file> so the
           window can show the code being written, throttled to stay cheap */
        if (open.kind === 'file' && onFilePartial) {
          const pm = open.attrs.match(/path\s*=\s*("([^"]*)"|'([^']*)')/);
          const path = normalizePath(pm ? (pm[2] || pm[3]) : '');
          const body = buffer.slice(open.end).replace(/^\s*```[a-zA-Z0-9+#.-]*\n/, '');
          const now = Date.now();
          if (path && body.length !== lastPartialLen && (now - lastPartialAt > 180 || body.length - lastPartialLen > 2000)) {
            lastPartialAt = now;
            lastPartialLen = body.length;
            partialPath = path;
            onFilePartial({ path, partial: body });
          }
        }
        return; // wait for more tokens
      }
      if (partialPath) { lastPartialLen = 0; partialPath = null; }
      const body = buffer.slice(open.end, closeIdx);
      const end = closeIdx + closeTag.length;
      if (open.kind === 'file') {
        const m = open.attrs.match(/path\s*=\s*("([^"]*)"|'([^']*)')/);
        const path = normalizePath(m ? (m[2] || m[3]) : '');
        if (path && onFile) onFile({ path, content: stripFences(body), append: hasAppend(open.attrs) });
      } else if (open.kind === 'plan') {
        const plan = normalizePlan(parseJsonLoose(body));
        if (plan && onPlan) onPlan(plan);
      } else if (open.kind === 'message') {
        const msg = body.trim();
        if (msg && onMessage) onMessage(msg);
      }
      cursor = end;
    }
  };

  return {
    push(fullText) {
      buffer = String(fullText || '');
      drain();
    },
    flush() {
      const rest = buffer.slice(cursor).trim();
      if (rest && !rest.startsWith('<')) emitProse(rest);
      cursor = buffer.length;
      return parseAgentOutput(buffer);
    },
    get buffer() { return buffer; },
    get proseLength() { return proseEmitted; },
  };
}

/**
 * Reference material (Google Docs, sheets, text files) rides in the prompt: the
 * model has to read it as instructions for the build, not as a summary of it.
 */
export function attachDocs(prompt, docs = []) {
  const list = (Array.isArray(docs) ? docs : []).filter((d) => d && typeof d.text === 'string' && d.text.trim());
  if (!list.length) return prompt;
  const body = list
    .map((d) => `--- ${String(d.name || 'Reference document').slice(0, 160)} ---\n${d.text}`)
    .join('\n\n');
  const block = `\n\nReference material the user attached (read it, and follow it as the source of truth for content, copy and structure):\n\n${body}`;

  /* a built prompt is { instructions, messages }: the material belongs in the
     last user message, exactly like an attached image */
  if (prompt && Array.isArray(prompt.messages) && prompt.messages.length) {
    const messages = prompt.messages.slice();
    const last = { ...messages[messages.length - 1] };
    last.content = `${last.content || ''}${block}`;
    messages[messages.length - 1] = last;
    return { ...prompt, messages };
  }
  return `${prompt}${block}`;
}
