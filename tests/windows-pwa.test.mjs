/**
 * NEXORA AI — Windows/PWA layer.
 *
 * Protects the properties that make the Windows edition real rather than a
 * mockup: an installable PWA with a safe service worker, platform detection
 * that never breaks Android, a Window Controls Overlay shell that renders only
 * in the installed Windows app, and an offline page that tells the truth.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  runtimeSurface,
  isWindows,
  isWindowsApp,
  isCapacitorNative,
  displayMode,
} from '../src/platform.js';
import { serviceWorkerDecision, isTrustedPwaOrigin, isUpdateReadyState, installHint } from '../src/pwaCore.js';

const read = (p) => readFileSync(p, 'utf8');
const manifest = JSON.parse(read('public/manifest.webmanifest'));

function fakeWin({ ua = '', search = '', standalone = false, platform = 'Win32', native = false, stored = null } = {}) {
  const store = new Map();
  if (stored) store.set('nx_surface', stored);
  return {
    navigator: {
      userAgent: ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      platform,
      standalone,
      userAgentData: null,
    },
    location: { search, hostname: 'nexora-social-2026.vercel.app', protocol: 'https:' },
    sessionStorage: {
      getItem: (k) => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
    },
    matchMedia: (q) => ({ matches: standalone && /standalone|window-controls-overlay/.test(q) }),
    Capacitor: native ? { isNativePlatform: () => true } : null,
  };
}

test('كشف السطح: MSIX يعلن نفسه، وPWA مستقل، والمتصفح، وأندرويد منفصل', () => {
  assert.equal(runtimeSurface(fakeWin({ search: '?nx_surface=msix' })), 'windows-msix');
  assert.equal(runtimeSurface(fakeWin({ standalone: true })), 'windows-pwa');
  assert.equal(runtimeSurface(fakeWin()), 'windows-browser');
  assert.equal(runtimeSurface(fakeWin({ native: true })), 'android');
  assert.equal(runtimeSurface(fakeWin({ ua: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64' })), 'web');
  // إعلان MSIX يُحفظ في الجلسة كي لا يضيع عند التنقل داخل التطبيق
  assert.equal(runtimeSurface(fakeWin({ stored: 'msix' })), 'windows-msix');
  assert.equal(isWindows(fakeWin()), true);
  assert.equal(isWindows(fakeWin({ ua: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel' })), false);
  assert.equal(isCapacitorNative(fakeWin({ native: true })), true);
  assert.equal(isCapacitorNative({ ...fakeWin(), location: { protocol: 'capacitor:', search: '', hostname: '' } }), true);
  assert.equal(isWindowsApp(fakeWin({ standalone: true })), true);
  assert.equal(isWindowsApp(fakeWin()), false);
  assert.equal(displayMode(fakeWin({ standalone: true })), 'window-controls-overlay');
});

test('قرار service worker يفشل مغلقًا: لا أندرويد، لا HTTP، لا تطوير', () => {
  const base = { supported: true, production: true, isSecureContext: true, hostname: 'nexora-social-2026.vercel.app', protocol: 'https:' };
  assert.equal(serviceWorkerDecision(base).allowed, true);
  assert.equal(serviceWorkerDecision({ ...base, nativeShell: true }).allowed, false);
  assert.equal(serviceWorkerDecision({ ...base, supported: false }).allowed, false);
  assert.equal(serviceWorkerDecision({ ...base, isSecureContext: false }).allowed, false);
  assert.equal(serviceWorkerDecision({ ...base, production: false }).allowed, false);
  assert.equal(serviceWorkerDecision({ ...base, production: false, devOverride: true }).allowed, true);
  assert.equal(serviceWorkerDecision({ ...base, isSecureContext: false, hostname: 'localhost', protocol: 'http:' }).allowed, true);
  assert.equal(isTrustedPwaOrigin({ isSecureContext: false, hostname: 'nexora-social-2026.vercel.app' }), false);
  assert.equal(isUpdateReadyState('installed'), true);
  assert.equal(isUpdateReadyState('installing'), false);
  assert.equal(installHint({ supported: true }).toString(), 'prompt-available');
  assert.equal(installHint({ installed: true }).toString(), 'already-installed');
});

test('المانيفست يعلن Windows وWCO والاختصارات والأيقونات الموجودة', () => {
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.display_override.slice(0, 3), ['window-controls-overlay', 'standalone', 'minimal-ui']);
  assert.equal(manifest.lang, 'ar');
  assert.equal(manifest.dir, 'rtl');
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.launch_handler.client_mode[0], 'navigate-existing');
  assert.ok(manifest.shortcuts.length >= 2, 'اختصارات التطبيق مطلوبة لإحساس Windows');
  assert.match(manifest.start_url, /nx_surface=pwa/);
  for (const icon of manifest.icons) {
    assert.ok(existsSync(`public${icon.src}`), `أيقونة مفقودة: ${icon.src}`);
  }
  for (const shortcut of manifest.shortcuts) {
    assert.equal(shortcut.url.startsWith('/'), true);
  }
});

test('service worker لا يخزّن API أو الجلسات أو نسخة النشر، ويقدّم صفحة عدم اتصال', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /const API_PREFIX = '\/api\/'/);
  assert.match(sw, /url\.pathname\.startsWith\(API_PREFIX\)\) return/);
  assert.match(sw, /url\.pathname === '\/version\.json'\) return/);
  assert.match(sw, /request\.headers\.has\('authorization'\)\) return/);
  assert.match(sw, /request\.method !== 'GET'\) return/);
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
  assert.match(sw, /cache\.match\('\/'\)/);
  assert.match(sw, /offline\.html/);
  assert.match(sw, /NX_SKIP_WAITING/);
  assert.match(sw, /caches\.delete/);
  assert.doesNotMatch(sw, /cache\.put\([^)]*\/api/);
  assert.doesNotMatch(sw, /impression|click_count|fake/i, 'لا قياس إعلاني محلي في service worker');
  const installBlock = sw.split("self.addEventListener('install'")[1].split("self.addEventListener('activate'")[0];
  assert.doesNotMatch(installBlock, /skipWaiting/, 'لا تفعيل تلقائي يقطع جلسة المستخدم');
  assert.ok(existsSync('public/offline.html'));
});

test('التسجيل مقصور على الويب: لا Capacitor، ولا كسر لأندرويد', () => {
  const pwa = read('src/pwa.js');
  assert.match(pwa, /isCapacitorNative\(w\)/);
  assert.match(pwa, /serviceWorkerDecision\(/);
  assert.match(pwa, /import\.meta\.env && import\.meta\.env\.PROD/);
  assert.match(pwa, /SERVICE_WORKER_URL/);
  assert.match(pwa, /controllerchange/);
  assert.match(pwa, /NX_SKIP_WAITING/);
  assert.match(read('src/main.jsx'), /registerServiceWorker\(\)/);
  assert.match(read('src/main.jsx'), /initInstallPrompt\(\)/);
  assert.match(read('src/main.jsx'), /dataset\.build = BUILD_ID/);
  assert.match(read('src/main.jsx'), /import '\.\/windows\.css'/);
});

test('غلاف Windows لا يُرسم إلا داخل نافذة WCO مثبّتة', () => {
  const shell = read('src/WindowsShell.jsx');
  assert.match(shell, /isWindowsApp\(\) && supportsWindowControlsOverlay\(\) && wco\.visible/);
  assert.match(shell, /windowControlsOverlay/);
  assert.match(shell, /geometrychange/);
  assert.match(shell, /data-nx-wco/);
  assert.match(shell, /nx-win-titlebar/);
  assert.match(shell, /nxs-new-chat/);
  assert.match(shell, /nxs-open-settings/);
  assert.match(shell, /nxs-open-studio/);
  assert.match(shell, /e\.key\.toLowerCase\(\) === 'n'/, 'اختصار Ctrl+N لمحادثة جديدة');
  assert.match(shell, /aria-haspopup="menu"/);
  assert.match(shell, /role="menuitem"/);
  assert.match(shell, /Escape/);
  assert.match(read('src/App.jsx'), /<WindowsShell \/>/);
  assert.equal((read('src/App.jsx').match(/<WindowsShell \/>/g) || []).length, 2);
  assert.match(read('src/App.jsx'), /dataset\.nxView = view/);
  assert.match(read('src/windows.css'), /env\(titlebar-area-width/);
  assert.match(read('src/windows.css'), /html\[data-nx-wco='1'\] \.nx-ai-shell/);
  assert.match(shell, /data-nx-studio-theme/);
  assert.match(read('src/windows.css'), /html\[data-nx-studio-theme='cream'\]/);
});

test('حالة عدم الاتصال والخطأ واضحة ولا تظهر داخل أندرويد', () => {
  const shell = read('src/WindowsShell.jsx');
  assert.match(shell, /export function OfflineNotice/);
  assert.match(shell, /navigator\.onLine !== false/);
  assert.match(shell, /role="status"/);
  assert.match(shell, /if \(isCapacitorNative\(\) \|\| !isWindowsApp\(\)\) return null/);
  const boundary = read('src/ErrorBoundary.jsx');
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /إعادة تحميل NEXORA/);
  assert.match(boundary, /Reload NEXORA/);
  assert.match(read('src/main.jsx'), /<ErrorBoundary>/);
});

test('صفحة عدم الاتصال تحمل noindex وتعيد المحاولة وتشرح الحاجة للشبكة', () => {
  const offline = read('public/offline.html');
  assert.match(offline, /<meta name="robots" content="noindex"/);
  assert.match(offline, /location\.reload\(\)/);
  assert.match(offline, /لا يوجد اتصال/);
  assert.match(offline, /You are offline/);
  assert.match(offline, /\/windows\/privacy\.html|privacy\.html/);
});

test('صفحة Windows العامة تشرح التثبيت ولا تدّعي وجود رابط متجر', () => {
  const ar = read('public/windows/index.html');
  const en = read('public/windows/en.html');
  for (const page of [ar, en]) {
    assert.match(page, /Microsoft Store/i);
    assert.match(page, /beforeinstallprompt/);
    assert.match(page, /privacy\.html/);
    assert.match(page, /windows\/en\.html|windows\//);
  }
  assert.match(ar, /قيد التحضير والاعتماد|قيد الاعتماد/);
  assert.match(en, /in preparation and certification/);
  assert.doesNotMatch(ar, /apps\.microsoft\.com\/store\/detail/i);
});
