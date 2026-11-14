#!/usr/bin/env node
/**
 * لقطات شاشة حقيقية من التطبيق — 20 صورة، 1080×1920 بالضبط.
 *
 * الطريقة: يُقدَّم بناء الإنتاج عبر vite preview، ويُشغَّل Chromium حقيقي
 * بعرض 540 CSS px وكثافة 2x ⟹ صورة 1080×1920 مطابقة تمامًا.
 * تُعترَض كل نداءات /api/** ببيانات ثابتة، فلا تُكتب أي بيانات إنتاجية.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4173';
const OUT = 'store/capture';
const CHROME = process.env.CHROME_PATH || '/tmp/pw/chromium';
const VW = 540, VH = 960, DPR = 2;   // ⟹ 1080×1920

const ME = { id: 12, username: 'ahmed_becetti', fullName: 'Ahmed Becetti', email: 'demo@example.com',
  phone: null, avatarUrl: null, verified: true, isPrivate: false, bio: 'Building things with AI',
  website: 'nexora-social-2026.vercel.app', followers: 4812, following: 216, posts: 128 };

const CONVS = [
  { id: 1, title: 'Startup ideas list', messages: 6 },
  { id: 2, title: 'Trip plan — Lisbon', messages: 12 },
  { id: 3, title: 'Fix my CSS grid', messages: 4 },
];
const AI_TEXT = 'Three you can ship:\n1. A voice revision coach for students\n2. An interview practice platform\n3. Automatic lecture summaries';

const api = (p, method) => {
  if (/^(auth\/)?me$/.test(p)) return { user: ME };
  if (/^conversations/.test(p)) return { conversations: CONVS };
  if (/^auth\/(login|register)/.test(p)) return { token: 'demo-token', user: ME };
  if (/^ai\/conversations/.test(p)) return { conversations: CONVS };
  if (/^ai/.test(p)) return method === 'GET'
    ? { messages: [{ role: 'user', content: 'Startup ideas for education?' }, { role: 'assistant', content: AI_TEXT }] }
    : { reply: AI_TEXT, conversationId: 1 };
  if (/^credits/.test(p)) return { credits: 100 };
  return {};
};

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'] });
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH }, deviceScaleFactor: DPR,
    locale: 'en-US', colorScheme: 'dark', isMobile: true, hasTouch: true,
  });
  // التطبيق يستدعي https://nexora-social-2026.vercel.app/api/... لأن VITE_WEB_URL
  // مُضمَّن وقت البناء، لذا نعترض كل مسار /api/ على أي مضيف ونخدمه محليًا.
  const serveApi = async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^\/api\//, '').replace(/\?.*$/, '');
    if (/^ai\/stream/.test(p)) {
      let acc = '';
      let body = 'data: ' + JSON.stringify({ type: 'start', conversationId: 1 }) + '\n\n';
      for (const w of AI_TEXT.split(' ')) {
        acc += (acc ? ' ' : '') + w;
        body += 'data: ' + JSON.stringify({ type: 'delta', text: acc }) + '\n\n';
      }
      body += 'data: ' + JSON.stringify({ type: 'done', answer: AI_TEXT, conversationId: 1,
        provider: 'openai', model: 'gpt-5-nano' }) + '\n\n';
      return route.fulfill({ status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }, body });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(api(p, route.request().method())) });
  };
  await ctx.route('**/api/**', serveApi);

  // لا طلبات خارجية أخرى (خطوط، تحليلات)
  await ctx.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await ctx.route('**://fonts.gstatic.com/**', (r) => r.abort());

  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 100)));

  const taken = [];
  const snap = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    const sz = fs.statSync(path.join(OUT, name + '.png')).size;
    taken.push(name);
    console.log('  ✓ ' + name + '  (' + Math.round(sz / 1024) + ' KB)');
  };
  const goto = async (ms = 2400) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(ms);
  };
  const click = async (text) => {
    for (const sel of [`button:has-text("${text}")`, `[aria-label="${text}"]`, `text=${text}`]) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() && await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 3000 }); await page.waitForTimeout(1200); return true;
        }
      } catch { /* next */ }
    }
    return false;
  };
  const seed = (lang = 'en', authed = true) => page.evaluate(([me, l, a]) => {
    if (a) {
      localStorage.setItem('nx_token', 'demo-token');
      localStorage.setItem('nx_me', JSON.stringify(me));
      localStorage.setItem('nx_accounts', JSON.stringify([{ id: me.id, username: me.username,
        fullName: me.fullName, avatarUrl: null, verified: true, token: 'demo-token' }]));
    } else localStorage.clear();
    localStorage.setItem('nx_lang', l);
    localStorage.setItem('nx_theme', 'dark');
    localStorage.setItem('nx_ai_unlocked', '1');
  }, [ME, lang, authed]);

  /* ---------- 1–4: المصادقة (حقيقية، بلا جلسة) ---------- */
  await goto();
  await seed('en', false);
  await goto(2800);
  await snap('01-login');

  if (await click('English')) { await snap('02-login-language-list'); await page.keyboard.press('Escape').catch(() => {}); }

  await goto();
  if (await click('Sign up.')) await snap('03-create-account');

  await goto();
  if (await click('Continue with phone number')) await snap('04-phone-signup');

  /* ---------- 5–20: لوحة AI الحقيقية ---------- */
  await seed('en', true);
  await goto(3000);
  await snap('05-ai-workspace');

  // أزرار الأدوات بأسمائها الفعلية (واجهة اللوحة عربية دائمًا)
  const toolShots = [
    ['06-tool-chat', 'المحادثة الذكية'],
    ['07-tool-images', 'توليد الصور'],
    ['08-tool-writing', 'الكتابة والإبداع'],
    ['09-tool-code', 'مساعد البرمجة'],
    ['10-tool-translation', 'الترجمة'],
    ['11-tool-summaries', 'تلخيص النصوص'],
  ];
  for (const [name, label] of toolShots) {
    await goto(2200);
    // محددات CSS مباشرة أدق من النص العربي (التشكيل وعلامات التحكم تمنع المطابقة)
    const idx = toolShots.findIndex(([n]) => n === name);
    let clicked = false;
    try {
      const tool = page.locator('.nx-ai-tool').nth(idx);
      if (await tool.count()) { await tool.click({ timeout: 3000 }); await page.waitForTimeout(1200); clicked = true; }
    } catch { /* fallback */ }
    if (!clicked) clicked = await click(label);
    if (clicked) await snap(name);
    else console.log('  [skip]', name);
  }

  // محادثة فعلية
  await goto(2400);
  try {
    const f = page.locator('textarea').first();
    if (await f.count()) {
      await f.click(); await f.fill('أفكار مشاريع في التعليم');
      await page.waitForTimeout(400);
      const send = page.locator('button[type="submit"], .nx-ai-send, button:has-text("إرسال")').first();
      if (await send.count()) await send.click().catch(() => {});
      else await page.keyboard.press('Enter');
      await page.waitForTimeout(3200);
      await snap('12-conversation');
    }
  } catch (e) { console.log('  [chat]', String(e).slice(0, 80)); }

  // ورقة الحساب
  await goto(2400);
  try {
    const acc = page.locator('[title*="الحساب"], [title*="ccount"]').first();
    if (await acc.count()) { await acc.click(); await page.waitForTimeout(1500); await snap('13-account-sheet'); }
  } catch { /* skip */ }

  // عربية (RTL) — التطبيق يدعمها فعليًا
  await seed('ar', true);
  await goto(3000);
  await snap('14-workspace-arabic');
  if (await click('توليد الصور')) await snap('15-images-arabic');
  if (await click('المحادثة الذكية')) await snap('16-chat-arabic');

  // 13: شريط الاقتراحات "ابدأ بفكرة" (حالة حقيقية)
  await goto(2400);
  await page.mouse.wheel(0, 420); await page.waitForTimeout(900);
  await snap('13-suggestions');

  // 17: حقل الكتابة مُركَّز (حالة حقيقية)
  await seed('ar', true); await goto(2600);
  try {
    const f = page.locator('textarea').first();
    if (await f.count()) { await f.click(); await page.waitForTimeout(500); await snap('17-composer-focused'); }
  } catch { /* skip */ }

  // 18: تمرير الصفحة لأسفل (الاقتراحات والمهام)
  await goto(2400);
  await page.mouse.wheel(0, 700); await page.waitForTimeout(900);
  await snap('18-workspace-scrolled');

  // 19: القائمة الجانبية مفتوحة
  await goto(2400);
  for (const sel of ['[aria-label="القائمة"]', '.nx-ai-mobile-menu', 'button[aria-label*="القائمة"]']) {
    try { const el = page.locator(sel).first(); if (await el.count()) { await el.click(); await page.waitForTimeout(1200); break; } } catch { /* next */ }
  }
  await snap('19-sidebar-open');

  // 20: ورقة الحساب والأمان
  await goto(2400);
  try {
    const acc = page.locator('[title*="الحساب"]').first();
    if (await acc.count()) { await acc.click(); await page.waitForTimeout(1600); }
  } catch { /* skip */ }
  await snap('20-account-sheet');

  // سمة فاتحة (حقيقية) + شاشة دخول عربية
  await seed('en', true);
  await page.evaluate(() => localStorage.setItem('nx_theme', 'light'));
  await goto(2700);
  await snap('21-workspace-light');

  await seed('ar', false);
  await goto(2800);
  await snap('22-login-arabic');

  await browser.close();

  console.log('\n=== ' + taken.length + ' screens captured ===');
  // تحقق نهائي من المقاس والنوع
  const { execSync } = await import('node:child_process');
  console.log(execSync(`python3 -c "
from PIL import Image
import glob,os,sys
fs=sorted(glob.glob('${OUT}/*.png'))
bad=0
for f in fs:
    im=Image.open(f)
    ok = im.size==(1080,1920) and im.format=='PNG'
    if not ok: bad+=1
    print(('OK  ' if ok else 'FAIL'), os.path.basename(f), im.format, im.size)
print('total',len(fs),'bad',bad)
sys.exit(1 if bad or len(fs)<20 else 0)
"`).toString());
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
