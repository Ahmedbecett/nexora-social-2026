import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// نسخة الإصدار الواحدة التي تُحقن في الويب وindex.html (v4.4.0 ⟹ 4.4.0)
const APP_VERSION = pkg.version || '0.0.0';
const APP_VERSION_SHORT = APP_VERSION.split('.').slice(0, 2).join('.');
const APP_TITLE = `NEXORA AI — منصة الذكاء الاصطناعي | نسخة ${APP_VERSION_SHORT}`;

export default defineConfig({
  plugins: [
    react(),
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
  },
  server: {
    host: '0.0.0.0', port: 5173, allowedHosts: true,
    proxy: { '/api': { target: process.env.API_PROXY || 'http://127.0.0.1:3001', changeOrigin: true, secure: true } },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
