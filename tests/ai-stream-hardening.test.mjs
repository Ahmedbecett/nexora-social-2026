import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('api/_lib/handlers.js', 'utf8');

function fn(name, next) {
  const re = new RegExp(`(async )?function ${name}\\([\\s\\S]*?\\n(async )?function ${next}`);
  const m = re.exec(src);
  return m ? m[0] : '';
}

test('مهلة البث لم تعد تقتل الجواب في منتصفه: مهلة اتصال + خمول يُصفَّر مع كل مقطع', () => {
  assert.match(src, /async function aiStreamOpen/);
  assert.match(src, /ConnectAbort/);
  assert.match(src, /IdleAbort/);
  assert.match(src, /HardCapAbort/);
  const gemini = fn('aiGeminiStreamOnce', 'aiAskGemini');
  assert.ok(gemini, 'aiGeminiStreamOnce موجودة');
  assert.doesNotMatch(gemini, /AbortSignal\.timeout/, 'القص القديم بعد 6 ثوانٍ أُزيل');
  assert.match(gemini, /aiStreamOpen/);
  const compat = fn('aiAskOpenAICompat', 'aiStripThinking');
  assert.ok(compat);
  assert.doesNotMatch(compat, /AbortSignal\.timeout/);
  const llm7 = fn('aiAskLlm7', 'aiAskPollinations');
  assert.ok(llm7);
  assert.doesNotMatch(llm7, /AbortSignal\.timeout/);
});

test('المزوّد الأساسي OpenAI يبث الآن فعليًا (لم يبقَ مؤشر كتابة ميتًا 14 ثانية)', () => {
  const openai = fn('aiAskOpenAI', 'aiGeminiCheck');
  assert.ok(openai, 'aiAskOpenAI موجودة');
  assert.match(openai, /onDelta/);
  assert.match(openai, /stream: true/);
  assert.match(openai, /response\.output_text\.delta/);
  assert.match(openai, /response\.completed/);
  /* سقف 1200 كان يجوّع نماذج الاستدلال فتعود الإجابة فارغة */
  assert.match(openai, /maxOutputTokens = 4000/);
  assert.doesNotMatch(openai, /max_output_tokens: 1200/);
});

test('ميزانية البث أوسع من المسار المتزامن وشريحة Gemini تتسع للإجابات الطويلة', () => {
  assert.match(src, /AI_STREAM_BUDGET_MS = 95000/);
  assert.match(src, /AI_TOTAL_BUDGET_MS = 26000/);
  assert.match(src, /typeof onDelta === 'function' \? AI_STREAM_BUDGET_MS : AI_TOTAL_BUDGET_MS/);
  assert.match(src, /geminiDeadline = Math\.min\(deadline, Date\.now\(\) \+ \(onDelta \? 45000 : 8000\)\)/);
});

test('الجواب الجزئي لا يُرمى عند انقطاع البث بعد ظهور نص', () => {
  const gemini = fn('aiGeminiStreamOnce', 'aiAskGemini');
  assert.match(gemini, /partial && partial\.length >= 4/);
  const openai = fn('aiAskOpenAI', 'aiGeminiCheck');
  assert.match(openai, /partial && partial\.length >= 4/);
  const compat = fn('aiAskOpenAICompat', 'aiStripThinking');
  assert.match(compat, /partial && partial\.length >= 4/);
  const llm7 = fn('aiAskLlm7', 'aiAskPollinations');
  assert.match(llm7, /partial && partial\.length >= 4/);
});

test('الواجهة تحوّل انقطاع البث الصامت إلى إيقاف/خطأ واضح بدل صمت تام', () => {
  const ui = readFileSync('src/ai/AIPlatform.jsx', 'utf8');
  assert.match(ui, /gotDone/);
  assert.match(ui, /lastText=ev\.text/);
  assert.match(ui, /stream_closed/);
  assert.match(ui, /stopped:true/);
});
