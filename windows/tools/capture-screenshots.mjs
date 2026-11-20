#!/usr/bin/env node
/* ==========================================================================
   NEXORA AI — Store screenshot helper (real UI only)
   --------------------------------------------------------------------------
   Opens a visible browser at the production app, lets you sign in and navigate
   manually, and captures exactly sized screenshots when you press Enter.
   It does not seed fake data and does not mock the backend.

   Usage:
     npm i -D playwright && npx playwright install chromium
     node windows/tools/capture-screenshots.mjs --out windows/store/screenshots \
       --width 1366 --height 768 --count 4
   Options:
     --url     app URL (default https://nexora-social-2026.vercel.app/)
     --out     output folder (default windows/store/screenshots)
     --width   viewport width (default 1366)
     --height  viewport height (default 768)
     --count   number of shots (default 4)
   ========================================================================== */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import readline from 'node:readline/promises';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const url = opt('url', 'https://nexora-social-2026.vercel.app/');
const outDir = resolve(process.cwd(), opt('out', 'windows/store/screenshots'));
const width = Number(opt('width', '1366'));
const height = Number(opt('height', '768'));
const count = Math.max(1, Math.min(12, Number(opt('count', '4'))));

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run:\n  npm i -D playwright\n  npx playwright install chromium');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  locale: 'ar',
});
const page = await context.newPage();

console.log(`Opening ${url}`);
console.log(`Capture size: ${width}×${height} · screenshots: ${count}`);
console.log('Sign in manually. Do not use fake data or another person’s account.');
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
try {
  for (let i = 1; i <= count; i += 1) {
    await rl.question(`\n[${i}/${count}] Navigate to the screen to capture, then press Enter… `);
    await page.waitForTimeout(600);
    const file = resolve(outDir, `${String(i).padStart(2, '0')}-nexora-${width}x${height}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`Saved ${file}`);
  }
} finally {
  await rl.close();
  await browser.close();
}

console.log(`\nDone. Review every image for personal data and secrets before uploading to Partner Center.`);
