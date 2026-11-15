#!/usr/bin/env node
/* ============================================================================
   NEXORA Studio — verify the GitHub integration for real
   ----------------------------------------------------------------------------
   Creates a throw-away repository, pushes a tiny project through the same code
   path the Publish tab uses, reads one file back from GitHub, then deletes the
   repository again.

     GITHUB_TOKEN=... node scripts/studio-verify-github.mjs
   ============================================================================ */

import { pushToGitHub, githubStatus } from '../api/_lib/studio/deploy.js';

const token = process.env.GITHUB_STUDIO_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  console.error('GITHUB_TOKEN is required');
  process.exit(2);
}

/* Mode A (default): create a throw-away repository.
   Mode B (VERIFY_MODE=branch): push an orphan branch into an existing repo the
   token can write to (useful with fine-grained installation tokens that cannot
   create repositories), then delete the branch. */
const branchMode = process.env.VERIFY_MODE === 'branch';
const repo = process.env.VERIFY_REPO || (branchMode ? 'nexora-social-2026' : `nexora-studio-verify-${Date.now().toString(36)}`);
const branch = branchMode ? `studio-verify-${Date.now().toString(36)}` : 'main';
const files = {
  'index.html': '<!doctype html><html><body><h1>NEXORA Studio verify</h1></body></html>',
  'src/app.js': 'console.log("verified");\n',
  'README.md': '# verification\n',
};

const status = await githubStatus('dev');
console.log('github account :', status.connected ? status.login : 'not connected');

const result = await pushToGitHub('dev', {
  files,
  repoName: repo,
  branch,
  isPrivate: true,
  message: 'NEXORA Studio integration verification',
  projectName: repo,
});
console.log('pushed         :', result.repo, '·', result.files, 'files ·', result.url);
console.log('commit         :', result.commitUrl);

const [owner] = result.repo.split('/');
const check = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/src/app.js?ref=${encodeURIComponent(branch)}`, {
  headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'NEXORA-Studio' },
});
if (!check.ok) {
  console.error('could not read the pushed file back:', check.status);
  process.exit(1);
}
const body = await check.json();
const content = Buffer.from(body.content, 'base64').toString('utf8');
if (!content.includes('verified')) {
  console.error('pushed content does not match');
  process.exit(1);
}
console.log('read back      : ok (src/app.js)');

if (branchMode) {
  if (process.env.KEEP_REPO !== '1') {
    const del = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'NEXORA-Studio' },
    });
    console.log('cleanup        :', del.status === 204 ? `branch ${branch} deleted` : 'branch delete failed (' + del.status + ')');
  } else {
    console.log('cleanup        : kept branch', branch);
  }
} else if (process.env.KEEP_REPO !== '1') {
  const del = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'NEXORA-Studio' },
  });
  console.log('cleanup        :', del.status === 204 ? 'repository deleted' : 'delete failed (' + del.status + ')');
} else {
  console.log('cleanup        : kept', result.url);
}
