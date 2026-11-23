import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// نسخة الإصدار الواحدة التي تُحقن في الويب وindex.html (v4.4.0 ⟹ 4.4.0)
const APP_VERSION = pkg.version || '0.0.0';
const APP_VERSION_SHORT = APP_VERSION.split('.').slice(0, 2).join('.');
// An evergreen search title; version belongs on the download page and in app UI.
const APP_TITLE = 'NEXORA Studio | ابنِ تطبيقًا كاملًا بالوصف — محرر وطرفية ومعاينة ونشر';
// معرّف البناء: commit النشر على Vercel، وإلا طابع زمني للبناء المحلي.
// يُحقن في JS (ليعرف التطبيق نسخته) ويُكتب في /version.json (ليعرف أحدث نسخة منشورة).
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 12)
  || `local-${Date.now().toString(36)}`;
const PROJECT_ROOT = fileURLToPath(new URL('./', import.meta.url));
function collectHtmlPages(directory, relative = '') {
  return readdirSync(resolve(directory, relative), { withFileTypes: true }).flatMap((entry) => {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return collectHtmlPages(directory, child);
    return entry.isFile() && entry.name.endsWith('.html') ? [child] : [];
  });
}
const becettiHtml = collectHtmlPages(PROJECT_ROOT, 'becetti');
const htmlInputs = Object.fromEntries([
  ['index', resolve(PROJECT_ROOT, 'index.html')],
  ...becettiHtml.map((path) => [path.slice(0, -5), resolve(PROJECT_ROOT, path)]),
]);

export default defineConfig({
  plugins: [
    react(),
    {
      // يكتب dist/version.json بعد كل بناء — نقطة المقارنة التي يفحصها المتصفح
      // لمعرفة أن نسخة أحدث نُشرت (fixes: «ما زالت تظهر الصفحة القديمة»).
      name: 'nexora-build-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            version: APP_VERSION,
            buildId: BUILD_ID,
            builtAt: new Date().toISOString(),
          }),
        });
      },
    },
    {
      // يملأ %APP_VERSION% و%APP_VERSION_SHORT% داخل index.html وقت البناء
      name: 'nexora-version-html',
      transformIndexHtml(html) {
        return html
          .replaceAll('%APP_VERSION%', APP_VERSION)
          .replaceAll('%APP_VERSION_SHORT%', APP_VERSION_SHORT)
          .replaceAll('%APP_TITLE%', APP_TITLE);
      },
    },
  ],
  define: {
    // متاح في src/version.js دون الحاجة لقراءة package.json وقت التشغيل
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    // معرّف البناء — يُقرأ في src/updates.js لمقارنة نسخة التبويب بأحدث نشر
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  server: {
    host: '0.0.0.0', port: 5173, allowedHosts: true,
    proxy: { '/api': { target: process.env.API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true, secure: true } },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200, rollupOptions: { input: htmlInputs } },
});
