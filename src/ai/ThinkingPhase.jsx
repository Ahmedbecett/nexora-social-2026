/* ============================================================================
   NEXORA — Arena-style Thinking Phase (shared)
   Shown between sending a request and the first content arriving: a pulsing
   brain orb, the ✦ ✧ ✳ glyphs, a cycling status line that narrates what the
   model is doing with the message, a shimmer bar, and ghost skeleton lines —
   as if a draft were being written inside the model's head.
   Styles live in AIPlatform.css (.nx-ai-thinking*), loaded app-wide.
   ============================================================================ */
import { useEffect, useState } from 'react';

export default function ThinkingPhase({ lang }) {
  const steps = lang === 'ar'
    ? ['يفكّر في رسالتك…', 'يقرأ ويدرس النص…', 'يحلّل ما أرسلته…', 'ينظّم الإجابة…']
    : ['Thinking…', 'Reading your message…', 'Analyzing your text…', 'Structuring the answer…'];
  const [ix, setIx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIx(x => (x + 1) % steps.length), 1900); return () => clearInterval(t); }, [lang]);
  return <div className="nx-ai-thinking" role="status" aria-live="polite">
    <div className="nx-ai-thinking-row">
      <span className="nx-ai-thinking-orb" aria-hidden="true"/>
      <span className="nx-ai-thinking-glyphs" aria-hidden="true"><i>✦</i><i>✧</i><i>✳</i></span>
      <span className="nx-ai-thinking-label">{steps[ix]}</span>
      <span className="nx-ai-thinking-bar" aria-hidden="true"><i/></span>
    </div>
    <div className="nx-ai-thinking-skel" aria-hidden="true"><i/><i/></div>
  </div>;
}
