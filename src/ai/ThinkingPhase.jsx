/* ============================================================================
   NEXORA — Arena-style Thinking Phase (shared, v3: real text analysis)
   Between sending a request and the work starting, the thread shows:
   1. a pulsing brain orb + the ✦ ✧ ✳ glyphs + a cycling status line
   2. THE USER'S OWN MESSAGE quoted in a scan box — read and highlighted like
      a document under a scanner, with the key terms extracted from it as
      chips ("يدرس: <keyword> …") — a real analysis of what was sent
   3. as soon as the model's actual reasoning text starts streaming, it is
      shown live (like Arena's reasoning), replacing the ghost skeleton lines
   Styles live in AIPlatform.css (.nx-ai-thinking*), loaded app-wide, with
   studio theme overrides in studio.css.
   ============================================================================ */
import { useEffect, useMemo, useState } from 'react';

/* Arabic + English filler words skipped when extracting the key terms */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'what', 'how', 'why',
  'who', 'are', 'you', 'your', 'can', 'could', 'would', 'should', 'please',
  'about', 'into', 'have', 'has', 'was', 'were', 'will', 'when', 'where',
  'لي', 'لى', 'في', 'من', 'على', 'عن', 'الى', 'إلى', 'هذا', 'هذه', 'ذلك',
  'تلك', 'التي', 'الذي', 'الذين', 'ما', 'ماذا', 'هل', 'كيف', 'لماذا', 'أين',
  'متى', 'و', 'أو', 'ثم', 'كل', 'بعض', 'بعد', 'قبل', 'عند', 'بين', 'مع',
  'أن', 'إن', 'لا', 'نعم', 'أنا', 'أنت', 'نحن', 'هو', 'هي', 'هم', 'ممكن',
  'أريد', 'اريد', 'ريد', 'عندك', 'عندي', 'الآن', 'الان', 'جدا', 'جدًا',
  'ايضا', 'أيضا', 'لكن', 'حتى', 'إذا', 'اذا', 'مثل', 'على', 'فقط',
]);

function analyzeMessage(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const excerpt = raw.length > 220 ? raw.slice(0, 220) + '…' : raw;
  const words = raw
    .split(/[\s.,!?؟،؛:"'()\-—…]+/u)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !STOPWORDS.has(w.toLowerCase()));
  const keys = [...new Set(words)].slice(0, 4);
  return { excerpt, keys };
}

export default function ThinkingPhase({ lang, message, prose }) {
  const steps = lang === 'ar'
    ? ['يفكّر في رسالتك…', 'يقرأ ويدرس النص…', 'يحلّل ما أرسلته…', 'ينظّم الإجابة…']
    : ['Thinking…', 'Reading your message…', 'Analyzing your text…', 'Structuring the answer…'];
  const [ix, setIx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIx(x => (x + 1) % steps.length), 1900); return () => clearInterval(t); }, [lang]);

  /* real analysis of the user's own words — quote + extracted key terms */
  const analysis = useMemo(() => analyzeMessage(message), [message]);
  /* the model's live reasoning text replaces the ghost lines once it streams */
  const liveText = String(prose || '').slice(-900).trim();

  return <div className="nx-ai-thinking" role="status" aria-live="polite">
    <div className="nx-ai-thinking-row">
      <span className="nx-ai-thinking-orb" aria-hidden="true" />
      <span className="nx-ai-thinking-glyphs" aria-hidden="true"><i>✦</i><i>✧</i><i>✳</i></span>
      <span className="nx-ai-thinking-label">{steps[ix]}</span>
      <span className="nx-ai-thinking-bar" aria-hidden="true"><i /></span>
    </div>

    {liveText ? (
      <div className="nx-ai-thinking-live" dir="auto">{liveText}</div>
    ) : (<>
      {analysis && (
        <div className="nx-ai-thinking-read" dir="auto">
          <span className="nx-ai-thinking-read-quote">{analysis.excerpt}</span>
          {analysis.keys.length > 0 && (
            <span className="nx-ai-thinking-keys">
              <b>{lang === 'ar' ? 'يدرس:' : 'Reading:'}</b>
              {analysis.keys.map((k) => <i key={k}>{k}</i>)}
            </span>
          )}
        </div>
      )}
      <div className="nx-ai-thinking-skel" aria-hidden="true"><i /><i /></div>
    </>)}
  </div>;
}
