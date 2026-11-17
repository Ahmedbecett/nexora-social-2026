import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync('src/ai/AIPlatform.jsx', 'utf8');
const css = readFileSync('src/ai/AIPlatform.css', 'utf8');
const think = readFileSync('src/ai/ThinkingPhase.jsx', 'utf8');

test('مرحلة التفكير بأسلوب أرينا: رموز ✦✧✳ + حالات متبدّلة قبل أول حرف', () => {
  /* المكوّن انتقل إلى ملف مشترك تستورده المنصة ودردشة الاستوديو معًا */
  assert.match(jsx, /import ThinkingPhase from '\.\/ThinkingPhase\.jsx';/);
  assert.match(think, /export default function ThinkingPhase\(/);
  assert.match(think, /'يفكّر في رسالتك…', 'يقرأ ويدرس النص…', 'يحلّل ما أرسلته…', 'ينظّم الإجابة…'/);
  assert.match(think, /✦/);
  assert.match(think, /✧/);
  assert.match(think, /✳/);
  /* تُعرض فقط أثناء البث قبل وصول أي نص، والمؤشر الوامض يظهر بعد بدء النص */
  assert.match(jsx, /m\.streaming&&!m\.text&&<ThinkingPhase lang=\{lang\}\/>/);
  assert.match(jsx, /m\.streaming&&m\.text&&<span className="nx-ai-cursor"/);
  assert.doesNotMatch(jsx, /m\.streaming&&<span className="nx-ai-cursor"/, 'لم يبقَ مؤشر صامت بلا نص');
});

test('أنماط مرحلة التفكير: نبض الرموز وشريط التقدم', () => {
  assert.match(css, /\.nx-ai-thinking\{/);
  assert.match(css, /\.nx-ai-thinking-glyphs i\{[^}]*animation:nxthink/);
  assert.match(css, /@keyframes nxthink\{/);
  assert.match(css, /\.nx-ai-thinking-bar i\{/);
  assert.match(css, /@keyframes nxthinkbar\{/);
  assert.match(css, /:root\[data-theme=light\] \.nx-ai-thinking-label/);
});

test('تمرير بأسلوب أرينا: تتبّع ذكي للأسفل وزر قفز عند الصعود', () => {
  /* الحاوية نفسها هي عنصر التمرير */
  assert.match(jsx, /<section className=\{'nx-ai-content '[^>]*ref=\{scrollRef\} onScroll=\{onConvScroll\}/);
  assert.match(jsx, /const onConvScroll=/);
  assert.match(jsx, /const jumpToBottom=/);
  assert.match(jsx, /stickRef\.current=true;prevLenRef\.current=messages\.length;if\(stickRef\.current\)el\.scrollTop=el\.scrollHeight/);
  assert.match(jsx, /showJump&&<button type="button" className="nx-ai-jump"/);
  assert.match(jsx, /el\.scrollTo\(\{top:el\.scrollHeight,behavior:'smooth'\}\)/);
  /* أزيل السحب القسري القديم الذي كان يمنع المستخدم من الصعود أثناء البث */
  assert.doesNotMatch(jsx, /scrollIntoView/);
  assert.match(css, /\.nx-ai-jump\{position:sticky;bottom:14px/);
  assert.match(css, /overscroll-behavior:contain/);
});

test('نص الرد لم يعد خافتًا: أكبر وأوضح في الوضعين', () => {
  assert.match(css, /\.nx-ai-message-body p\{white-space:pre-wrap;overflow-wrap:anywhere;color:#f2f4fd;font-size:17px[^}]*font-weight:600/);
  assert.match(css, /\.nx-md\{font-size:17px;line-height:1\.85;color:#f2f4fd/);
  assert.match(css, /\.nx-md p,\.nx-md li\{font-weight:600\}/);
  assert.match(css, /\.nx-md h1\{font-size:19px\}\.nx-md h2\{font-size:17\.5px\}/);
  assert.match(css, /:root\[data-theme=light\] \.nx-md\{color:#1a1e33\}/);
  /* الجوال: 14px بدل 11px */
  assert.match(css, /\.nx-ai-message-body p\{font-size:15px\}\.nx-md\{font-size:15px\}/);
  assert.doesNotMatch(css, /font-size:11px\}\.nx-ai-conversation-head/, 'حجم الجوال القديم أُزيل');
  assert.doesNotMatch(css, /\.nx-md\{font-size:12px/, 'حجم 12px القديم أُزيل');
  assert.doesNotMatch(css, /\.nx-ai-message-body p\{white-space:pre-wrap;[^}]*font-size:12px/, 'نص الرد القديم أُزيل');
});

test('الجولة الثانية: دماغ نابض + أسطر شبحية + خط أرينا + مربع ينمو تلقائيًا', () => {
  /* الدماغ (كرة نابضة) والأسطر الشبحية داخل مرحلة التفكير */
  assert.match(think, /nx-ai-thinking-orb/);
  assert.match(think, /nx-ai-thinking-skel/);
  assert.match(css, /@keyframes nxorb\{/);
  assert.match(css, /@keyframes nxskel\{/);
  assert.match(css, /:root\[data-theme=light\] \.nx-ai-thinking-skel i\{/);
  /* خط أرينا: Inter يُحمَّل مرة واحدة ويتقدّم المكدس */
  assert.match(jsx, /link\[data-nx-inter\]/);
  assert.match(jsx, /fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.match(css, /font-family:Inter,"Cairo Variable","Segoe UI",system-ui,sans-serif/);
  /* مربع الكتابة ينمو مع النص بدل التحجيم اليدوي */
  assert.match(jsx, /el\.style\.height='auto';el\.style\.height=Math\.min\(el\.scrollHeight,160\)\+'px'/);
  assert.match(css, /resize:none;overflow:hidden/);
});

test('الجولة الثالثة: تحليل نصي حقيقي — الرسالة تُقرأ والكلمات المفتاحية تُستخرج والتفكير يُبث حيًّا', () => {
  assert.match(think, /function analyzeMessage\(/);
  assert.match(think, /message, prose/);
  assert.match(think, /nx-ai-thinking-read/);
  assert.match(think, /nx-ai-thinking-keys/);
  assert.match(think, /nx-ai-thinking-live/);
  assert.match(css, /@keyframes nxscan\{/);
  assert.match(css, /:root\[data-theme=light\] \.nx-ai-thinking-live\{/);
});
