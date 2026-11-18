import { createRoot } from 'react-dom/client';
import '@fontsource/grand-hotel/latin-400.css';
import '@fontsource-variable/cairo/wght.css';
import './styles.css';
import './update-notice.css';
import { applyDir, getLang, setLang } from './i18n.js';
import App from './App.jsx';
import { initTheme } from './theme.js';
import { initMedia } from './media.js';
import { initAds } from './ads.js';
import { BUILD_ID } from './updates.js';

initTheme();
initMedia();
initAds(); /* AdMob banner — native only; no-op on the web */
applyDir();
// بصمة البناء على <html data-build="…"> — تسمح بالتحقق فورًا من النسخة المعروضة
// (مفيدة عند شكوى «ما زالت تظهر الصفحة القديمة»: قارن السمات بناتج /version.json).
try { document.documentElement.dataset.build = BUILD_ID; } catch { /* بيئات مقيدة */ }
// native feel: no long-press menus / image dragging outside text fields
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea, .bubble')) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') e.preventDefault(); });
setLang(getLang()).finally(() => {
  createRoot(document.getElementById('root')).render(<App />);
});
