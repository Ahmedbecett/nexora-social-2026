import test from 'node:test';
import assert from 'node:assert/strict';

/* The GitHub layer talks to api.github.com through the global fetch, so the
   whole flow can be exercised with a fake API — no network, no token. */
process.env.GITHUB_STUDIO_TOKEN = 'test-token';
delete process.env.GITHUB_TOKEN;
delete process.env.GH_TOKEN;

const { githubImport, githubPushBranch, filterRepoTree } = await import('../api/_lib/studio/deploy.js');

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function mountFetch(routes) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    calls.push(`${method} ${url}`);
    const key = `${method} ${url}`;
    const handler = routes[key] || routes[`${method} ${url.split('?')[0]}`];
    if (!handler) return json({ message: `unexpected ${key}` }, 404);
    return handler(init.body ? JSON.parse(init.body) : null);
  };
  return calls;
}

test('the repository tree keeps source files and counts what it dropped', () => {
  const { kept, skipped } = filterRepoTree([
    { path: 'src/App.jsx', type: 'blob', sha: 'a', size: 120 },
    { path: 'README.md', type: 'blob', sha: 'b', size: 40 },
    { path: 'node_modules/react/index.js', type: 'blob', sha: 'c', size: 10 },
    { path: 'assets/logo.png', type: 'blob', sha: 'd', size: 900 },
    { path: 'package-lock.json', type: 'blob', sha: 'e', size: 10 },
    { path: 'huge.js', type: 'blob', sha: 'f', size: 900_000 },
    { path: 'src', type: 'tree', sha: 'g' },
  ]);
  assert.deepEqual(kept.map((f) => f.path), ['src/App.jsx', 'README.md']);
  assert.equal(skipped.binary, 3, 'node_modules, the image and the lockfile are not source');
  assert.equal(skipped.tooBig, 1);
  assert.equal(skipped.directories, 1);
});

test('opening a repository downloads its editable files', async () => {
  const body = '<h1>hi</h1>';
  const calls = mountFetch({
    'GET https://api.github.com/repos/me/repo': () => json({ default_branch: 'main', private: true }),
    'GET https://api.github.com/repos/me/repo/git/trees/main': () => json({
      tree: [
        { path: 'index.html', type: 'blob', sha: 's1', size: body.length },
        { path: 'src/app.js', type: 'blob', sha: 's2', size: 4 },
        { path: 'logo.png', type: 'blob', sha: 's3', size: 90 },
      ],
    }),
    'GET https://api.github.com/repos/me/repo/git/blobs/s1': () => json({ content: Buffer.from(body).toString('base64'), encoding: 'base64' }),
    'GET https://api.github.com/repos/me/repo/git/blobs/s2': () => json({ content: Buffer.from('let a').toString('base64'), encoding: 'base64' }),
  });

  const out = await githubImport('dev', { repo: 'me/repo' });
  assert.equal(out.repo, 'me/repo');
  assert.equal(out.ref, 'main');
  assert.equal(out.private, true);
  assert.deepEqual(Object.keys(out.files).sort(), ['index.html', 'src/app.js']);
  assert.equal(out.files['index.html'], body);
  assert.ok(calls.some((c) => c.includes('/git/blobs/s1')), 'files really come from the blob API');

  await assert.rejects(() => githubImport('dev', { repo: 'not a repo' }), (e) => e.code === 'github_repo_invalid');
});

test('committing to a branch opens a real pull request', async () => {
  const calls = mountFetch({
    'GET https://api.github.com/repos/me/repo': () => json({ default_branch: 'main' }),
    'GET https://api.github.com/repos/me/repo/git/ref/heads/main': () => json({ object: { sha: 'base-sha' } }),
    'GET https://api.github.com/repos/me/repo/git/ref/heads/nexora/fix': () => json({ message: 'Not Found' }, 404),
    'POST https://api.github.com/repos/me/repo/git/blobs': (b) => json({ sha: `blob-${b.content.length}` }),
    'POST https://api.github.com/repos/me/repo/git/trees': () => json({ sha: 'tree-sha' }),
    'POST https://api.github.com/repos/me/repo/git/commits': () => json({ sha: 'commit-sha', html_url: 'https://github.com/me/repo/commit/commit-sha' }),
    'POST https://api.github.com/repos/me/repo/git/refs': () => json({ ref: 'refs/heads/nexora/fix' }),
    'POST https://api.github.com/repos/me/repo/pulls': () => json({ number: 7, html_url: 'https://github.com/me/repo/pull/7' }),
  });

  const out = await githubPushBranch('dev', {
    repo: 'me/repo',
    files: { 'index.html': '<h1>x</h1>' },
    branch: 'nexora/fix',
    base: 'main',
    message: 'from the test',
  });

  assert.equal(out.branch, 'nexora/fix');
  assert.equal(out.base, 'main');
  assert.equal(out.commitSha, 'commit-sha');
  assert.deepEqual(out.pull, { number: 7, url: 'https://github.com/me/repo/pull/7' });
  assert.ok(calls.includes('POST https://api.github.com/repos/me/repo/pulls'), 'a pull request is opened');
  assert.ok(!calls.some((c) => c.includes('/user/repos')), 'no repository is created');

  await assert.rejects(
    () => githubPushBranch('dev', { repo: 'me/repo', files: {} }),
    (e) => e.code === 'files_required',
  );
});

test('an existing pull request does not turn a good push into a failure', async () => {
  mountFetch({
    'GET https://api.github.com/repos/me/repo': () => json({ default_branch: 'main' }),
    'GET https://api.github.com/repos/me/repo/git/ref/heads/main': () => json({ object: { sha: 'base-sha' } }),
    'GET https://api.github.com/repos/me/repo/git/ref/heads/nexora/fix': () => json({ object: { sha: 'old' } }),
    'POST https://api.github.com/repos/me/repo/git/blobs': () => json({ sha: 'blob' }),
    'POST https://api.github.com/repos/me/repo/git/trees': () => json({ sha: 'tree' }),
    'POST https://api.github.com/repos/me/repo/git/commits': () => json({ sha: 'commit' }),
    'PATCH https://api.github.com/repos/me/repo/git/refs/heads/nexora/fix': () => json({ ref: 'refs/heads/nexora/fix' }),
    'POST https://api.github.com/repos/me/repo/pulls': () => json({ message: 'A pull request already exists' }, 422),
  });

  const out = await githubPushBranch('dev', {
    repo: 'me/repo', files: { 'a.txt': 'x' }, branch: 'nexora/fix', base: 'main',
  });
  assert.equal(out.pull, null);
  assert.equal(out.branch, 'nexora/fix');
});
