/* ============================================================================
   NEXORA Studio — REST + streaming routes
   ============================================================================ */

import {
  StudioError, studioHealth, studioDriver, nowIso,
} from './db.js';
import {
  listProjects, createProject, getProject, updateProject, deleteProject,
  addMessage, listMessages, addRevision, listRevisions, getRevision,
  addRun, finishRun, listRuns, getRun,
  addDeployment, updateDeployment, listDeployments,
  recordModelEvent, voteMessage, listModelStats,
} from './projects.js';
import {
  attachDocs, attachImages, buildPlanPrompt, buildCreatePrompt, buildEditPrompt, buildFixPrompt, buildTextPrompt, buildChatPrompt,
  createProtocolStreamer, parseAgentOutput,
} from './agent.js';
import * as ai from './ai.js';
import * as oauth from './oauth.js';
import {
  appendPart, applyOps, detectStack, guessEntry, normalizePath, sanitizeFiles, sanitizeImages, sanitizeDocs, summarizeFiles,
} from './files.js';
import { buildModeConfig, textTargetPath } from './modes.js';
import * as exec from './exec.js';
import * as deploy from './deploy.js';
import * as google from './google.js';
import { startSSE } from './stream.js';

let deps = {};
const DEV_USER = { id: 'dev', username: 'studio-dev', full_name: 'Local Studio' };

export function devAuthEnabled() {
  if (String(process.env.STUDIO_DEV_AUTH || '') !== '1') return false;
  if (process.env.VERCEL && String(process.env.STUDIO_ALLOW_DEV_AUTH_ON_VERCEL || '') !== '1') return false;
  return true;
}

export async function studioAuth(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || '';
  if (header && deps.authUser) {
    try { return await deps.authUser(req); }
    catch (e) { if (!devAuthEnabled()) throw e; }
  } else if (!devAuthEnabled()) {
    throw new StudioError(401, 'unauthorized');
  }
  return DEV_USER;
}

const ownerOf = (user) => String(user?.id ?? 'dev');

function projectPayload(project) {
  const sum = summarizeFiles(project.files);
  return { ...project, fileCount: sum.count, bytes: sum.bytes };
}

/* =============================== terminal ================================ */
export async function studioExecStream(req, res, body = {}) {
  const sse = startSSE(res);
  try {
    const user = await studioAuth(req);
    const ownerId = ownerOf(user);
    const projectId = Number(body.projectId) || null;
    const project = projectId ? await getProject(ownerId, projectId) : null;
    const files = sanitizeFiles(body.files || project?.files || {});
    if (!Object.keys(files).length) throw new StudioError(400, 'files_required', 'the project has no files yet');
    const command = String(body.command || '').trim();
    if (!command) throw new StudioError(400, 'command_required');

    const kind = ['install', 'build', 'test', 'dev', 'exec'].includes(body.kind) ? body.kind : 'exec';
    const caps = exec.execCapabilities();
    sse.send('status', { engine: caps.engine, label: caps.label, command });
    const runId = await addRun(ownerId, { projectId, kind, command, engine: caps.engine, status: 'running' });
    sse.send('run', { runId, startedAt: nowIso() });

    const result = await exec.runCommand({
      ownerId, projectId, files, command, kind,
      timeoutMs: Math.min(Math.max(Number(body.timeoutMs) || 90_000, 5_000), 300_000),
      onLog: (text) => sse.send('log', { text }),
    });
    await finishRun(ownerId, runId, {
      status: result.exitCode === 0 ? 'success' : 'failed',
      exitCode: result.exitCode, logs: result.logs, durationMs: result.durationMs, previewUrl: result.previewUrl,
    });
    sse.send('done', {
      runId, exitCode: result.exitCode, durationMs: result.durationMs,
      engine: result.engine, previewUrl: result.previewUrl, killed: Boolean(result.killed),
    });
  } catch (e) {
    sse.send('error', { code: e.code || 'exec_failed', detail: e.detail || e.message, status: e.status || 500 });
  } finally {
    sse.close();
  }
}

/* ================================= agent ================================= */
const MODE_LABEL = {
  plan: 'plan', create: 'create', continue: 'create', edit: 'edit', fix: 'fix', chat: 'chat',
};
const MODE_PHASE = {
  plan: 'planning', create: 'working', continue: 'orchestrating', edit: 'working', fix: 'working', chat: 'working',
};

function quickDiffStats(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  let added = 0;
  let removed = 0;
  const files = [];
  for (const path of keys) {
    const a = before[path];
    const b = after[path];
    if (a === b) continue;
    const status = a === undefined ? 'added' : b === undefined ? 'deleted' : 'modified';
    const aLines = typeof a === 'string' && a.length ? a.split('\n') : [];
    const bLines = typeof b === 'string' && b.length ? b.split('\n') : [];
    let fAdd = 0;
    let fDel = 0;
    if (status === 'added') fAdd = bLines.length;
    else if (status === 'deleted') fDel = aLines.length;
    else {
      const counts = new Map();
      for (const l of aLines) counts.set(l, (counts.get(l) || 0) + 1);
      for (const l of bLines) {
        const c = counts.get(l) || 0;
        if (c > 0) counts.set(l, c - 1);
        else fAdd += 1;
      }
      for (const rem of counts.values()) fDel += rem;
    }
    added += fAdd;
    removed += fDel;
    files.push({ path, status, added: fAdd, removed: fDel });
  }
  return { added, removed, count: files.length, files: files.slice(0, 60) };
}

export async function studioAgentStream(req, res, body = {}) {
  const sse = startSSE(res);
  let aborted = false;
  const startedMs = Date.now();
  const abort = new AbortController();
  const onClose = () => { aborted = true; try { abort.abort(); } catch { /* already */ } };
  if (req?.on) req.on('close', onClose);
  if (res?.on) res.on('close', onClose);

  try {
    const user = await studioAuth(req);
    const ownerId = ownerOf(user);
    const projectId = Number(body.projectId);
    if (!projectId) throw new StudioError(400, 'project_required');
    let project = await getProject(ownerId, projectId);
    const beforeFiles = { ...(project.files || {}) };

    const mode = ['plan', 'create', 'continue', 'edit', 'fix', 'chat'].includes(body.mode) ? body.mode : 'plan';
    const message = String(body.message || '').slice(0, 8000);
    if (!message && mode !== 'continue') throw new StudioError(400, 'message_required');

    /* persist the user's own words once — retries must not duplicate them */
    let userMessage = null;
    if (message && !body.retry) {
      const attached = sanitizeImages(body.images);
      const docList = sanitizeDocs(body.docs);
      userMessage = await addMessage(ownerId, projectId, {
        role: 'user',
        text: message,
        kind: 'text',
        meta: {
          ...(attached.length ? { attached: attached.map((im) => ({ mime: im.mime, bytes: im.data.length })) } : {}),
          ...(docList.length ? { docs: docList.map((d) => ({ name: d.name, url: d.url })) } : {}),
        },
      });
      sse.send('user_message', { message: userMessage });
    }

    sse.send('status', {
      step: mode,
      mode,
      phase: MODE_PHASE[mode] || 'working',
      label: MODE_LABEL[mode],
      provider: null,
      docs: sanitizeDocs(body.docs).length,
      at: nowIso(),
    });

    /* the build mode is what the composer selected; it decides the batch size,
       the temperature and whether long-form text is appended section by section */
    const buildMode = buildModeConfig(body.buildMode);
    const batch = Math.max(1, Math.min(6, Number(body.batch) || buildMode.batch));

    const history = (mode === 'edit' || mode === 'chat')
      ? (await listMessages(ownerId, projectId, 40))
        .filter((m) => (m.kind === 'text' || m.kind === 'files') && m.role !== 'error')
        .slice(-8)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text).slice(0, 3000) }))
      : [];

    let prompt;
    let maxTokens = 7000;
    if (mode === 'plan') {
      prompt = buildPlanPrompt({ project, userMessage: message, history });
    } else if (mode === 'chat') {
      prompt = buildChatPrompt({ project, userMessage: message, selectedPath: String(body.selectedFile || ''), history });
      maxTokens = 7000;
    } else if (mode === 'create' || mode === 'continue') {
      const plan = body.plan || project.plan || null;
      const missing = (plan?.files || []).map((f) => ({ path: f.path, purpose: f.purpose })).filter((f) => !(f.path in project.files));
      const hasFiles = Object.keys(project.files).length > 0;
      if (missing.length === 0 && hasFiles && plan) {
        sse.send('done', { project: projectPayload(project), changed: [], missing: [], pending: 0, note: 'nothing_missing' });
        return;
      }
      if (buildMode.append) {
        const target = normalizePath(String(body.textPath || '').trim())
          || normalizePath(textTargetPath(message, project.entry || 'document.md'))
          || 'document.md';
        const part = Math.max(1, Number(body.part) || 1);
        const parts = Math.max(1, Number(body.parts) || buildMode.parts || 4);
        prompt = buildTextPrompt({
          project,
          userMessage: message || project.description || 'Write the requested document.',
          targetPath: target,
          part,
          parts,
          existing: project.files[target] || '',
        });
        maxTokens = 8000;
      } else {
        prompt = buildCreatePrompt({
          project,
          plan,
          userMessage: message || plan?.summary || project.description || 'Finish this project so it runs.',
          missing,
          batch,
          /* direct mode has no plan step, so the first answer carries the plan
             it will be held to — that is what "still missing" is measured against */
          askPlan: !plan && !buildMode.plan && mode === 'create',
        });
        maxTokens = 8000;
      }
    } else if (mode === 'edit') {
      prompt = buildEditPrompt({ project, userMessage: message, selectedPath: String(body.selectedFile || ''), history });
      maxTokens = 8000;
    } else {
      prompt = buildFixPrompt({ project, logs: String(body.logs || '').slice(-14_000), userMessage: message });
      maxTokens = 8000;
    }

    /* attached screenshots ride on the prompt the user wrote them for */
    const images = sanitizeImages(body.images);
    if (images.length) {
      prompt = attachImages(prompt, images);
      sse.send('status', { step: mode, label: MODE_LABEL[mode], provider: null, images: images.length, at: nowIso() });
    }

    /* Drive documents are reference material for the same prompt */
    const docs = sanitizeDocs(body.docs);
    if (docs.length) {
      prompt = attachDocs(prompt, docs);
      sse.send('status', { step: mode, label: MODE_LABEL[mode], provider: null, docs: docs.length, at: nowIso() });
    }

    /* live protocol parsing: files land in the editor as they are written */
    const seen = [];
    let prose = '';
    let livePlan = null;
    let liveMessage = '';
    /* Write-through: a finished file is stored before the request ends, so a
       timeout, a closed tab or a killed function never loses work that already
       streamed to the editor. */
    const liveFiles = { ...(project.files || {}) };
    let persistChain = Promise.resolve();
    let persisted = 0;
    const persistNow = () => {
      const snapshot = { ...liveFiles };
      persistChain = persistChain
        .then(() => updateProject(ownerId, projectId, { files: snapshot }))
        .then(() => { persisted += 1; })
        .catch(() => { /* the final write below retries the whole set */ });
    };

    const streamer = createProtocolStreamer({
      onProse: (chunk) => { prose = (prose + chunk).replace(/\n{3,}/g, '\n\n'); sse.send('prose', { text: prose }); },
      onFile: ({ path, content, append }) => {
        seen.push({ op: 'write', path, content, append: Boolean(append) });
        liveFiles[path] = append ? appendPart(liveFiles[path], content) : content;
        sse.send('file', { path, content, append: Boolean(append), saved: true });
        persistNow();
      },
      onDelete: (path) => {
        seen.push({ op: 'delete', path });
        delete liveFiles[path];
        sse.send('delete', { path });
        persistNow();
      },
      onFilePartial: ({ path, partial }) => {
        if (aborted) return;
        sse.send('file_partial', { path, partial: partial.slice(-24_000) });
      },
      onPlan: (plan) => { livePlan = plan; sse.send('plan', { plan }); },
      onMessage: (text) => { liveMessage = text; sse.send('message', { text }); },
      onInspect: ({ path }) => { if (!aborted) sse.send('inspect', { path }); },
    });

    let result;
    try {
      result = await ai.studioChat({
        ownerId,
        instructions: prompt.instructions,
        messages: prompt.messages,
        maxTokens,
        temperature: mode === 'plan' ? 0.35 : buildMode.temp,
        signal: abort.signal,
        preferProvider: body.provider || null,
        model: body.model || null,
        timeoutMs: 230_000,
        budgetMs: 250_000,
        onDelta: (full) => { if (!aborted) streamer.push(full); },
      });
    } catch (e) {
      await persistChain;
      const detail = e.detail || e.message || 'model call failed';
      if (body.provider) {
        recordModelEvent(ownerId, {
          projectId, provider: body.provider, model: body.model || body.provider,
          mode, durationMs: Date.now() - startedMs, filesChanged: 0, ok: false,
        }).catch(() => {});
      }
      sse.send('error', { code: e.code || 'ai_failed', detail, status: e.status || 502, phase: 'error' });
      if (message && !body.retry) {
        await addMessage(ownerId, projectId, { role: 'error', kind: 'text', text: detail.slice(0, 2000), meta: { code: e.code || 'ai_failed' } });
      }
      sse.send('done', { project: projectPayload(project), changed: [], failed: true, phase: 'error' });
      return;
    }

    const parsed = streamer.flush();
    await persistChain;
    /* prefer the incremental parse; fall back to a full re-parse of the answer */
    const final = parseAgentOutput(result.text);
    const ops = mergeOps(parsed.ops, final.ops, seen);
    const plan = final.plan || livePlan || parsed.plan;
    const messageText = final.message || liveMessage || parsed.message
      || ((mode === 'chat' || (mode === 'edit' && !ops.length)) ? String(final.prose || prose || '').trim() : '');

    const { files: nextFiles, changed } = applyOps(beforeFiles, ops);
    const diff = changed.length ? quickDiffStats(beforeFiles, nextFiles) : { added: 0, removed: 0, count: 0, files: [] };
    const stack = detectStack(nextFiles);
    const patch = { files: nextFiles, stack };
    if (plan) patch.plan = plan;
    if (!project.name || /^untitled|^new (project|chat)|^مشروع جديد/i.test(project.name)) {
      if (plan?.title) patch.name = plan.title.slice(0, 80);
      else if (mode === 'chat' && message) patch.name = message.replace(/\s+/g, ' ').trim().slice(0, 60);
    }
    if (Object.keys(nextFiles).length) {
      patch.status = 'ready';
      patch.meta = { kind: 'project' };
    }
    project = await updateProject(ownerId, projectId, patch);

    let baselineRevisionId = null;
    let revisionId = null;
    if (changed.length) {
      if (Object.keys(beforeFiles).length && (mode === 'edit' || mode === 'fix' || mode === 'chat')) {
        const baseRev = await addRevision(ownerId, projectId, beforeFiles, `before ${mode}: ${(message || 'change').slice(0, 64)}`);
        baselineRevisionId = baseRev?.id || null;
      }
      const savedRev = await addRevision(ownerId, projectId, nextFiles, `${mode}: ${(message || plan?.title || 'agent').slice(0, 80)}`);
      revisionId = savedRev?.id || null;
    }
    const durationMs = result.latency || (Date.now() - startedMs);
    const assistantText = [messageText, plan?.summary].filter(Boolean).join('\n\n').slice(0, 20_000);
    const assistantMessage = (assistantText || (changed.length ? `${changed.length} file(s) updated` : ''))
      ? await addMessage(ownerId, projectId, {
        role: 'assistant',
        kind: plan && !changed.length ? 'plan' : (changed.length ? 'files' : 'text'),
        text: assistantText || `${changed.length} file(s) updated`,
        meta: {
          provider: result.provider,
          providerLabel: result.providerLabel,
          model: result.model,
          durationMs,
          ops: changed.map((c) => c.path).slice(0, 40),
          diff: changed.length ? { added: diff.added, removed: diff.removed, count: diff.count, files: diff.files.slice(0, 25) } : undefined,
          baselineRevisionId: baselineRevisionId || undefined,
          revisionId: revisionId || undefined,
          plan: plan || undefined,
          steps: plan?.steps || undefined,
        },
      })
      : null;

    recordModelEvent(ownerId, {
      projectId,
      messageId: assistantMessage?.id || null,
      provider: result.provider,
      model: result.model || result.provider,
      mode,
      durationMs,
      filesChanged: changed.length,
      ok: true,
    }).catch(() => {});

    /* the plan may come from this answer or from the stored project — either
       way the "what is still missing" list must be complete */
    const thePlan = plan || project.plan || null;
    const plannedPaths = (thePlan?.files || []).map((f) => f.path);
    const missing = plannedPaths.filter((p) => !(p in nextFiles));

    /* REAL dependency install: a build that declares npm dependencies gets
       `npm install` executed in the real exec sandbox once per dependency set,
       with the logs streamed live and the run recorded in the run history —
       the same engine the manual Terminal uses, no simulation. */
    let install = null;
    if ((mode === 'create' || mode === 'continue') && nextFiles['package.json']) {
      let fingerprint = '';
      try {
        const pkg = JSON.parse(nextFiles['package.json']);
        const deps = pkg && pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : null;
        fingerprint = deps
          ? Object.keys(deps).sort().map((k) => `${k}@${deps[k]}`).join(',')
          : '';
      } catch { /* invalid package.json — nothing to install */ }
      if (fingerprint && project.meta?.deps !== fingerprint) {
        try {
          const caps = exec.execCapabilities();
          if (caps.canRun) {
            const command = 'npm install --no-audit --no-fund';
            sse.send('status', { step: 'install', mode, phase: 'working', label: 'Installing dependencies', provider: null, at: nowIso() });
            const runId = await addRun(ownerId, { projectId, kind: 'install', command, engine: caps.engine, status: 'running' });
            const res = await exec.runCommand({
              ownerId, projectId, files: nextFiles, command, kind: 'install', timeoutMs: 150_000,
              onLog: (text) => sse.send('log', { text }),
            });
            await finishRun(ownerId, runId, {
              status: res.exitCode === 0 ? 'success' : 'failed',
              exitCode: res.exitCode, logs: res.logs, durationMs: res.durationMs, previewUrl: res.previewUrl,
            });
            install = { ran: true, exitCode: res.exitCode, engine: res.engine, durationMs: res.durationMs, deps: fingerprint.split(',').length };
            if (res.exitCode === 0) {
              project = await updateProject(ownerId, projectId, { meta: { ...project.meta, deps: fingerprint } });
            }
          }
        } catch (e) {
          install = install || { ran: true, exitCode: 1, engine: 'none', durationMs: 0, error: String(e?.message || e).slice(0, 300) };
        }
      }
    }

    const notes = [];
    if (result.truncated) notes.push('the model hit its output limit — the last file may be incomplete');
    if (parsed.truncatedFiles.length) notes.push('one file block was cut off mid-write');
    if (ops.length === 0 && mode !== 'chat') notes.push('the model returned no file operations');
    if (install && install.exitCode !== 0) notes.push('npm install failed — open the Terminal tab to see the logs');

    sse.send('done', {
      ok: true,
      phase: missing.length > 0 ? 'orchestrating' : 'completed',
      project: projectPayload(project),
      changed,
      diff,
      baselineRevisionId,
      revisionId,
      plan: thePlan,
      missing,
      pending: missing.length,
      savedDuringRun: persisted,
      buildMode: buildMode.id,
      provider: result.provider,
      providerLabel: result.providerLabel,
      model: result.model,
      latencyMs: durationMs,
      truncated: Boolean(result.truncated),
      install,
      inspects: parsed.inspects || [],
      notes,
      assistantMessage,
      userMessage,
      message: messageText,
    });
  } catch (e) {
    sse.send('error', { code: e.code || 'agent_failed', detail: e.detail || e.message || 'agent failed', status: e.status || 500 });
  } finally {
    sse.close();
  }
}

/** Union of the incremental and final parse (dedupe by path, keep newest content). */
function mergeOps(parsedOps, finalOps, liveOps) {
  const map = new Map();
  for (const op of [...parsedOps, ...finalOps, ...liveOps]) {
    if (op?.path) map.set(op.path, op);
  }
  return [...map.values()];
}

/* ============================ registration =============================== */
export function registerStudioRoutes({ route, authUser }) {
  deps = { route, authUser };

  const auth = async (req) => ownerOf(await studioAuth(req));

  /* ------------------------------- session ------------------------------- */
  route('GET', 'studio/session', async ({ req }) => {
    const health = await studioHealth();
    let user = null;
    let dev = false;
    try {
      const u = await studioAuth(req);
      dev = u.id === 'dev';
      user = { id: String(u.id), username: u.username, fullName: u.full_name || u.username, avatarUrl: u.avatar_url || null };
    } catch (e) {
      return { authenticated: false, user: null, storage: health, reason: e.code || 'unauthorized' };
    }
    if (!health.ok) {
      return { authenticated: true, user, dev, storage: health, error: 'storage_unavailable' };
    }
    const providers = await ai.providerStatus(user.id);
    const primary = await ai.primaryProvider(user.id);
    return {
      authenticated: true,
      user,
      dev,
      storage: health,
      runtime: exec.execCapabilities(),
      ai: { providers, primary, configured: providers.some((p) => p.configured) },
      integrations: {
        github: await deploy.githubStatus(user.id).catch(() => ({ connected: false })),
        vercel: await deploy.vercelStatus(user.id).catch(() => ({ connected: false })),
      },
      oauth: oauth.oauthProvidersStatus(req?.headers || {}),
    };
  });

  /* a deployment-level self check: public, but it only answers whether the
     tokens are configured and accepted — never their value, and the account
     identity only for a caller that knows STUDIO_HEALTH_KEY */
  route('GET', 'studio/status', async ({ query }) => {
    const key = process.env.STUDIO_HEALTH_KEY || '';
    const given = (query && query.key) || '';
    if (!key || given !== key) return { ok: true, service: 'studio' };
    const probe = await deploy.connectionProbe();
    return {
      ok: probe.github.valid && probe.vercel.valid,
      service: 'studio',
      team: process.env.VERCEL_TEAM_ID || null,
      ...probe,
    };
  });

  route('GET', 'studio/config', async ({ req }) => {
    const user = await studioAuth(req);
    const owner = ownerOf(user);
    return {
      providers: await ai.providerStatus(owner),
      primary: await ai.primaryProvider(owner),
      runtime: exec.execCapabilities(),
      storage: await studioHealth(),
      driver: studioDriver(),
      limits: { maxFiles: 400, maxFileBytes: 400_000 },
    };
  });

  /* ------------------------------- projects ------------------------------ */
  route('GET', 'studio/projects', async ({ req }) => ({ projects: await listProjects(await auth(req)) }));

  route('POST', 'studio/projects', async ({ req, body }) => {
    const owner = await auth(req);
    const project = await createProject(owner, {
      name: body.name,
      description: body.description,
      stack: body.stack,
      files: body.files || {},
      plan: body.plan || null,
      meta: body.meta || {},
    });
    return { project: projectPayload(project) };
  });

  route('GET', 'studio/projects/:id', async ({ req, params }) => {
    const owner = await auth(req);
    const project = await getProject(owner, Number(params.id));
    return {
      project: projectPayload(project),
      messages: await listMessages(owner, Number(params.id)),
      revisions: await listRevisions(owner, Number(params.id)),
      deployments: await listDeployments(owner, Number(params.id)),
    };
  });

  route('PATCH', 'studio/projects/:id', async ({ req, params, body }) => {
    const owner = await auth(req);
    const patch = {};
    for (const k of ['name', 'description', 'files', 'stack', 'status', 'plan', 'entry', 'meta', 'archived']) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (patch.files !== undefined) {
      const before = await getProject(owner, Number(params.id));
      const after = sanitizeFiles(patch.files);
      if (JSON.stringify(before.files) !== JSON.stringify(after)) {
        await addRevision(owner, Number(params.id), before.files, body.revisionLabel || 'manual save');
      }
    }
    const project = await updateProject(owner, Number(params.id), patch);
    return { project: projectPayload(project) };
  });

  route('DELETE', 'studio/projects/:id', async ({ req, params }) => deleteProject(await auth(req), Number(params.id)));

  /* single/bulk file writes from the editor */
  route('POST', 'studio/projects/:id/files', async ({ req, params, body }) => {
    const owner = await auth(req);
    const project = await getProject(owner, Number(params.id));
    const ops = [];
    if (body.path && typeof body.content === 'string') ops.push({ op: 'write', path: body.path, content: body.content });
    if (body.deletePath) ops.push({ op: 'delete', path: body.deletePath });
    if (body.writes && typeof body.writes === 'object') {
      for (const [path, content] of Object.entries(body.writes)) ops.push({ op: 'write', path, content: String(content) });
    }
    if (Array.isArray(body.deletes)) for (const path of body.deletes) ops.push({ op: 'delete', path });
    if (!ops.length) throw new StudioError(400, 'no_operation');
    const { files, changed } = applyOps(project.files, ops);
    const updated = await updateProject(owner, Number(params.id), { files, stack: detectStack(files), entry: guessEntry(files) });
    return { project: projectPayload(updated), changed };
  });

  route('POST', 'studio/projects/:id/save', async ({ req, params, body }) => {
    const owner = await auth(req);
    const project = await getProject(owner, Number(params.id));
    const files = sanitizeFiles(body.files || project.files);
    await addRevision(owner, Number(params.id), files, body.label || 'save');
    const updated = await updateProject(owner, Number(params.id), { files, stack: detectStack(files), status: 'ready' });
    return { project: projectPayload(updated), revisionSaved: true };
  });

  route('GET', 'studio/projects/:id/revisions', async ({ req, params }) => ({
    revisions: await listRevisions(await auth(req), Number(params.id)),
  }));

  route('GET', 'studio/projects/:id/revisions/:revisionId', async ({ req, params }) => ({
    revision: await getRevision(await auth(req), Number(params.id), Number(params.revisionId)),
  }));

  route('POST', 'studio/projects/:id/revisions/:revisionId/restore', async ({ req, params }) => {
    const owner = await auth(req);
    const rev = await getRevision(owner, Number(params.id), Number(params.revisionId));
    const current = await getProject(owner, Number(params.id));
    await addRevision(owner, Number(params.id), current.files, 'before restore');
    const project = await updateProject(owner, Number(params.id), { files: rev.files, stack: detectStack(rev.files) });
    return { project: projectPayload(project), restored: rev.id };
  });

  route('GET', 'studio/projects/:id/runs', async ({ req, params }) => ({
    runs: await listRuns(await auth(req), Number(params.id)),
  }));

  route('GET', 'studio/runs/:id', async ({ req, params }) => ({ run: await getRun(await auth(req), Number(params.id)) }));

  /* -------------------------------- models ------------------------------- */
  route('POST', 'studio/ai/test', async ({ req, body }) => {
    const owner = await auth(req);
    const res = await ai.testProvider({ ownerId: owner, providerId: body.provider, key: body.key, model: body.model });
    recordModelEvent(owner, {
      provider: res.provider || body.provider,
      model: res.model || body.model || body.provider,
      mode: 'benchmark',
      durationMs: res.latency || 0,
      ok: Boolean(res.ok),
    }).catch(() => {});
    return res;
  });

  route('GET', 'studio/leaderboard', async ({ req }) => {
    const owner = await auth(req);
    const [providers, primary, stats] = await Promise.all([
      ai.providerStatus(owner),
      ai.primaryProvider(owner),
      listModelStats(),
    ]);
    const byKey = new Map(stats.map((s) => [`${s.provider}::${s.model}`, s]));
    const entries = [];
    const seen = new Set();

    for (const p of providers) {
      const model = p.defaultModel || p.id;
      const key = `${p.id}::${model}`;
      seen.add(key);
      const st = byKey.get(key);
      entries.push({
        provider: p.id,
        providerLabel: p.label,
        model,
        models: p.models || [model],
        configured: Boolean(p.configured),
        source: p.source || null,
        vision: Boolean(p.vision),
        stream: Boolean(p.stream),
        free: Boolean(p.free),
        active: primary?.id === p.id,
        runs: st?.runs || 0,
        successful: st?.successful || 0,
        successRate: st?.successRate ?? null,
        benchmarks: st?.benchmarks || 0,
        filesChanged: st?.filesChanged || 0,
        avgLatencyMs: st?.avgLatencyMs ?? null,
        lastLatencyMs: st?.lastLatencyMs ?? null,
        upvotes: st?.upvotes || 0,
        downvotes: st?.downvotes || 0,
        netVotes: st?.netVotes || 0,
        lastUsedAt: st?.lastUsedAt || null,
      });
    }
    for (const st of stats) {
      const key = `${st.provider}::${st.model}`;
      if (seen.has(key)) continue;
      const p = providers.find((x) => x.id === st.provider);
      entries.push({
        provider: st.provider,
        providerLabel: p?.label || st.provider,
        model: st.model,
        models: p?.models || [st.model],
        configured: Boolean(p?.configured),
        source: p?.source || null,
        vision: Boolean(p?.vision),
        stream: Boolean(p?.stream),
        free: Boolean(p?.free),
        active: false,
        ...st,
      });
    }
    entries.sort((a, b) => {
      if (a.configured !== b.configured) return a.configured ? -1 : 1;
      if (b.netVotes !== a.netVotes) return b.netVotes - a.netVotes;
      if (b.runs !== a.runs) return b.runs - a.runs;
      if ((a.avgLatencyMs ?? Infinity) !== (b.avgLatencyMs ?? Infinity)) return (a.avgLatencyMs ?? Infinity) - (b.avgLatencyMs ?? Infinity);
      return a.providerLabel.localeCompare(b.providerLabel);
    });
    return {
      entries,
      primary,
      totals: {
        configured: providers.filter((p) => p.configured).length,
        providers: providers.length,
        totalRuns: entries.reduce((sum, e) => sum + (e.runs || 0), 0),
        totalVotes: entries.reduce((sum, e) => sum + (e.upvotes || 0) + (e.downvotes || 0), 0),
      },
    };
  });

  route('POST', 'studio/messages/:id/vote', async ({ req, params, body }) => {
    const owner = await auth(req);
    return await voteMessage(owner, Number(params.id), Number(body.vote || 0));
  });

  /* -------------------------------- OAuth -------------------------------- */
  route('GET', 'studio/oauth/providers', async ({ req }) => {
    await auth(req);
    return { providers: oauth.oauthProvidersStatus(req?.headers || {}) };
  });

  route('POST', 'studio/oauth/:provider/start', async ({ req, params, body }) => {
    const owner = await auth(req);
    return oauth.startOAuth(owner, params.provider, {
      headers: req?.headers || {},
      origin: String(body?.origin || ''),
    });
  });

  route('GET', 'studio/oauth/:provider/callback', async ({ params, query }) =>
    await oauth.completeOAuth(params.provider, query || {}),
  );

  route('POST', 'studio/ai/keys', async ({ req, body }) => {
    const owner = await auth(req);
    const saved = await ai.saveUserKey(owner, body.provider, body.key, { label: body.label });
    // verify immediately with a real call; keep the key either way but report the truth
    const test = await ai.testProvider({ ownerId: owner, providerId: body.provider, key: body.key, model: body.model });
    return { ...saved, test };
  });

  route('DELETE', 'studio/ai/keys/:provider', async ({ req, params }) => ai.deleteUserKey(await auth(req), params.provider));

  /* ----------------------------- integrations ---------------------------- */
  /* live connection checks used by the publish and settings panels */
  route('GET', 'studio/integrations/github', async ({ req }) => deploy.githubAccount(await auth(req)));
  route('GET', 'studio/integrations/vercel', async ({ req }) => deploy.vercelAccount(await auth(req)));
  route('GET', 'studio/integrations/google', async ({ req }) => google.driveAccount(await auth(req)));

  /* ------------------------------ Google Drive ---------------------------- */
  route('GET', 'studio/drive/files', async ({ req, query }) => {
    const owner = await auth(req);
    return await google.searchDriveFiles(owner, {
      q: query?.q || '',
      kind: query?.kind || 'all',
      folderId: query?.folderId || '',
      pageSize: query?.pageSize || 30,
      pageToken: query?.pageToken || '',
    });
  });

  route('POST', 'studio/drive/manage', async ({ req, body }) => {
    const owner = await auth(req);
    return await google.manageDriveFile(owner, body || {});
  });

  route('POST', 'studio/drive/read', async ({ req, body }) => {
    const owner = await auth(req);
    return { document: await google.readDriveFile(owner, { id: body.id }) };
  });

  route('POST', 'studio/drive/export', async ({ req, body }) => {
    const owner = await auth(req);
    const project = body.projectId ? await getProject(owner, Number(body.projectId)) : null;
    const result = await google.exportToDrive(owner, {
      project,
      files: project?.files || {},
      name: body.name || '',
      as: body.as === 'zip' ? 'zip' : 'doc',
      zipBase64: body.zipBase64 || null,
    });
    if (project) {
      await addDeployment(owner, project.id, { provider: 'google', status: 'exported', url: result.url, meta: result });
    }
    return { export: result };
  });

  /* ------------------------------ Google Docs ----------------------------- */
  route('GET', 'studio/docs', async ({ req, query }) => {
    const owner = await auth(req);
    return await google.searchDriveFiles(owner, { q: query?.q || '', kind: 'doc', pageSize: query?.pageSize || 30 });
  });

  route('POST', 'studio/docs/read', async ({ req, body }) => {
    const owner = await auth(req);
    return { doc: await google.readGoogleDoc(owner, { id: body.id }) };
  });

  route('POST', 'studio/docs/create', async ({ req, body }) => {
    const owner = await auth(req);
    const doc = await google.createGoogleDoc(owner, { title: body.title, content: body.content || '' });
    if (body.projectId) {
      await addDeployment(owner, Number(body.projectId), { provider: 'google', status: 'doc_created', url: doc.url, meta: doc }).catch(() => {});
    }
    return { doc };
  });

  route('POST', 'studio/docs/update', async ({ req, body }) => {
    const owner = await auth(req);
    return { doc: await google.updateGoogleDoc(owner, body || {}) };
  });

  /* --------------------------- real repositories -------------------------- */
  /* open an existing GitHub repository as a project, and commit back to it */
  route('POST', 'studio/vercel/state', async ({ req, body }) => {
    const owner = await auth(req);
    return await deploy.vercelProjectState(owner, { id: body.id || null, name: body.name || '' });
  });

  route('GET', 'studio/vercel/deployments', async ({ req, query }) => {
    const owner = await auth(req);
    return await deploy.vercelDeployments(owner, {
      id: query?.id || '',
      name: query?.name || '',
      limit: query?.limit || 10,
    });
  });

  route('GET', 'studio/repos/branches', async ({ req, query }) => {
    const owner = await auth(req);
    return await deploy.githubBranches(owner, { repo: query?.repo || '' });
  });

  route('POST', 'studio/repos/branches', async ({ req, body }) => {
    const owner = await auth(req);
    const created = await deploy.githubCreateBranch(owner, {
      repo: body.repo,
      branch: body.branch,
      from: body.from || '',
    });
    if (body.projectId) {
      await updateProject(owner, Number(body.projectId), {
        meta: { repo: created.repo, branch: created.branch },
      }).catch(() => {});
    }
    return created;
  });

  route('POST', 'studio/repos/file', async ({ req, body }) => {
    const owner = await auth(req);
    return await deploy.githubReadFile(owner, {
      repo: body.repo,
      path: body.path,
      ref: body.ref || '',
    });
  });

  route('POST', 'studio/repos/file/save', async ({ req, body }) => {
    const owner = await auth(req);
    const saved = await deploy.githubSaveFile(owner, {
      repo: body.repo,
      path: body.path,
      content: body.content,
      branch: body.branch || '',
      message: body.message || '',
      sha: body.sha || '',
    });
    if (body.projectId && typeof body.content === 'string') {
      const proj = await getProject(owner, Number(body.projectId)).catch(() => null);
      if (proj) {
        const { files } = applyOps(proj.files, [{ op: 'write', path: body.path, content: body.content }]);
        await updateProject(owner, proj.id, { files }).catch(() => {});
      }
    }
    return saved;
  });

  route('POST', 'studio/repos/import', async ({ req, body }) => {
    const owner = await auth(req);
    const imported = await deploy.githubImport(owner, { repo: body.repo, ref: body.ref });
    const targetId = body.projectId ? Number(body.projectId) : null;
    const name = String(body.name || imported.repo.split('/')[1] || 'imported repo').slice(0, 60);
    const base = targetId ? await getProject(owner, targetId) : await createProject(owner, { name });
    const stack = detectStack(imported.files);
    const entry = guessEntry(imported.files, stack);
    const project = await updateProject(owner, base.id, {
      ...(targetId ? {} : { name }),
      files: imported.files,
      stack,
      entry,
      status: 'ready',
      description: `Imported from ${imported.repo}@${imported.ref}`.slice(0, 200),
      meta: {
        kind: 'project',
        repo: imported.repo,
        branch: imported.ref,
        defaultBranch: imported.defaultBranch || imported.ref || 'main',
      },
    });
    await addDeployment(owner, project.id, {
      provider: 'github',
      status: 'imported',
      url: `https://github.com/${imported.repo}`,
      meta: { repo: imported.repo, ref: imported.ref, imported: imported.imported, skipped: imported.skipped },
    });
    try { await addRevision(owner, project.id, project.files, `imported ${imported.repo}@${imported.ref}`); } catch { /* a restore point is nice, not required */ }
    return {
      project: projectPayload(project),
      repo: {
        full: imported.repo,
        ref: imported.ref,
        defaultBranch: imported.defaultBranch || imported.ref || 'main',
        private: imported.private,
        imported: imported.imported,
        skipped: imported.skipped,
        failed: imported.failed,
      },
    };
  });

  route('POST', 'studio/repos/push', async ({ req, body }) => {
    const owner = await auth(req);
    const project = await getProject(owner, Number(body.projectId));
    const record = await addDeployment(owner, project.id, { provider: 'github', status: 'pushing' });
    try {
      const result = await deploy.githubPushBranch(owner, {
        repo: body.repo,
        files: project.files,
        deletePaths: Array.isArray(body.deletePaths) ? body.deletePaths : [],
        branch: body.branch || '',
        base: body.base || '',
        message: String(body.message || `NEXORA Studio: ${project.name}`).slice(0, 200),
        pr: body.pr !== false,
        prTitle: body.prTitle || '',
        prBody: body.prBody || '',
      });
      await updateProject(owner, project.id, {
        meta: { repo: result.repo, branch: result.branch, defaultBranch: result.base },
      }).catch(() => {});
      await updateDeployment(owner, record.id, {
        status: result.pull ? 'pr_open' : 'ready',
        url: result.pull?.url || result.commitUrl || result.url,
        externalId: result.commitSha,
        meta: result,
      });
      return { ...result, deployment: { ...record, url: result.pull?.url || result.commitUrl || result.url, status: result.pull ? 'pr_open' : 'ready' } };
    } catch (e) {
      await updateDeployment(owner, record.id, { status: 'failed', meta: { error: e.detail || e.message } });
      throw e;
    }
  });

  route('POST', 'studio/integrations/:provider', async ({ req, params, body }) => {
    const owner = await auth(req);
    const provider = params.provider;
    if (!['github', 'vercel', 'google'].includes(provider)) throw new StudioError(400, 'unknown_integration');
    const token = String(body.token || '').trim();
    if (token.length < 10) throw new StudioError(400, 'invalid_token');
    await ai.putIntegrationSecret(owner, provider, token);
    const status = provider === 'github'
      ? await deploy.githubStatus(owner)
      : provider === 'google'
        ? await google.driveAccount(owner)
        : await deploy.vercelStatus(owner);
    if (!status.connected) {
      await ai.removeIntegrationSecret(owner, provider);
      throw new StudioError(400, 'integration_rejected', status.error || 'the token was rejected');
    }
    return { provider, status };
  });

  route('DELETE', 'studio/integrations/:provider', async ({ req, params }) => {
    const owner = await auth(req);
    await ai.removeIntegrationSecret(owner, params.provider);
    return { provider: params.provider, removed: true };
  });

  /* -------------------------------- deploy ------------------------------- */
  route('POST', 'studio/projects/:id/deploy/vercel', async ({ req, params, body }) => {
    const owner = await auth(req);
    const project = await getProject(owner, Number(params.id));
    const record = await addDeployment(owner, project.id, { provider: 'vercel', status: 'queued' });
    try {
      const result = await deploy.deployToVercel(owner, {
        files: project.files,
        projectName: body.name || project.name,
        stack: project.stack,
        target: body.target === 'preview' ? null : 'production',
        existingProjectId: body.existingProjectId || null,
      });
      await updateDeployment(owner, record.id, { status: result.state || 'queued', url: result.url, externalId: result.id, meta: result });
      await updateProject(owner, project.id, {
        status: 'deployed',
        meta: {
          vercelProjectName: result.project || '',
          ...(body.existingProjectId ? { vercelProjectId: String(body.existingProjectId) } : {}),
        },
      });
      return { deployment: { ...record, ...result, status: result.state } };
    } catch (e) {
      await updateDeployment(owner, record.id, { status: 'failed', meta: { error: e.detail || e.message } });
      throw e;
    }
  });

  route('GET', 'studio/deploy/vercel/:deploymentId', async ({ req, params }) => {
    const owner = await auth(req);
    return await deploy.vercelDeploymentState(owner, params.deploymentId);
  });

  route('POST', 'studio/projects/:id/deploy/github', async ({ req, params, body }) => {
    const owner = await auth(req);
    const project = await getProject(owner, Number(params.id));
    const record = await addDeployment(owner, project.id, { provider: 'github', status: 'pushing' });
    try {
      const result = await deploy.pushToGitHub(owner, {
        files: project.files,
        repoName: body.repo || project.name,
        isPrivate: body.private !== false,
        message: body.message || `NEXORA Studio: ${project.name}`,
        branch: body.branch || 'main',
        projectName: project.name,
      });
      await updateDeployment(owner, record.id, { status: 'ready', url: result.url, externalId: result.commitSha, meta: result });
      await updateProject(owner, project.id, {
        meta: { repo: result.repo, branch: result.branch || 'main', defaultBranch: result.branch || 'main' },
      }).catch(() => {});
      return { deployment: { ...record, ...result } };
    } catch (e) {
      await updateDeployment(owner, record.id, { status: 'failed', meta: { error: e.detail || e.message } });
      throw e;
    }
  });

  route('GET', 'studio/projects/:id/deployments', async ({ req, params }) => ({
    deployments: await listDeployments(await auth(req), Number(params.id)),
  }));

  /* ----------------------------- dev server ------------------------------ */
  route('POST', 'studio/projects/:id/dev/start', async ({ req, params, body }) => {
    const owner = await auth(req);
    const project = await getProject(owner, Number(params.id));
    const result = await exec.startDevServer({
      projectId: project.id,
      files: project.files,
      command: body.command || '',
    });
    return { ...result, status: exec.devServerStatus(project.id) };
  });

  route('POST', 'studio/projects/:id/dev/stop', async ({ req, params }) => {
    await auth(req);
    return await exec.stopDevServer(Number(params.id));
  });

  route('GET', 'studio/projects/:id/dev/status', async ({ req, params }) => {
    await auth(req);
    return exec.devServerStatus(Number(params.id));
  });

  route('GET', 'studio/runtime', async ({ req }) => {
    await auth(req);
    return exec.execCapabilities();
  });

  route('GET', 'studio/workspace/:id/files', async ({ req, params }) => {
    await auth(req);
    return { files: await exec.workspaceListing(Number(params.id)) };
  });
}
