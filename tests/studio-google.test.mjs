import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_DRIVE_TOKEN = 'test-token';
delete process.env.GOOGLE_STUDIO_TOKEN;
delete process.env.GOOGLE_ACCESS_TOKEN;

const { driveAccount, readDriveFile, exportToDrive } = await import('../api/_lib/studio/google.js');
const { sanitizeDocs } = await import('../api/_lib/studio/files.js');
const { attachDocs } = await import('../api/_lib/studio/agent.js');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function text(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

function mountFetch(routes) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    calls.push({ method, url, body: init.body, headers: init.headers || {} });
    const bare = url.split('?')[0];
    const handler = routes[`${method} ${url}`] || routes[`${method} ${bare}`];
    if (!handler) return json({ error: { message: `unexpected ${method} ${url}` } }, 404);
    return handler(init.body, init);
  };
  return calls;
}

const DOC = 'application/vnd.google-apps.document';
const SHEET = 'application/vnd.google-apps.spreadsheet';

test('the Drive account lists readable documents and skips binaries', async () => {
  mountFetch({
    'GET https://www.googleapis.com/drive/v3/about': () => json({ user: { displayName: 'Ahmed', emailAddress: 'a@example.com' } }),
    'GET https://www.googleapis.com/drive/v3/files': () => json({
      files: [
        { id: 'doc1', name: 'Product brief', mimeType: DOC, modifiedTime: '2026-01-01T00:00:00Z', webViewLink: 'https://docs.google.com/document/d/doc1' },
        { id: 'txt1', name: 'notes.md', mimeType: 'text/markdown', webViewLink: 'https://drive.google.com/open?id=txt1' },
        { id: 'img1', name: 'shot.png', mimeType: 'image/png' },
      ],
    }),
  });

  const account = await driveAccount('dev');
  assert.equal(account.connected, true);
  assert.equal(account.email, 'a@example.com');
  assert.deepEqual(account.files.map((f) => f.id), ['doc1', 'txt1', 'img1']);
  assert.equal(account.files[0].kind, 'doc');
  assert.equal(account.files[0].readable, true);
  assert.equal(account.files[2].readable, false, 'a png is not context');
});

test('a Google Doc and a Sheet are exported to text, a binary is refused', async () => {
  mountFetch({
    'GET https://www.googleapis.com/drive/v3/files/doc1': () => json({ id: 'doc1', name: 'Brief', mimeType: DOC }),
    'GET https://www.googleapis.com/drive/v3/files/doc1/export': () => text('We sell lamps. Tone: warm.'),
    'GET https://www.googleapis.com/drive/v3/files/sheet1': () => json({ id: 'sheet1', name: 'Prices', mimeType: SHEET }),
    'GET https://www.googleapis.com/drive/v3/files/sheet1/export': () => text('sku,price\nL1,20'),
    'GET https://www.googleapis.com/drive/v3/files/img1': () => json({ id: 'img1', name: 'shot.png', mimeType: 'image/png' }),
  });

  const doc = await readDriveFile('dev', { id: 'doc1' });
  assert.equal(doc.name, 'Brief');
  assert.match(doc.text, /We sell lamps/);
  assert.equal(doc.truncated, false);

  const sheet = await readDriveFile('dev', { id: 'sheet1' });
  assert.match(sheet.text, /sku,price/);

  await assert.rejects(() => readDriveFile('dev', { id: 'img1' }), (e) => e.code === 'drive_unsupported');
  await assert.rejects(() => readDriveFile('dev', { id: 'x' }), (e) => e.code === 'drive_file_invalid');
});

test('the project is written to Drive as a convertible Google Doc', async () => {
  const calls = mountFetch({
    'POST https://www.googleapis.com/upload/drive/v3/files': () => json({
      id: 'new1', name: 'shop.txt', mimeType: DOC, webViewLink: 'https://docs.google.com/document/d/new1', size: '42',
    }),
  });

  const out = await exportToDrive('dev', {
    project: { name: 'shop', stack: 'static' },
    files: { 'index.html': '<h1>shop</h1>', 'app.js': 'go()' },
    as: 'doc',
  });

  assert.equal(out.url, 'https://docs.google.com/document/d/new1');
  assert.equal(out.files, 2);
  const post = calls.find((c) => c.method === 'POST');
  assert.match(String(post.headers['Content-Type']), /multipart\/related; boundary=/);
  const body = String(post.body);
  assert.match(body, /application\/vnd\.google-apps\.document/, 'Drive is asked to convert the text into a Doc');
  assert.match(body, /index\.html/, 'every file path is in the document');
  assert.match(body, /<h1>shop<\/h1>/, 'and its content');
});

test('a zip export is uploaded as an archive and size is bounded', async () => {
  const calls = mountFetch({
    'POST https://www.googleapis.com/upload/drive/v3/files': () => json({ id: 'z1', name: 'shop.zip', mimeType: 'application/zip', webViewLink: 'https://drive.google.com/file/d/z1' }),
  });

  const zip = Buffer.from('PK\u0003\u0004fake').toString('base64');
  const out = await exportToDrive('dev', { project: { name: 'shop' }, files: {}, as: 'zip', zipBase64: zip });
  assert.equal(out.as, 'zip');
  assert.match(out.url, /drive\.google\.com/);
  assert.match(String(calls[0].body), /application\/zip/);

  await assert.rejects(
    () => exportToDrive('dev', { project: { name: 's' }, files: {}, as: 'zip' }),
    (e) => e.code === 'zip_required',
  );
});

test('attached documents are sanitised and become part of the prompt', () => {
  const docs = sanitizeDocs([
    { name: 'Brief', url: 'https://docs.google.com/document/d/1', text: 'Arabic copy: أهلاً بكم' },
    { name: 'Empty', text: '   ' },
    { name: 'Bad link', url: 'javascript:alert(1)', text: 'x' },
    { name: 'Big', text: 'a'.repeat(50_000) },
    { name: 'Fourth', text: 'ignored' },
  ]);
  assert.equal(docs.length, 3, 'at most three documents');
  assert.equal(docs[1].url, '', 'non-https links are dropped');
  assert.equal(docs[2].text.length, 24_000, 'long text is trimmed');

  const prompt = attachDocs('build the page', docs);
  assert.match(prompt, /أهلاً بكم/);
  assert.match(prompt, /Reference material/);
  assert.equal(attachDocs('plain', []), 'plain', 'an empty list changes nothing');
});
