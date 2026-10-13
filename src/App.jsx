import { useEffect } from 'react';
import { applyTheme } from './theme.js';
import AIPlatform from './ai/AIPlatform.jsx';

/* NEXORA AI — the whole app is the AI workspace now.
   The former social build (feed · reels · videos · messages) is no longer mounted anywhere,
   on the web or inside the Android app; its screens are kept in the repository only for
   reference and are not part of the bundle. */
export default function App() {
  useEffect(() => { applyTheme({ immersive: false }); }, []);
  return <AIPlatform />;
}
