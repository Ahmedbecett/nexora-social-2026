import { useEffect, useState } from 'react';
import { applyTheme } from './theme.js';
import { getLang } from './i18n.js';
import AIPlatform from './ai/AIPlatform.jsx';
import ArenaStudio from './ai/ArenaStudio.jsx';
import './ai/ArenaStudio.css';

function studioToast(message) {
  try {
    const el = document.createElement('div');
    el.textContent = message;
    el.className = 'nx-s-toast';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  } catch { /* ignore */ }
}

export default function App() {
  const [view, setView] = useState(() => localStorage.getItem('nx_view') || 'chat');
  useEffect(() => { applyTheme({ immersive: false }); }, []);
  useEffect(() => { localStorage.setItem('nx_view', view); }, [view]);
  const ar = getLang() === 'ar';
  return (
    <div className="nx-app">
      <nav className="nx-arena-nav">
        <div className="nx-arena-nav-tabs" role="tablist" aria-label="NEXORA views">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'chat'}
            className={view === 'chat' ? 'active' : ''}
            onClick={() => setView('chat')}
          >
            💬 <span>NEXORA Chat</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'studio'}
            className={view === 'studio' ? 'active' : ''}
            onClick={() => setView('studio')}
          >
            🛠️ <span>NEXORA Studio</span>
          </button>
        </div>
        <small className="nx-arena-nav-note">
          {ar ? 'استوديو تطوير حقيقي: محرر كود + معاينة حية — بلا نتائج تنفيذ أو نشر وهمية' : 'Real dev studio: code editor + live preview — no fake execution or deployment results'}
        </small>
      </nav>
      <div className="nx-app-body">
        {view === 'chat' ? <AIPlatform /> : <ArenaStudio toast={studioToast} />}
      </div>
    </div>
  );
}
