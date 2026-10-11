import { createRoot } from 'react-dom/client';
import '@fontsource-variable/cairo';
import '@fontsource/grand-hotel';
import './styles.css';
import { applyDir, getLang, setLang } from './i18n.js';
import App from './App.jsx';
import { initTheme } from './theme.js';
import { initMedia } from './media.js';

initTheme();
initMedia();
applyDir();
// native feel: no long-press menus / image dragging outside text fields
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input, textarea, .bubble')) e.preventDefault(); });
document.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') e.preventDefault(); });
setLang(getLang()).finally(() => {
  createRoot(document.getElementById('root')).render(<App />);
});
