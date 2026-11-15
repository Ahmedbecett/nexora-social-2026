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

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const DOC = 'application/vnd.google-apps.document';
const SHEET = 'application/vnd.google-apps.spreadsheet';
const SLIDES = 'application/vnd.google-apps.presentation';

export const DRIVE_LIMITS = { maxText: 180_000, maxFiles: 150, maxUpload: 6_000_000 };

export async function googleToken(ownerId) {
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
