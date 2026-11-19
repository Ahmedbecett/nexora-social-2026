/* ==========================================================================
   NEXORA AI — Service Worker (Windows PWA / MSIX)
   --------------------------------------------------------------------------
   قواعد صارمة:
     1) لا يُخزَّن أي طلب إلى /api/ إطلاقًا — المحادثات والجلسات والاشتراكات
        بيانات حيّة، وتخزينها قد يعرض رسائل حساب آخر أو نتيجة قديمة.
     2) لا يُخزَّن /version.json — هو أداة كشف التحديث، ويجب أن يبقى طازجًا.
     3) التنقل: الشبكة أولًا (مهلة قصيرة) ثم النسخة المخزّنة ثم offline.html.
     4) أصول البناء المُبصّمة (/assets/) تُخدم من الكاش فورًا (immutable).
     5) الطلبات الخارجية (الإعلانات، الخطوط، البث) لا تُعترَض أبدًا.
     6) لا عدّاد انطباعات ولا أي قياس محلي مزيف — الإعلانات تُقاس لدى المزوّد.
   ========================================================================== */

const CACHE = 'nexora-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/mascot-ui.webp',
  '/mascot-avatar.webp',
];
const NAV_TIMEOUT_MS = 4500;
const API_PREFIX = '/api/';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll يفشل كليًا لو فشل عنصر واحد؛ نضيف كل عنصر على حدة.
    await Promise.all(PRECACHE.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch { /* اختياري */ }
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'NX_SKIP_WAITING') self.skipWaiting();
});

function isCacheableAsset(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith('/assets/') ||
    /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|css)$/i.test(url.pathname) ||
    url.pathname.startsWith('/stickers/') ||
    url.pathname.startsWith('/gifs/')
  );
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS)),
    ]);
    if (fresh && fresh.ok) {
      // لا نخزّن صفحات /api أو صفحات فيها بيانات مستخدم؛ الجذر فقط.
      if (new URL(request.url).pathname === '/') {
        try { await cache.put('/', fresh.clone()); } catch { /* ignore */ }
      }
      return fresh;
    }
    throw new Error('bad-response');
  } catch {
    const cached = await cache.match('/');
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    try { await cache.put(request, fresh.clone()); } catch { /* ignore */ }
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // الأصول الخارجية لا تُعترَض (إعلانات، خطوط، تخزين، بث AI).
  if (url.origin !== self.location.origin) return;

  // لا كاش لأي بيانات حيّة.
  if (url.pathname.startsWith(API_PREFIX)) return;
  if (url.pathname === '/version.json') return;
  if (url.pathname === '/sw.js') return;
  // لا نخزّن تنزيلات APK الكبيرة أو أي ملف يُطلب مدى (range).
  if (url.pathname.startsWith('/download/')) return;
  if (request.headers.has('range')) return;
  // الطلبات المصادَق عليها لا تُخزَّن أبدًا.
  if (request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(cacheFirstAsset(request).catch(() => fetch(request)));
  }
});
