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
  assert.match(chat, /const awaitingFirstSignal = Boolean\(agent\.running\)/);
  assert.match(chat, /&& !agent\.prose/);
  assert.match(chat, /\? <ThinkingPhase lang=\{thinkLang\} \/>/);
  assert.match(chat, /: <AgentWindow \/>/);
});

test('الكتابة لم تعد خافتة في دردشة الاستوديو: أوضح وأثقل في الوضعين', () => {
  /* النص المتداخل كان 12.5px بلون ثانوي باهت والرد النهائي 14.5px */
  assert.match(studioCss, /\.nxs-aw-prose \{ font-size: 15px; line-height: 1\.7; color: var\(--ink\); font-weight: 500; \}/);
  assert.match(studioCss, /\.nxs-asst-body \{ font-size: 16px; line-height: 1\.78; font-weight: 500; \}/);
  assert.match(studioCss, /\.nxs-asst-body \.nx-md p,\n\.nxs-asst-body \.nx-md li \{ font-weight: 500; \}/);
  /* الجوال */
  assert.match(studioCss, /\.nxs-asst-body \{ font-size: 15px; \}/);
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
