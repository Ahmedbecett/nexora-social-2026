import { createRoot } from 'react-dom/client';
import '@fontsource-variable/cairo';
import '@fontsource/grand-hotel';
import './styles.css';
import { applyDir, getLang, setLang } from './i18n.js';
import App from './App.jsx';

applyDir();
setLang(getLang()).finally(() => {
  createRoot(document.getElementById('root')).render(<App />);
});
