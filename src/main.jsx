import { createRoot } from 'react-dom/client';
import '@fontsource/grand-hotel/latin-400.css';
import '@fontsource-variable/cairo/wght.css';
import './styles.css';
import './update-notice.css';
import './windows.css';
import { applyDir, getLang, setLang } from './i18n.js';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { initTheme } from './theme.js';
import { initMedia } from './media.js';
import { initAds } from './ads.js';
import { BUILD_ID } from './updates.js';
import { initInstallPrompt, registerServiceWorker } from './pwa.js';
import { isCapacitorNative, isWindowsApp, runtimeSurface } from './platform.js';

initTheme();
initMedia();
initAds(); /* AdMob banner — native only; no-op on the web */
initInstallPrompt(); /* Windows: التقاط نافذة التثبيت الأصلية قبل رسم React */

// PWA: service worker على الويب فقط — لا شيء داخل Capacitor.
try {
  const surface = runtimeSurface();
  document.documentElement.dataset.nxPlatform = surface;
  if (isWindowsApp()) document.documentElement.dataset.nxWindows = '1';
  registerServiceWorker();
} catch { /* بيئات مقيدة */ }

applyDir();
// بصمة البناء على <html data-build="…"> — تسمح بالتحقق فورًا من النسخة المعروضة
// (مفيدة عند شكوى «ما زالت تظهر الصفحة القديمة»: قارن السمات بناتج /version.json).
try { document.documentElement.dataset.build = BUILD_ID; } catch { /* بيئات مقيدة */ }
// native feel: no long-press menus / image dragging outside text fields
document.addEventListener('contextmenu', (e) => {
  // على Windows نُبقي قائمة السياق الأصلية للنص والروابط (نسخ/فتح في تبويب)،
  // ونمنعها فقط على عناصر التطبيق غير النصية حتى لا تظهر «حفظ الصورة باسم».
  const editable = e.target.closest('input, textarea, [contenteditable="true"], .bubble, .nx-ai-message-body, .nxs-md, .nxs-msg, a[href]');
  if (isCapacitorNative()) {
    if (!editable) e.preventDefault();
    return;
  }
  if (!editable) e.preventDefault();
});
document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') e.preventDefault(); });
setLang(getLang()).finally(() => {
  const root = createRoot(document.getElementById('root'));
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
});
