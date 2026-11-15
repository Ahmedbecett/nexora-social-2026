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
} from './projects.js';
import {
  buildPlanPrompt, buildCreatePrompt, buildEditPrompt, buildFixPrompt,
  createProtocolStreamer, parseAgentOutput,
} from './agent.js';
import * as ai from './ai.js';
import { applyOps, detectStack, guessEntry, sanitizeFiles, summarizeFiles } from './files.js';
import * as exec from './exec.js';
import * as deploy from './deploy.js';
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
  plan: 'plan', create: 'create', continue: 'create', edit: 'edit', fix: 'fix',
};

export async function studioAgentStream(req, res, body = {}) {
  const sse = startSSE(res);
  let aborted = false;
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

    const mode = ['plan', 'create', 'continue', 'edit', 'fix'].includes(body.mode) ? body.mode : 'plan';
    const message = String(body.message || '').slice(0, 8000);
    if (!message && mode !== 'continue') throw new StudioError(400, 'message_required');

    /* persist the user's own words once — retries must not duplicate them */
    let userMessage = null;
    if (message && !body.retry) {
      userMessage = await addMessage(ownerId, projectId, { role: 'user', text: message, kind: 'text' });
      sse.send('user_message', { message: userMessage });
    }

    sse.send('status', { step: mode, label: MODE_LABEL[mode], provider: null, at: nowIso() });

    const history = mode === 'edit'
      ? (await listMessages(ownerId, projectId, 40))
        .filter((m) => m.kind === 'text' && m.role !== 'error')
        .slice(-8)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text).slice(0, 3000) }))
      : [];

    let prompt;
    let maxTokens = 7000;
    if (mode === 'plan') {
      prompt = buildPlanPrompt({ project, userMessage: message, history });
    } else if (mode === 'create' || mode === 'continue') {
      const plan = body.plan || project.plan || null;
      const missing = (plan?.files || []).map((f) => ({ path: f.path, purpose: f.purpose })).filter((f) => !(f.path in project.files));
      const hasFiles = Object.keys(project.files).length > 0;
      if (missing.length === 0 && hasFiles && plan) {
        sse.send('done', { project: projectPayload(project), changed: [], missing: [], pending: 0, note: 'nothing_missing' });
        return;
      }
      prompt = buildCreatePrompt({
        project,
        plan,
        userMessage: message || plan?.summary || project.description || 'Finish this project so it runs.',
        missing,
        batch: Math.max(1, Math.min(5, Number(body.batch) || 3)),
      });
      maxTokens = 8000;
    } else if (mode === 'edit') {
      prompt = buildEditPrompt({ project, userMessage: message, selectedPath: String(body.selectedFile || ''), history });
      maxTokens = 8000;
    } else {
      prompt = buildFixPrompt({ project, logs: String(body.logs || '').slice(-14_000), userMessage: message });
      maxTokens = 8000;
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
      onFile: ({ path, content }) => {
        seen.push({ op: 'write', path, content });
        liveFiles[path] = content;
        sse.send('file', { path, content, saved: true });
        persistNow();
      },
      onDelete: (path) => {
        seen.push({ op: 'delete', path });
        delete liveFiles[path];
        sse.send('delete', { path });
        persistNow();
      },
      onPlan: (plan) => { livePlan = plan; sse.send('plan', { plan }); },
      onMessage: (text) => { liveMessage = text; sse.send('message', { text }); },
    });

    let result;
    try {
      result = await ai.studioChat({
        ownerId,
        instructions: prompt.instructions,
        messages: prompt.messages,
        maxTokens,
        temperature: mode === 'plan' ? 0.35 : 0.25,
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
      sse.send('error', { code: e.code || 'ai_failed', detail, status: e.status || 502 });
      if (message && !body.retry) {
        await addMessage(ownerId, projectId, { role: 'error', kind: 'text', text: detail.slice(0, 2000), meta: { code: e.code || 'ai_failed' } });
      }
      sse.send('done', { project: projectPayload(project), changed: [], failed: true });
      return;
    }

    const parsed = streamer.flush();
    await persistChain;
    /* prefer the incremental parse; fall back to a full re-parse of the answer */
    const final = parseAgentOutput(result.text);
    const ops = mergeOps(parsed.ops, final.ops, seen);
    const plan = final.plan || livePlan || parsed.plan;
    const messageText = final.message || liveMessage || parsed.message || '';

    const { files: nextFiles, changed } = applyOps(project.files, ops);
    const stack = detectStack(nextFiles);
    const patch = { files: nextFiles, stack };
    if (plan) patch.plan = plan;
    if (!project.name || /^untitled|^new project|^مشروع جديد/i.test(project.name)) {
      if (plan?.title) patch.name = plan.title.slice(0, 80);
    }
    if (Object.keys(nextFiles).length) patch.status = 'ready';
    project = await updateProject(ownerId, projectId, patch);

    if (changed.length) {
      await addRevision(ownerId, projectId, nextFiles, `${mode}: ${(message || plan?.title || 'agent').slice(0, 80)}`);
    }
    const assistantText = [messageText, plan?.summary].filter(Boolean).join('\n\n').slice(0, 20_000);
    const assistantMessage = (assistantText || (changed.length ? `${changed.length} file(s) updated` : ''))
      ? await addMessage(ownerId, projectId, {
        role: 'assistant',
        kind: plan && !changed.length ? 'plan' : 'files',
        text: assistantText || `${changed.length} file(s) updated`,
        meta: {
          provider: result.provider, model: result.model,
          ops: changed.map((c) => c.path).slice(0, 40),
          plan: plan || undefined,
          steps: plan?.steps || undefined,
        },
      })
      : null;

    /* the plan may come from this answer or from the stored project — either
       way the "what is still missing" list must be complete */
    const thePlan = plan || project.plan || null;
    const plannedPaths = (thePlan?.files || []).map((f) => f.path);
    const missing = plannedPaths.filter((p) => !(p in nextFiles));

    const notes = [];
    if (result.truncated) notes.push('the model hit its output limit — the last file may be incomplete');
    if (parsed.truncatedFiles.length) notes.push('one file block was cut off mid-write');
    if (ops.length === 0) notes.push('the model returned no file operations');

    sse.send('done', {
      ok: true,
      project: projectPayload(project),
      changed,
      plan: thePlan,
      missing,
      pending: missing.length,
      savedDuringRun: persisted,
      provider: result.provider,
      providerLabel: result.providerLabel,
      model: result.model,
      latencyMs: result.latency,
      truncated: Boolean(result.truncated),
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
    for (const k of ['name', 'description', 'files', 'stack', 'status', 'plan', 'entry']) {
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
    return await ai.testProvider({ ownerId: owner, providerId: body.provider, key: body.key, model: body.model });
  });

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

  route('POST', 'studio/integrations/:provider', async ({ req, params, body }) => {
    const owner = await auth(req);
    const provider = params.provider;
    if (!['github', 'vercel'].includes(provider)) throw new StudioError(400, 'unknown_integration');
    const token = String(body.token || '').trim();
    if (token.length < 10) throw new StudioError(400, 'invalid_token');
    await ai.putIntegrationSecret(owner, provider, token);
    const status = provider === 'github'
      ? await deploy.githubStatus(owner)
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
      });
      await updateDeployment(owner, record.id, { status: result.state || 'queued', url: result.url, externalId: result.id, meta: result });
      await updateProject(owner, project.id, { status: 'deployed' });
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
