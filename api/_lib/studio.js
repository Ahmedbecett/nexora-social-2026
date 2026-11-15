/* ============================================================================
   NEXORA STUDIO — real AI engine (plan · generate · edit · debug)

   Every function here calls the live provider chain (Gemini / OpenAI / OpenRouter
   / keyless providers) through the `chat` function injected by handlers.js.
   There are NO hardcoded project templates and NO deterministic "smart" fallbacks:
   if the models cannot be reached the caller gets a real error, never invented code.
   ============================================================================ */

const MAX_FILE_BYTES = 120_000;          // one file
const MAX_TOTAL_BYTES = 520_000;         // whole project payload
const MAX_FILES = 40;

/* ------------------------------- JSON parsing ------------------------------ */

/** Model answers sometimes arrive fenced or wrapped in prose — recover the object. */
export function parseJsonLoose(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fence) candidates.push(fence[1]);
  candidates.push(raw);
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1));
  for (const c of candidates) {
    const s = String(c).trim();
    if (!s) continue;
    try { return JSON.parse(s); } catch { /* next candidate */ }
    // tolerate trailing commas, a very common model slip
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { /* next */ }
  }
  return null;
}

/* ------------------------------ file sanitising ---------------------------- */

const BAD_PATH = /(^|\/)\.\.(\/|$)|^\/|\\|\u0000|^node_modules\//;

export function sanitiseFiles(input, { framework = 'static' } = {}) {
  const out = {};
  let total = 0;
  if (!input || typeof input !== 'object') return out;
  const entries = Object.entries(input).slice(0, MAX_FILES);
  for (const [rawPath, rawBody] of entries) {
    const path = String(rawPath || '').trim().replace(/^\.\//, '');
    if (!path || path.length > 160 || BAD_PATH.test(path)) continue;
    if (typeof rawBody !== 'string') continue;
    if (rawBody.length > MAX_FILE_BYTES) continue;
    if (total + rawBody.length > MAX_TOTAL_BYTES) break;
    out[path] = rawBody;
    total += rawBody.length;
  }
  return out;
}

/** The generated project must be runnable: a static page needs an html entry,
    a node project needs package.json, etc. Returns a list of missing pieces. */
export function missingPieces(files, framework = 'static') {
  const names = Object.keys(files || {});
  const missing = [];
  if (!names.length) return ['no_files'];
  if (framework === 'static' || framework === 'vite' || framework === 'next') {
    const hasHtml = names.some((n) => /index\.html$/.test(n));
    const hasApp = names.some((n) => /(^|\/)(page\.(jsx?|tsx?)|App\.(jsx?|tsx?))$/.test(n));
    if (!hasHtml && !hasApp) missing.push('entry');
  }
  if (['vite', 'next', 'api', 'node'].includes(framework) && !names.includes('package.json')) missing.push('package.json');
  return missing;
}

/* ------------------------------ prompt helpers ----------------------------- */

const LANG_LINE = (lang) => (lang === 'en'
  ? 'Write every human-visible string in English.'
  : 'اكتب كل النصوص الظاهرة للمستخدم بالعربية الفصحى المبسّطة، مع إبقاء الكود والمصطلحات التقنية بالإنجليزية.');

const PLAN_INSTRUCTIONS = (lang) => `You are NEXORA Studio, an autonomous software architect.
Return ONLY one JSON object — no prose, no markdown fences — with this exact shape:
{"title":string,"description":string,"framework":"static"|"vite"|"next"|"api","features":string[3-6],"fileStructure":string[],"steps":string[4-7]}
Rules:
- "title": short product name (max 8 words), no marketing fluff.
- "description": 1-2 sentences describing what will be built.
- "framework": pick the smallest stack that satisfies the request. "static" for pages/landing/simple sites, "vite" for React SPAs, "next" for multi-route React apps with data, "api" for backend-only.
- "fileStructure": real relative paths that the build step will create.
- "steps": concrete engineering steps (analysis, scaffolding, build, test, fix, deploy).
- ${LANG_LINE(lang)}
- Never claim something was executed or deployed.`;

const GENERATE_INSTRUCTIONS = (lang) => `You are NEXORA Studio, an autonomous full-stack code generator.
Return ONLY one JSON object — no prose, no markdown fences — with this shape:
{"files":{ "<relative/path>": "<complete file content>" },"summary":"<one short sentence>"}
Rules:
- Produce a COMPLETE, RUNNABLE project. Never leave TODO placeholders, never reference files you do not include.
- Relative POSIX paths only. No absolute paths, no "..", no node_modules.
- static: index.html + styles.css + app.js (inline CSS/JS is allowed for tiny pages).
- vite: package.json (scripts dev/build/test), index.html, src/main.jsx, src/App.jsx, src/styles.css, vite.config.js.
- next: package.json, app/layout.jsx, app/page.jsx (+ extra routes when asked), next.config.js.
- api: package.json (scripts start/dev/test), server.js (Express, /api/health), README.md.
- Real, working code. If the request mentions products/items, use clearly illustrative demo data and say so in the UI text.
- Every user-visible string follows the language rule. Code stays LTR.
- ${LANG_LINE(lang)}
- Never invent execution output, test results, or deployment URLs.`;

const EDIT_INSTRUCTIONS = (lang) => `You are NEXORA Studio editing an EXISTING project.
You receive the current files and one change request. Return ONLY JSON:
{"files":{ "<path>": "<complete new content>" },"summary":"<what changed, one sentence>"}
Rules:
- Return ONLY the files you changed or added. Each returned file is the FULL new content.
- Keep every other file untouched and keep the project runnable.
- Never drop features that already worked. Never output the whole project if one file changed.
- Paths must match the current project exactly (same case, same folders).
- ${LANG_LINE(lang)}
- Never claim tests ran or that the app was deployed.`;

const DEBUG_INSTRUCTIONS = (lang) => `You are NEXORA Studio debugging a failed build/test run.
Return ONLY JSON:
{"diagnosis":"<root cause in 1-2 sentences>","fixes":{ "<path>": "<complete corrected content>" },"rerun":"<command to run again>"}
Rules:
- Read the logs carefully; diagnose the real cause, do not guess.
- Return full corrected file contents for the files you touch, and only those.
- If the logs show no actionable error, return "fixes":{} and say so honestly.
- ${LANG_LINE(lang)}`;

/* -------------------------------- engine ---------------------------------- */

export function createStudioEngine({ chat, log = () => {} }) {
  async function askJson({ instructions, message, history = [], repairHint = '' }) {
    const prompt = repairHint
      ? `${message}\n\nYour previous answer was not valid JSON (${repairHint}). Reply again with ONLY the JSON object.`
      : message;
    const r = await chat({ message: prompt, instructions, history });
    const data = parseJsonLoose(r?.answer);
    if (data) return { data, provider: r.provider, model: r.model };
    // one repair attempt — the provider chain is still warm, and a bad fenced answer is common
    log('studio:json-retry');
    const again = await chat({
      message: message + '\n\nIMPORTANT: your previous reply could not be parsed as JSON. '
        + 'Return ONLY the JSON object, with no prose and no code fences.',
      instructions,
      history,
    });
    const second = parseJsonLoose(again?.answer);
    if (!second) throw Object.assign(new Error('model did not return parseable JSON'), { code: 'ai_invalid_json' });
    return { data: second, provider: again.provider, model: again.model };
  }

  /* ---------------------------------- plan --------------------------------- */
  async function plan({ prompt, framework = '', lang = 'ar' }) {
    const message = `Project idea:\n"""${String(prompt).slice(0, 4000)}"""\n`
      + (framework ? `Preferred framework: ${framework}\n` : '')
      + 'Produce the plan JSON now.';
    const { data, provider, model } = await askJson({ instructions: PLAN_INSTRUCTIONS(lang), message });
    const fw = ['static', 'vite', 'next', 'api'].includes(data?.framework) ? data.framework : (framework || 'static');
    const features = Array.isArray(data?.features) ? data.features.filter((f) => typeof f === 'string').slice(0, 6) : [];
    const steps = Array.isArray(data?.steps) ? data.steps.filter((s) => typeof s === 'string').slice(0, 7) : [];
    const fileStructure = Array.isArray(data?.fileStructure)
      ? data.fileStructure.filter((f) => typeof f === 'string' && f.length < 160).slice(0, 30)
      : [];
    return {
      plan: {
        title: String(data?.title || '').trim().slice(0, 90) || String(prompt).trim().slice(0, 60),
        description: String(data?.description || '').trim().slice(0, 400),
        framework: fw,
        features,
        fileStructure,
        steps,
        prompt: String(prompt).slice(0, 4000),
      },
      provider, model,
    };
  }

  /* -------------------------------- generate -------------------------------- */
  async function generate({ prompt = '', plan = null, framework = '', files = null, instruction = '', lang = 'ar' }) {
    const editing = files && Object.keys(files).length > 0 && (instruction || prompt);
    const fw = plan?.framework || framework || 'static';
    const name = plan?.title || '';
    let message;
    let instructions;
    if (editing) {
      instructions = EDIT_INSTRUCTIONS(lang);
      message = `Current project files (JSON map of path -> content):\n`
        + '```json\n' + JSON.stringify(files).slice(0, 90_000) + '\n```\n\n'
        + `Change request:\n"""${String(instruction || prompt).slice(0, 3000)}"""\n\nReturn only the changed files as JSON.`;
    } else {
      instructions = GENERATE_INSTRUCTIONS(lang);
      message = `Build this project.\n\n`
        + `Title: ${name || '(derive from the request)'}\n`
        + `Framework: ${fw}\n`
        + (plan?.description ? `Description: ${plan.description}\n` : '')
        + (Array.isArray(plan?.features) && plan.features.length ? `Features:\n- ${plan.features.join('\n- ')}\n` : '')
        + (Array.isArray(plan?.fileStructure) && plan.fileStructure.length ? `Planned files: ${plan.fileStructure.join(', ')}\n` : '')
        + `\nUser request:\n"""${String(prompt).slice(0, 4000)}"""\n\nReturn the files JSON now.`;
    }
    const { data, provider, model } = await askJson({ instructions, message });

    const rawFiles = data?.files && typeof data.files === 'object' ? data.files : null;
    if (!rawFiles) throw Object.assign(new Error('model returned no files'), { code: 'ai_no_files' });
    const clean = sanitiseFiles(rawFiles, { framework: fw });
    if (!Object.keys(clean).length) throw Object.assign(new Error('model returned unusable files'), { code: 'ai_no_files' });
    if (!editing) {
      const missing = missingPieces(clean, fw);
      if (missing.length) throw Object.assign(new Error('generated project is incomplete: ' + missing.join(',')), { code: 'ai_incomplete', detail: missing.join(',') });
    }
    return {
      files: clean,
      // edits are merged by the caller so a partial answer cannot wipe the project
      mode: editing ? 'edit' : 'create',
      framework: fw,
      summary: String(data?.summary || '').trim().slice(0, 300),
      provider, model,
    };
  }

  /* --------------------------------- debug --------------------------------- */
  async function debug({ files = {}, logs = '', command = '', lang = 'ar' }) {
    const message = `Command that failed: ${command || '(unknown)'}\n\n`
      + `Logs:\n"""\n${String(logs).slice(0, 12000)}\n"""\n\n`
      + `Project files (path -> content):\n\`\`\`json\n${JSON.stringify(files).slice(0, 70_000)}\n\`\`\`\n\nDiagnose and return the JSON now.`;
    const { data, provider, model } = await askJson({ instructions: DEBUG_INSTRUCTIONS(lang), message });
    const fixes = sanitiseFiles(data?.fixes && typeof data.fixes === 'object' ? data.fixes : {}, {});
    return {
      diagnosis: String(data?.diagnosis || '').trim().slice(0, 600),
      fixes,
      rerun: typeof data?.rerun === 'string' ? data.rerun.slice(0, 200) : '',
      provider, model,
    };
  }

  return { plan, generate, debug };
}

/* ------------------------------- diff helper ------------------------------- */

/** Human summary of what an edit changed — used for snapshots and the chat log. */
export function diffSummary(before = {}, after = {}) {
  const added = [];
  const changed = [];
  const removed = [];
  for (const [k, v] of Object.entries(after)) {
    if (!(k in before)) added.push(k);
    else if (before[k] !== v) changed.push(k);
  }
  for (const k of Object.keys(before)) if (!(k in after)) removed.push(k);
  return { added, changed, removed };
}
