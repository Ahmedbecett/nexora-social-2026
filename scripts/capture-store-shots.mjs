#!/usr/bin/env node
/**
 * يلتقط 20 لقطة شاشة حقيقية من واجهة التطبيق (لا صور مرسومة) بمقاس 1080×1920.
 *
 * مهم: التطبيق اليوم هو لوحة NEXORA AI فقط — App.jsx لا يُثبّت شاشات التواصل
 * الاجتماعي القديمة (feed/reels/messages)، فهي محفوظة في المستودع للمرجع فقط.
 * لذلك تُصوَّر شاشات لوحة AI الحقيقية + شاشات المصادقة + الإعدادات + الحساب.
 *
 * كيف يعمل:
 *   1. يُقدَّم بناء الإنتاج عبر `vite preview` (بورت 4173).
 *   2. يُزرَع localStorage برمز وهمي لعبور شاشة الدخول.
 *   3. تُعترَض كل نداءات /api/** وتُرجَع بيانات ثابتة ⟹ لا كتابة في قاعدة الإنتاج.
 *   4. تُصوَّر الشاشات بنافذة 1080×1920.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4173';
const OUT = 'store/capture';
const W = 1080, H = 1920;

const ME = {
  id: 12, username: 'ahmed_becetti', fullName: 'Ahmed Becetti',
  email: 'demo@example.com', phone: null, avatarUrl: null, verified: true,
  isPrivate: false, bio: 'Building things with AI', website: 'nexora-social-2026.vercel.app',
  followers: 4812, following: 216, posts: 128,
};

const CONVS = [
  { id: 1, title: 'Startup ideas list', messages: 6 },
  { id: 2, title: 'Trip plan — Lisbon', messages: 12 },
  { id: 3, title: 'Fix my CSS grid', messages: 4 },
  { id: 4, title: 'Voice notes transcript', messages: 9 },
];

const AI_TEXT = 'Here are three you can ship:\n1. A voice revision coach for students\n2. An interview practice platform\n3. Automatic lecture summaries';

function respond(pathname, method) {
  const p = pathname.replace(/^\/api\//, '').replace(/\?.*$/, '');
  if (/^auth\/me/.test(p)) return { user: ME };
  if (/^auth\/(login|register)/.test(p)) return { token: 'demo-token', user: ME };
  if (/^ai\/conversations/.test(p)) return { conversations: CONVS };
  if (/^ai/.test(p)) {
    if (method === 'GET') return { messages: [{ role: 'user', content: 'Startup ideas for education?' }, { role: 'assistant', content: AI_TEXT }] };
    return { reply: AI_TEXT, conversationId: 1 };
  }
  if (/^credits/.test(p)) return { credits: 100 };
  if (/^client-errors/.test(p)) return { ok: true };
  return {};
}

async function waitForServer(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return true; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('vite preview did not start');
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], {
    stdio: 'inherit', env: { ...process.env },
  });
  await waitForServer(BASE + '/');

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'dark',
  });

  await ctx.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(respond(url.pathname, route.request().method())),
    });
  });
  await ctx.route('**://nexora-social-2026.vercel.app/**', (r) => r.abort());

  const seed = (lang) => {
    localStorage.setItem('nx_token', 'demo-token');
    localStorage.setItem('nx_me', JSON.stringify(ME));
    localStorage.setItem('nx_accounts', JSON.stringify([
      { id: ME.id, username: ME.username, fullName: ME.fullName, avatarUrl: null, verified: true, token: 'demo-token' },
    ]));
    localStorage.setItem('nx_lang', lang || 'en');
    localStorage.setItem('nx_theme', 'dark');
    localStorage.setItem('nx_ai_unlocked', '1');
  };
  await ctx.addInitScript(`(${seed.toString()})('en');`);

  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 140)));

  const shots = [];
  const snap = async (name) => {
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    shots.push(name);
    console.log('captured ' + name);
  };

  const click = async (text, { exact = false } = {}) => {
    const sels = [
      `button:has-text("${text}")`,
      `[aria-label="${text}"]`,
      `text=${text}`,
    ];
    for (const sel of sels) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() && await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 3000 }); await page.waitForTimeout(1100); return true;
        }
      } catch { /* try next */ }
    }
    console.log('  [miss]', text);
    return false;
  };

  const setLang = async (lang) => {
    await page.evaluate((l) => { localStorage.setItem('nx_lang', l); }, lang);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  };

  /* ---------- 1–3: المصادقة (بدون جلسة) ---------- */
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await snap('01-sign-in');

  // قائمة اللغة على شاشة الدخول
  if (await click('English')) { await snap('02-sign-in-language'); await page.keyboard.press('Escape').catch(() => {}); }

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (await click('Sign up.')) await snap('03-create-account');

  /* ---------- 4+: لوحة AI الحقيقية ---------- */
  await page.evaluate(([me]) => {
    localStorage.setItem('nx_token', 'demo-token');
    localStorage.setItem('nx_me', JSON.stringify(me));
    localStorage.setItem('nx_accounts', JSON.stringify([
      { id: me.id, username: me.username, fullName: me.fullName, avatarUrl: null, verified: true, token: 'demo-token' },
    ]));
    localStorage.setItem('nx_lang', 'en');
    localStorage.setItem('nx_theme', 'dark');
    localStorage.setItem('nx_ai_unlocked', '1');
  }, [ME]);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await snap('04-ai-workspace');

  // أدوات AI الست — كل زر يُصوَّر
  const tools = ['Chat', 'Images', 'Writing', 'Code', 'Translation', 'Summaries'];
  let n = 5;
  for (const tool of tools) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    if (await click(tool)) {
      await snap(String(n).padStart(2, '0') + '-ai-' + tool.toLowerCase());
      n++;
    }
    if (n > 9) break;
  }

  // محادثة فعلية مع الرد
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  try {
    const field = page.locator('textarea, input[type="text"]').first();
    if (await field.count()) {
      await field.click();
      await field.fill('Startup ideas for education?');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2600);
      await snap('10-ai-conversation');
    }
  } catch (e) { console.log('  [chat]', String(e).slice(0, 90)); }

  // نافذة الحساب والأمان
  try {
    const acc = page.locator('[title*="الحساب"], [title*="ccount"]').first();
    if (await acc.count()) { await acc.click(); await page.waitForTimeout(1400); await snap('11-account-sheet'); }
  } catch { /* skip */ }

  // الإعدادات
  if (await click('Settings')) await snap('12-settings');
  if (await click('Theme')) await snap('13-theme');
  if (await click('Language')) await snap('14-language');

  // لوحة بالعربية (RTL) — التطبيق يدعمها فعليًا
  await page.evaluate(() => localStorage.setItem('nx_lang', 'ar'));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await snap('15-ai-workspace-arabic');

  await click('توليد الصور').catch(() => {});
  await snap('16-ai-image-arabic');
  await click('المحادثة الذكية').catch(() => {});
  await snap('17-ai-chat-arabic');

  // لغات أخرى (مترجمة فعليًا في التطبيق)
  for (const [i, code] of [[18, 'fr'], [19, 'es']]) {
    await page.evaluate((l) => localStorage.setItem('nx_lang', l), code);
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2600);
    await snap(`${i}-ai-workspace-${code}`);
  }

  // العودة للإنجليزية + الشاشة النهائية
  await page.evaluate(() => localStorage.setItem('nx_lang', 'en'));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  await snap('20-ai-workspace-final');

  await browser.close();
  server.kill('SIGTERM');
  console.log('\ncaptured ' + shots.length + ' screens → ' + OUT);
  if (shots.length < 20) console.log('WARNING: fewer than 20 screens captured');
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
