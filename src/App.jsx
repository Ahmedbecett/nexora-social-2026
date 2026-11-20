import { useEffect, useState } from 'react';
import { applyTheme } from './theme.js';
import StudioApp from './studio/StudioApp.jsx';
import AIPlatform from './ai/AIPlatform.jsx';
import UpdateNotice from './UpdateNotice.jsx';
import WindowsShell from './WindowsShell.jsx';
import { isWindowsApp } from './platform.js';

/**
 * NEXORA is an AI app builder first: the Studio is the default surface.
 * The NEXORA assistant chat stays available from Studio settings → Runtime.
 */
export default function App() {
  const [view, setView] = useState(() => localStorage.getItem('nx_view') || 'studio');

  useEffect(() => { applyTheme({ immersive: false }); }, []);
  useEffect(() => {
    localStorage.setItem('nx_view', view);
    try { document.documentElement.dataset.nxView = view; } catch { /* بيئات مقيدة */ }
  }, [view]);
  useEffect(() => {
    const openChat = () => setView('chat');
    const openStudio = () => setView('studio');
    // «محادثة جديدة» من Studio: بدّل السطح أولًا ثم أعد إرسال الحدث بعد تركيب المحادثة،
    // وإلا ضاع الحدث لأن AIPlatform لم يكن مركّبًا بعد.
    const routeNewChat = () => {
      if (view === 'chat') return; // AIPlatform يستمع مباشرة
      setView('chat');
      window.setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent('nxs-new-chat')); } catch { /* ignore */ }
      }, 120);
    };
    window.addEventListener('nxs-open-chat', openChat);
    window.addEventListener('nxs-open-studio', openStudio);
    window.addEventListener('nxs-new-chat', routeNewChat);
    return () => {
      window.removeEventListener('nxs-open-chat', openChat);
      window.removeEventListener('nxs-open-studio', openStudio);
      window.removeEventListener('nxs-new-chat', routeNewChat);
    };
  }, [view]);
  /* اختصارات التطبيق في manifest (/windows): محادثة جديدة أو Studio */
  useEffect(() => {
    let action = '';
    try { action = new URLSearchParams(window.location.search).get('nx_action') || ''; } catch { /* ignore */ }
    if (action === 'new-chat') {
      setView('chat');
      const timer = window.setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent('nxs-new-chat')); } catch { /* ignore */ }
      }, 120);
      return () => window.clearTimeout(timer);
    }
    if (action === 'studio') setView('studio');
    return undefined;
  }, []);

  if (view === 'chat') {
    return (
      <>
        <WindowsShell />
        <button className="nxs-switch-back" onClick={() => setView('studio')}>← NEXORA Studio</button>
        <AIPlatform />
        {!isWindowsApp() && <UpdateNotice />}
      </>
    );
  }
  return (
    <>
      <WindowsShell />
      <StudioApp />
      {!isWindowsApp() && <UpdateNotice />}
    </>
  );
}
