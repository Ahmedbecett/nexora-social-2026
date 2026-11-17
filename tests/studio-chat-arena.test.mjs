import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* جولة أرينا على دردشة الاستوديو (ChatPanel) — السطح الذي يستخدمه المالك فعلًا:
   مرحلة تفكير مرئية بين الإرسال وأول إشارة عمل، نص أوضح وأثقل، تمرير ذكي + زر قفز */
const chat = readFileSync('src/studio/ChatPanel.jsx', 'utf8');
const studioCss = readFileSync('src/studio/studio.css', 'utf8');
const aiJsx = readFileSync('src/ai/ThinkingPhase.jsx', 'utf8');

test('مرحلة التفكير في دردشة الاستوديو: الدماغ والرموز بين الإرسال وأول إشارة عمل', () => {
  assert.match(chat, /import ThinkingPhase from '\.\.\/ai\/ThinkingPhase\.jsx';/);
  assert.match(aiJsx, /export default function ThinkingPhase\(/);
  /* تظهر فقط أثناء عمل الوكيل قبل وصول أي نص/خطوة/كتابة ملف — ثم تتسلم نافذة الوكيل */
  assert.match(chat, /const agentThinking = Boolean\(agent\.running\)/);
  assert.match(chat, /\? <ThinkingPhase lang=\{thinkLang\} message=\{lastUserMsg\?\.text\} prose=\{agent\.prose\} \/>/);
  assert.match(chat, /: <AgentWindow \/>/);
});

test('الكتابة لم تعد خافتة في دردشة الاستوديو: أوضح وأثقل في الوضعين', () => {
  /* النص المتداخل كان 12.5px بلون ثانوي باهت والرد النهائي 14.5px */
  assert.match(studioCss, /\.nxs-aw-prose \{ font-size: 16px; line-height: 1\.75; color: var\(--ink\); font-weight: 550; \}/);
  assert.match(studioCss, /\.nxs-asst-body \{ font-size: 17px; line-height: 1\.8; font-weight: 550; \}/);
  assert.match(studioCss, /\.nxs-asst-body \.nx-md p,\n\.nxs-asst-body \.nx-md li \{ font-weight: 550; \}/);
  /* الجوال */
  assert.match(studioCss, /\.nxs-asst-body \{ font-size: 16px; \}/);
  /* مرحلة التفكير مكيّفة مع ثيم الاستوديو الفاتح/الداكن عبر متغيراته */
  assert.match(studioCss, /\.nxs-thread \.nx-ai-thinking-label \{ color: var\(--ink\); \}/);
});

test('تمرير بأسلوب أرينا في دردشة الاستوديو: تتبّع ذكي + زر قفز عند الصعود', () => {
  assert.match(chat, /ref=\{scrollRef\} onScroll=\{onThreadScroll\}/);
  assert.match(chat, /const atBottom = el\.scrollHeight - el\.scrollTop - el\.clientHeight < 140;/);
  assert.match(chat, /if \(stickRef\.current \|\| \(last && last\.role === 'user'\)\) el\.scrollTop = el\.scrollHeight;/);
  assert.match(chat, /showJump && \(/);
  assert.match(chat, /className="nxs-jump"/);
  assert.match(chat, /el\.scrollTo\(\{ top: el\.scrollHeight, behavior: 'smooth' \}\);/);
  assert.match(studioCss, /\.nxs-jump \{\n  position: sticky;/);
  /* متابعة فورية أثناء البث (بلا smooth يسبق المتابعة) */
  assert.match(studioCss, /\.nxs-thread \{ scroll-behavior: auto; \}/);
});

test('الجولة الثالثة في الاستوديو: رسالة المستخدم تُحلل داخل صندوق التفكير والنص الحي يُبث', () => {
  /* الرسالة الأخيرة تمرر للمكوّن ليقتطع منها الاقتباس والكلمات المفتاحية */
  assert.match(chat, /const lastUserMsg = \[\.\.\.messages\]\.reverse\(\)\.find\(\(m\) => m\.role === 'user'\);/);
  assert.match(aiJsx, /function analyzeMessage\(/);
  assert.match(aiJsx, /STOPWORDS/);
  assert.match(aiJsx, /'يدرس:' : 'Reading:'/);
  assert.match(aiJsx, /const liveText = String\(prose \|\| ''\)\.slice\(-900\)\.trim\(\);/);
  /* عناصر التحليل مكيّفة مع ثيم الاستوديو */
  assert.match(studioCss, /\.nxs-thread \.nx-ai-thinking-read \{ border-color: var\(--line-soft\); border-inline-start-color: #8d70ff; background: var\(--surface-2\); \}/);
  assert.match(studioCss, /\.nxs-thread \.nx-ai-thinking-live \{ border-color: var\(--line-soft\); background: var\(--surface-2\); color: var\(--ink\); \}/);
});
