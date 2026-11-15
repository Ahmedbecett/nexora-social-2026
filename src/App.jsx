import { useEffect, useState } from 'react';
import { applyTheme } from './theme.js';
import AIPlatform from './ai/AIPlatform.jsx';
import ArenaStudio from './ai/ArenaStudio.jsx';
import './ai/ArenaStudio.css';

export default function App() {
  const [view, setView] = useState(() => localStorage.getItem('nx_view') || 'chat');
  useEffect(() => { applyTheme({ immersive: false }); }, []);
  useEffect(() => { localStorage.setItem('nx_view', view); }, [view]);
  return (
    <>
      <nav className="nx-arena-nav">
        <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>💬 NEXORA Chat</button>
        <button className={view === 'studio' ? 'active' : ''} onClick={() => setView('studio')}>⬢ NEXORA Studio — مثل Arena AI</button>
        <small>حافظنا على الاسم والإعلانات 100% — فقط طبيعة العمل أصبحت منصة برمجة حقيقية</small>
      </nav>
      <div style={{ height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
        {view === 'chat' ? <AIPlatform /> : <ArenaStudio toast={(m) => {
          // simple toast delegation — Studio expects a toast fn; fallback to alert
          try { const el = document.createElement('div'); el.textContent = m; el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:999px;font-size:12px;z-index:9999'; document.body.appendChild(el); setTimeout(() => el.remove(), 2500); } catch {}
        }} />}
      </div>
    </>
  );
}
