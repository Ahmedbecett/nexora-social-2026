/**
 * NEXORA Studio — Google Drive / Docs.
 *
 * Two directions, like the rest of the integrations:
 *   read    a Doc or a text file as context for the build
 *   write   the finished project back to Drive as a Google Doc or a .zip
 *
 * Credentials follow the same shape as GitHub and Vercel: a token saved in the
 * user's account wins, a deployment-level token is the fallback.
 */
import { getIntegrationSecret } from './ai.js';
import { StudioError } from './db.js';
import { resolveGoogleAccessToken } from './oauth.js';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const DOCS = 'https://docs.googleapis.com/v1';
const DOC = 'application/vnd.google-apps.document';
const SHEET = 'application/vnd.google-apps.spreadsheet';
const SLIDES = 'application/vnd.google-apps.presentation';
const FOLDER = 'application/vnd.google-apps.folder';

export const DRIVE_LIMITS = { maxText: 180_000, maxFiles: 150, maxUpload: 6_000_000 };

export async function googleToken(ownerId) {
  const oauth = await resolveGoogleAccessToken(ownerId).catch(() => null);
  if (oauth?.token) return oauth;
  const mine = await getIntegrationSecret(ownerId, 'google').catch(() => null);
  if (mine?.key) return { token: mine.key, source: 'account' };
  const env = process.env.GOOGLE_DRIVE_TOKEN || process.env.GOOGLE_STUDIO_TOKEN || process.env.GOOGLE_ACCESS_TOKEN;
  if (env) return { token: env, source: 'server' };
  return null;
}

async function gd(token, path, { method = 'GET', body, contentType, base = DRIVE, raw = false } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (raw) {
    if (!res.ok) throw new StudioError(res.status === 401 ? 401 : 502, 'drive_failed', `Drive answered ${res.status}`);
    return await res.text();
  }
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, data };
}

const isTextish = (mime = '') => /^text\//.test(mime) || /(json|javascript|xml|yaml|x-sh|markdown|csv)/i.test(mime);

/** Everything the Drive card needs: who is connected, and their recent files. */
export async function driveAccount(ownerId) {
  const auth = await googleToken(ownerId).catch(() => null);
  if (!auth) {
    return {
      connected: false,
      source: null,
      error: 'paste a Google Drive access token (drive scope) in Studio settings, or set GOOGLE_DRIVE_TOKEN on this deployment',
    };
  }
  const about = await gd(auth.token, '/about?fields=user(displayName,emailAddress)');
  if (!about.ok) {
    return { connected: false, source: auth.source, error: `Google rejected the token (${about.status}${about.data?.error?.message ? `: ${about.data.error.message}` : ''})` };
  }
  const list = await gd(auth.token, '/files?pageSize=24&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,modifiedTime,size,webViewLink)&q=trashed%3Dfalse');
  const files = list.ok && Array.isArray(list.data?.files) ? list.data.files : [];
  return {
    connected: true,
    source: auth.source,
    email: about.data?.user?.emailAddress || null,
    name: about.data?.user?.displayName || null,
    canRead: true,
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedAt: f.modifiedTime || null,
      size: f.size ? Number(f.size) : null,
      url: f.webViewLink || `https://drive.google.com/open?id=${f.id}`,
      readable: f.mimeType === DOC || f.mimeType === SHEET || f.mimeType === SLIDES || isTextish(f.mimeType),
      kind: f.mimeType === DOC ? 'doc' : f.mimeType === SHEET ? 'sheet' : f.mimeType === SLIDES ? 'slides' : 'file',
    })),
    error: list.ok ? null : (list.data?.error?.message || 'the file list could not be read'),
  };
}

/**
 * A Doc, Sheet, Slides deck or plain text file as context text.
 * Google's own formats are exported to text; binaries are refused honestly.
 */
export async function readDriveFile(ownerId, { id } = {}) {
  const auth = await googleToken(ownerId);
  if (!auth) throw new StudioError(400, 'google_not_connected', 'connect Google Drive in Studio settings');
  const fileId = String(id || '').trim();
  if (!/^[\w-]{3,}$/.test(fileId)) throw new StudioError(400, 'drive_file_invalid', 'choose a Drive file');

  const meta = await gd(auth.token, `/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink`);
  if (!meta.ok) throw new StudioError(meta.status === 404 ? 404 : 502, 'drive_file_failed', meta.data?.error?.message || `Drive answered ${meta.status}`);
  const { name, mimeType, webViewLink } = meta.data;

  let text = '';
  if (mimeType === DOC || mimeType === SLIDES) {
    text = await gd(auth.token, `/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`, { raw: true });
  } else if (mimeType === SHEET) {
    text = await gd(auth.token, `/files/${encodeURIComponent(fileId)}/export?mimeType=text/csv`, { raw: true });
  } else if (isTextish(mimeType)) {
    text = await gd(auth.token, `/files/${encodeURIComponent(fileId)}?alt=media`, { raw: true });
  } else {
    throw new StudioError(400, 'drive_unsupported', `${name || 'that file'} is ${mimeType || 'a binary file'} — only Docs, Sheets, Slides and text files can be read as context`);
  }

  const trimmed = String(text);
  return {
    id: fileId,
    name: name || 'Drive file',
    mimeType,
    url: webViewLink || `https://drive.google.com/open?id=${fileId}`,
    text: trimmed.slice(0, DRIVE_LIMITS.maxText),
    truncated: trimmed.length > DRIVE_LIMITS.maxText,
    bytes: trimmed.length,
  };
}

function projectText(project, files) {
  const header = [
    project ? `# ${project.name}` : '# NEXORA project',
    project?.description ? `\n${project.description}` : '',
    project?.stack ? `\nstack: ${project.stack}` : '',
    '',
  ].join('\n');
  return `${header}\n${Object.entries(files).map(([path, body]) => `\n\n===== ${path} =====\n${body}`).join('')}`;
}

function multipart(metadata, mediaType, mediaBody) {
  const boundary = `nexora-${Math.random().toString(36).slice(2)}`;
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const part = `--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(part, 'utf8'), Buffer.from(mediaBody), Buffer.from(tail, 'utf8')]);
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

/**
 * Write the project back: one Google Doc with every file in it (readable,
 * searchable, shareable) or the same files as a .zip.
 */
export async function exportToDrive(ownerId, { project, files, name = '', as = 'doc', zipBase64 = null } = {}) {
  const auth = await googleToken(ownerId);
  if (!auth) throw new StudioError(400, 'google_not_connected', 'connect Google Drive in Studio settings');
  const safeName = String(name || project?.name || 'nexora project').slice(0, 80);
  const paths = files && typeof files === 'object' ? Object.keys(files) : [];
  if (as === 'zip' && !zipBase64) throw new StudioError(400, 'zip_required', 'the archive was not attached to the request');
  if (!paths.length && !zipBase64) throw new StudioError(400, 'files_required');
  if (paths.length > DRIVE_LIMITS.maxFiles) throw new StudioError(400, 'too_many_files', `a Drive export takes at most ${DRIVE_LIMITS.maxFiles} files`);

  const metadata = as === 'doc'
    ? { name: `${safeName}.txt`, mimeType: DOC, description: 'Exported from NEXORA Studio' }
    : { name: `${safeName}.zip`, mimeType: 'application/zip', description: 'Exported from NEXORA Studio' };

  const media = as === 'doc'
    ? { type: 'text/plain; charset=UTF-8', body: Buffer.from(projectText(project, files), 'utf8') }
    : (() => {
      const body = Buffer.from(String(zipBase64), 'base64');
      if (body.length > DRIVE_LIMITS.maxUpload) throw new StudioError(413, 'zip_too_large', 'the archive is too large for a Drive upload');
      return { type: 'application/zip', body };
    })();

  const { body, contentType } = multipart(metadata, media.type, media.body);
  const res = await gd(auth.token, '/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size', {
    method: 'POST',
    base: UPLOAD,
    body,
    contentType,
  });
  if (!res.ok) throw new StudioError(502, 'drive_upload_failed', res.data?.error?.message || `Drive answered ${res.status}`);

  return {
    provider: 'google',
    id: res.data.id,
    name: res.data.name,
    mimeType: res.data.mimeType,
    url: res.data.webViewLink || `https://drive.google.com/open?id=${res.data.id}`,
    as,
    files: paths.length,
    bytes: media.body.length,
  };
}

function mapDriveEntry(f) {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedAt: f.modifiedTime || null,
    size: f.size ? Number(f.size) : null,
    url: f.mimeType === DOC
      ? (f.webViewLink || `https://docs.google.com/document/d/${f.id}/edit`)
      : (f.webViewLink || `https://drive.google.com/open?id=${f.id}`),
    readable: f.mimeType === DOC || f.mimeType === SHEET || f.mimeType === SLIDES || isTextish(f.mimeType),
    kind: f.mimeType === DOC ? 'doc'
      : f.mimeType === SHEET ? 'sheet'
      : f.mimeType === SLIDES ? 'slides'
      : f.mimeType === FOLDER ? 'folder'
      : 'file',
  };
}

function escapeDriveQuery(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").slice(0, 120);
}

/** Search and browse Google Drive files with optional kind/folder filter. */
export async function searchDriveFiles(ownerId, { q = '', kind = 'all', folderId = '', pageSize = 30, pageToken = '' } = {}) {
  const auth = await googleToken(ownerId);
  if (!auth) throw new StudioError(400, 'google_not_connected', 'connect Google Drive first');
  const clauses = ['trashed=false'];
  const term = String(q || '').trim();
  if (term) clauses.push(`name contains '${escapeDriveQuery(term)}'`);
  if (kind === 'doc') clauses.push(`mimeType='${DOC}'`);
  else if (kind === 'sheet') clauses.push(`mimeType='${SHEET}'`);
  else if (kind === 'folder') clauses.push(`mimeType='${FOLDER}'`);
  if (folderId && /^[\w-]{3,}$/.test(folderId)) clauses.push(`'${escapeDriveQuery(folderId)}' in parents`);

  const params = new URLSearchParams({
    pageSize: String(Math.max(1, Math.min(60, Number(pageSize) || 30))),
    orderBy: 'modifiedTime desc',
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink)',
    q: clauses.join(' and '),
  });
  if (pageToken) params.set('pageToken', String(pageToken));
  const res = await gd(auth.token, `/files?${params.toString()}`);
  if (!res.ok) throw new StudioError(502, 'drive_list_failed', res.data?.error?.message || `Drive answered ${res.status}`);
  return {
    files: (Array.isArray(res.data?.files) ? res.data.files : []).map(mapDriveEntry),
    nextPageToken: res.data?.nextPageToken || null,
  };
}

/** Upload / create a file or folder in Google Drive, or rename / trash an existing file. */
export async function manageDriveFile(ownerId, { action, id = '', name = '', content = '', mimeType = 'text/plain', parentId = '', convertToDoc = false } = {}) {
  const auth = await googleToken(ownerId);
  if (!auth) throw new StudioError(400, 'google_not_connected', 'connect Google Drive first');
  const act = String(action || '').trim();

  if (act === 'rename') {
    if (!/^[\w-]{3,}$/.test(id)) throw new StudioError(400, 'drive_file_invalid');
    const clean = String(name || '').trim().slice(0, 140);
    if (!clean) throw new StudioError(400, 'name_required', 'enter a new file name');
    const res = await gd(auth.token, `/files/${encodeURIComponent(id)}?fields=id,name,mimeType,modifiedTime,size,webViewLink`, {
      method: 'PATCH',
      contentType: 'application/json',
      body: JSON.stringify({ name: clean }),
    });
    if (!res.ok) throw new StudioError(502, 'drive_rename_failed', res.data?.error?.message || `HTTP ${res.status}`);
    return { ok: true, file: mapDriveEntry(res.data) };
  }

  if (act === 'trash') {
    if (!/^[\w-]{3,}$/.test(id)) throw new StudioError(400, 'drive_file_invalid');
    const res = await gd(auth.token, `/files/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      contentType: 'application/json',
      body: JSON.stringify({ trashed: true }),
    });
    if (!res.ok) throw new StudioError(502, 'drive_delete_failed', res.data?.error?.message || `HTTP ${res.status}`);
    return { ok: true, id, trashed: true };
  }

  if (act === 'folder') {
    const clean = String(name || '').trim().slice(0, 120);
    if (!clean) throw new StudioError(400, 'name_required', 'enter a folder name');
    const meta = {
      name: clean,
      mimeType: FOLDER,
      ...(parentId && /^[\w-]{3,}$/.test(parentId) ? { parents: [parentId] } : {}),
    };
    const res = await gd(auth.token, '/files?fields=id,name,mimeType,modifiedTime,webViewLink', {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify(meta),
    });
    if (!res.ok) throw new StudioError(502, 'drive_folder_failed', res.data?.error?.message || `HTTP ${res.status}`);
    return { ok: true, file: mapDriveEntry(res.data) };
  }

  if (act === 'upload') {
    const clean = String(name || 'untitled.txt').trim().slice(0, 140);
    const bytes = Buffer.from(String(content ?? ''), 'utf8');
    if (bytes.length > DRIVE_LIMITS.maxUpload) throw new StudioError(413, 'file_too_large');
    const meta = {
      name: clean,
      ...(convertToDoc ? { mimeType: DOC } : {}),
      ...(parentId && /^[\w-]{3,}$/.test(parentId) ? { parents: [parentId] } : {}),
    };
    const { body, contentType } = multipart(meta, `${mimeType || 'text/plain'}; charset=UTF-8`, bytes);
    const res = await gd(auth.token, '/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,webViewLink', {
      method: 'POST',
      base: UPLOAD,
      body,
      contentType,
    });
    if (!res.ok) throw new StudioError(502, 'drive_upload_failed', res.data?.error?.message || `HTTP ${res.status}`);
    return { ok: true, file: mapDriveEntry(res.data) };
  }

  throw new StudioError(400, 'invalid_action', `Unknown Drive action: ${act}`);
}

/* =============================== Google Docs v1 =========================== */
function extractDocsBody(doc) {
  const blocks = Array.isArray(doc?.body?.content) ? doc.body.content : [];
  let endIndex = 1;
  const plainParts = [];
  const mdParts = [];

  for (const el of blocks) {
    if (typeof el.endIndex === 'number' && el.endIndex > endIndex) endIndex = el.endIndex;
    if (el.paragraph) {
      const runs = (el.paragraph.elements || [])
        .map((e) => e.textRun?.content || '')
        .join('');
      plainParts.push(runs);
      const style = el.paragraph.paragraphStyle?.namedStyleType || '';
      const line = runs.replace(/\n$/, '');
      if (!line.trim()) {
        mdParts.push('');
      } else if (style === 'TITLE' || style === 'HEADING_1') {
        mdParts.push(`# ${line}`);
      } else if (style === 'SUBTITLE' || style === 'HEADING_2') {
        mdParts.push(`## ${line}`);
      } else if (style === 'HEADING_3') {
        mdParts.push(`### ${line}`);
      } else if (el.paragraph.bullet) {
        const nesting = Number(el.paragraph.bullet.nestingLevel || 0);
        mdParts.push(`${'  '.repeat(nesting)}- ${line}`);
      } else {
        mdParts.push(line);
      }
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        const cells = (row.tableCells || []).map((cell) =>
          (cell.content || [])
            .map((c) => (c.paragraph?.elements || []).map((e) => e.textRun?.content || '').join('').trim())
            .filter(Boolean)
            .join(' '),
        );
        plainParts.push(cells.join('\t') + '\n');
        mdParts.push(`| ${cells.join(' | ')} |`);
      }
    }
  }
  const text = plainParts.join('').replace(/\n$/, '');
  const markdown = mdParts.join('\n').trim();
  return { text, markdown, endIndex };
}

/** Read a Google Doc via the Google Docs v1 API (with Drive export fallback). */
export async function readGoogleDoc(ownerId, { id } = {}) {
  const auth = await googleToken(ownerId);
  if (!auth) throw new StudioError(400, 'google_not_connected', 'connect Google Docs first');
  const docId = String(id || '').trim();
  if (!/^[\w-]{3,}$/.test(docId)) throw new StudioError(400, 'doc_id_invalid', 'provide a valid Google Doc ID');

  const res = await gd(auth.token, `/documents/${encodeURIComponent(docId)}`, { base: DOCS });
  if (res.ok && res.data?.documentId) {
    const { text, markdown, endIndex } = extractDocsBody(res.data);
    return {
      id: res.data.documentId,
      title: res.data.title || 'Untitled document',
      text: text.slice(0, DRIVE_LIMITS.maxText),
      markdown: markdown.slice(0, DRIVE_LIMITS.maxText),
      truncated: text.length > DRIVE_LIMITS.maxText,
      endIndex,
      revisionId: res.data.revisionId || null,
      url: `https://docs.google.com/document/d/${res.data.documentId}/edit`,
      source: 'docs_api',
    };
  }
  /* Fallback to Drive export when the token only carries drive.readonly/drive.file */
  if (res.status === 403) {
    const exported = await readDriveFile(ownerId, { id: docId });
    return {
      id: exported.id,
      title: exported.name,
      text: exported.text,
      markdown: exported.text,
      truncated: exported.truncated,
      endIndex: exported.text.length + 1,
      revisionId: null,
      url: `https://docs.google.com/document/d/${exported.id}/edit`,
      source: 'drive_export',
    };
  }
  throw new StudioError(res.status === 404 ? 404 : 502, 'docs_read_failed', res.data?.error?.message || `Google Docs answered ${res.status}`);
}

/** Create a new Google Doc via Docs v1 API (and insert initial content). */
export async function createGoogleDoc(ownerId, { title, content = '' } = {}) {
  const auth = await googleToken(ownerId);
  if (!auth) throw new StudioError(400, 'google_not_connected', 'connect Google Docs first');
  const docTitle = String(title || 'Untitled NEXORA Document').trim().slice(0, 140) || 'Untitled NEXORA Document';
  const bodyText = String(content || '').slice(0, DRIVE_LIMITS.maxText);

  const created = await gd(auth.token, '/documents', {
    method: 'POST',
    base: DOCS,
    contentType: 'application/json',
    body: JSON.stringify({ title: docTitle }),
  });

  if (created.ok && created.data?.documentId) {
    const documentId = created.data.documentId;
    if (bodyText) {
      const upd = await gd(auth.token, `/documents/${encodeURIComponent(documentId)}:batchUpdate`, {
        method: 'POST',
        base: DOCS,
        contentType: 'application/json',
        body: JSON.stringify({
          requests: [{ insertText: { location: { index: 1 }, text: bodyText } }],
        }),
      });
      if (!upd.ok) {
        throw new StudioError(502, 'docs_write_failed', upd.data?.error?.message || `HTTP ${upd.status}`);
      }
    }
    return {
      id: documentId,
      title: docTitle,
      url: `https://docs.google.com/document/d/${documentId}/edit`,
      characters: bodyText.length,
      source: 'docs_api',
    };
  }

  /* Fallback to Drive multipart document conversion when Docs API isn't enabled on GCP project */
  if (created.status === 403) {
    const { body, contentType } = multipart(
      { name: docTitle, mimeType: DOC, description: 'Created in NEXORA' },
      'text/plain; charset=UTF-8',
      Buffer.from(bodyText || ' ', 'utf8'),
    );
    const up = await gd(auth.token, '/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      base: UPLOAD,
      body,
      contentType,
    });
    if (!up.ok) throw new StudioError(502, 'docs_create_failed', up.data?.error?.message || `HTTP ${up.status}`);
    return {
      id: up.data.id,
      title: up.data.name || docTitle,
      url: up.data.webViewLink || `https://docs.google.com/document/d/${up.data.id}/edit`,
      characters: bodyText.length,
      source: 'drive_convert',
    };
  }

  throw new StudioError(502, 'docs_create_failed', created.data?.error?.message || `Google Docs answered ${created.status}`);
}

/** Edit an existing Google Doc (append, overwrite, or find-and-replace) via batchUpdate. */
export async function updateGoogleDoc(ownerId, { id, mode = 'overwrite', text = '', find = '', replaceWith = '', matchCase = false } = {}) {
  const auth = await googleToken(ownerId);
  if (!auth) throw new StudioError(400, 'google_not_connected', 'connect Google Docs first');
  const docId = String(id || '').trim();
  if (!/^[\w-]{3,}$/.test(docId)) throw new StudioError(400, 'doc_id_invalid', 'provide a valid Google Doc ID');

  if (mode === 'replace') {
    const needle = String(find || '');
    if (!needle) throw new StudioError(400, 'find_required', 'enter text to find');
    const res = await gd(auth.token, `/documents/${encodeURIComponent(docId)}:batchUpdate`, {
      method: 'POST',
      base: DOCS,
      contentType: 'application/json',
      body: JSON.stringify({
        requests: [{
          replaceAllText: {
            containsText: { text: needle, matchCase: Boolean(matchCase) },
            replaceText: String(replaceWith ?? ''),
          },
        }],
      }),
    });
    if (!res.ok) throw new StudioError(502, 'docs_update_failed', res.data?.error?.message || `HTTP ${res.status}`);
    const changed = res.data?.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;
    return { id: docId, mode: 'replace', occurrencesChanged: changed, url: `https://docs.google.com/document/d/${docId}/edit` };
  }

  const nextText = String(text ?? '').slice(0, DRIVE_LIMITS.maxText);
  const current = await gd(auth.token, `/documents/${encodeURIComponent(docId)}`, { base: DOCS });
  if (current.ok && current.data?.documentId) {
    const { endIndex } = extractDocsBody(current.data);
    const requests = [];
    if (mode === 'append') {
      const insertAt = Math.max(1, endIndex - 1);
      const prefix = insertAt > 1 && !nextText.startsWith('\n') ? '\n' : '';
      if (prefix + nextText) {
        requests.push({ insertText: { location: { index: insertAt }, text: prefix + nextText } });
      }
    } else {
      if (endIndex > 2) {
        requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
      }
      if (nextText) {
        requests.push({ insertText: { location: { index: 1 }, text: nextText } });
      }
    }
    if (requests.length) {
      const upd = await gd(auth.token, `/documents/${encodeURIComponent(docId)}:batchUpdate`, {
        method: 'POST',
        base: DOCS,
        contentType: 'application/json',
        body: JSON.stringify({ requests }),
      });
      if (!upd.ok) throw new StudioError(502, 'docs_update_failed', upd.data?.error?.message || `HTTP ${upd.status}`);
    }
    return {
      id: docId,
      title: current.data.title || 'Document',
      mode,
      characters: nextText.length,
      url: `https://docs.google.com/document/d/${docId}/edit`,
      source: 'docs_api',
    };
  }

  /* Fallback to Drive media upload update if token only has drive scope */
  if (current.status === 403) {
    let payload = nextText;
    if (mode === 'append') {
      const existing = await readDriveFile(ownerId, { id: docId });
      payload = existing.text ? `${existing.text}\n${nextText}` : nextText;
    }
    const upd = await gd(auth.token, `/files/${encodeURIComponent(docId)}?uploadType=media&fields=id,name,webViewLink`, {
      method: 'PATCH',
      base: UPLOAD,
      contentType: 'text/plain; charset=UTF-8',
      body: Buffer.from(payload, 'utf8'),
    });
    if (!upd.ok) throw new StudioError(502, 'docs_update_failed', upd.data?.error?.message || `HTTP ${upd.status}`);
    return {
      id: docId,
      title: upd.data?.name || 'Document',
      mode,
      characters: payload.length,
      url: upd.data?.webViewLink || `https://docs.google.com/document/d/${docId}/edit`,
      source: 'drive_media',
    };
  }

  throw new StudioError(502, 'docs_update_failed', current.data?.error?.message || `Google Docs answered ${current.status}`);
}
