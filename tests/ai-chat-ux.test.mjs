import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jsx = readFileSync('src/ai/AIPlatform.jsx', 'utf8');
const css = readFileSync('src/ai/AIPlatform.css', 'utf8');

test('مرحلة التفكير بأسلوب أرينا: رموز ✦✧✳ + حالات متبدّلة قبل أول حرف', () => {
  assert.match(jsx, /function ThinkingPhase\(/);
  assert.match(jsx, /'يفكّر في رسالتك…','يقرأ ويدرس النص…','يحلّل ما أرسلته…','ينظّم الإجابة…'/);
  assert.match(jsx, /✦/);
  assert.match(jsx, /✧/);
  assert.match(jsx, /✳/);
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
  assert.match(css, /\.nx-ai-message-body p\{white-space:pre-wrap;overflow-wrap:anywhere;color:#eef0fa;font-size:15px/);
  assert.match(css, /\.nx-md\{font-size:15px;line-height:1\.85;color:#eef0fa/);
  assert.match(css, /\.nx-md h1\{font-size:19px\}\.nx-md h2\{font-size:17\.5px\}/);
  assert.match(css, /:root\[data-theme=light\] \.nx-md\{color:#1a1e33\}/);
  /* الجوال: 14px بدل 11px */
  assert.match(css, /\.nx-ai-message-body p\{font-size:14px\}\.nx-md\{font-size:14px\}/);
  assert.doesNotMatch(css, /font-size:11px\}\.nx-ai-conversation-head/, 'حجم الجوال القديم أُزيل');
  assert.doesNotMatch(css, /\.nx-md\{font-size:12px/, 'حجم 12px القديم أُزيل');
  assert.doesNotMatch(css, /\.nx-ai-message-body p\{white-space:pre-wrap;[^}]*font-size:12px/, 'نص الرد القديم أُزيل');
});
