import { useEffect, useState } from 'react';
import { applyTheme } from './theme.js';
import StudioApp from './studio/StudioApp.jsx';
import AIPlatform from './ai/AIPlatform.jsx';

/**
 * NEXORA is an AI app builder first: the Studio is the default surface.
 * The NEXORA assistant chat stays available from Studio settings → Runtime.
 */
export default function App() {
  const [view, setView] = useState(() => localStorage.getItem('nx_view') || 'studio');

  useEffect(() => { applyTheme({ immersive: false }); }, []);
  useEffect(() => { localStorage.setItem('nx_view', view); }, [view]);
  useEffect(() => {
    const openChat = () => setView('chat');
    window.addEventListener('nxs-open-chat', openChat);
    return () => window.removeEventListener('nxs-open-chat', openChat);
  }, []);

  if (view === 'chat') {
    return (
      <>
        <button className="nxs-switch-back" onClick={() => setView('studio')}>← NEXORA Studio</button>
        <AIPlatform />
      </>
    );
  }
  return <StudioApp />;
}
