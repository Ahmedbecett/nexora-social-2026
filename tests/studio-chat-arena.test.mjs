import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* جولة أرينا على دردشة الاستوديو (ChatPanel) — السطح الذي يستخدمه المالك فعلًا:
   مرحلة تفكير مرئية بين الإرسال وأول إشارة عمل، نص أوضح وأثقل، تمرير ذكي + زر قفز */
const chat = readFileSync('src/studio/ChatPanel.jsx', 'utf8');
const studioCss = readFileSync('src/studio/studio.css', 'utf8');
const aiJsx = readFileSync('src/ai/ThinkingPhase.jsx', 'utf8');
const cssFile = readFileSync('src/ai/AIPlatform.css', 'utf8');
const apiJs = readFileSync('api/_lib/handlers.js', 'utf8');
const studioAi = readFileSync('api/_lib/studio/ai.js', 'utf8');
const routesJs = readFileSync('api/_lib/studio/routes.js', 'utf8');
const webAd = readFileSync('src/studio/StudioWebAd.jsx', 'utf8');
const privacyAr = readFileSync('public/privacy.html', 'utf8');
const privacyEn = readFileSync('public/en/privacy.html', 'utf8');
const sitemap = readFileSync('public/sitemap.xml', 'utf8');

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
  assert.match(studioCss, /\.nxs-aw-prose \{ font-size: 16px; line-height: 1\.75; color: var\(--ink\); font-weight: 600; \}/);
  assert.match(studioCss, /\.nxs-asst-body \{ font-size: 17px; line-height: 1\.8; font-weight: 600; \}/);
  assert.match(studioCss, /\.nxs-asst-body \.nx-md p,\n\.nxs-asst-body \.nx-md li \{ font-weight: 600; \}/);
  /* الجوال */
  assert.match(studioCss, /\.nxs-asst-body \{ font-size: 16px; \}/);
  /* مرحلة التفكير مكيّفة مع ثيم الاستوديو الفاتح/الداكن عبر متغيراته */
  assert.match(studioCss, /\.nxs-thread \.nx-ai-thinking-label \{ color: var\(--ink\); \}/);
});

test('تمرير بأسلوب أرينا في دردشة الاستوديو: تتبّع ذكي + زر قفز عند الصعود', () => {
  assert.match(chat, /ref=\{scrollRef\} onScroll=\{onThreadScroll\}/);
  assert.match(chat, /const atBottom = el\.scrollHeight - el\.scrollTop - el\.clientHeight < 140;/);
  assert.match(chat, /if \(newMessage && last && last\.role === 'user'\) \{/);
  assert.match(chat, /if \(stickRef\.current\) snapToBottom\(el\);/);
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

test('الجولة الرابعة: حرية التمرير أثناء البث + مؤقّت مرئي + إجابات أسرع وأذكى', () => {
  /* التمرير: النزول القسري مرة واحدة لكل رسالة مستخدم فقط — لا لكل جزء بث،
     مع تجاهل صدى التمرير البرمجي حتى لا يُحسب نزولًا من المستخدم */
  assert.match(chat, /const prevLenRef = useRef\(0\);/);
  assert.match(chat, /const lockRef = useRef\(false\);/);
  assert.match(chat, /if \(lockRef\.current\) return;/);
  assert.match(chat, /const newMessage = messages\.length !== prevLenRef\.current;/);
  /* المؤقّت: ثوانٍ تدق داخل مرحلة التفكير */
  assert.match(aiJsx, /const \[secs, setSecs\] = useState\(0\);/);
  assert.match(aiJsx, /nx-ai-thinking-time/);
  assert.match(studioCss, /\.nxs-thread \.nx-ai-thinking-time \{ color: var\(--text-2\); \}/);
  assert.match(cssFile, /:root\[data-theme=light\] \.nx-ai-thinking-time\{color:#5b617e\}/);
  /* الخادم: مهلات أقصر قبل التراجع للمزوّد التالي + تعليمات إجابة أذكى */
  assert.match(apiJs, /AI_PROVIDER_TIMEOUT = \{ openai: 10000, gemini: 6000, openrouter: 11000, pollinations: 12000 \};/);
  assert.match(apiJs, /structure longer answers with short headings or bullet points/);
});

test('الجولة الخامسة: سباق المزوّدين للإجابة السريعة + مربع كتابة محايد بلا برتقالي', () => {
  /* السباق: المجانيون ينطلقون فور فشل المدفوعين أو بعد مهلة تفوق 4 ثوانٍ،
     وأول بث يبدأ يملك المجرى فتُهمَل دلتا الخاسر المتأخر */
  assert.match(apiJs, /AI_KEYLESS_HEAD_START_MS = 4000;/);
  assert.match(apiJs, /let streamOwner = null;/);
  assert.match(apiJs, /const paidChain = \(async \(\) => \{/);
  assert.match(apiJs, /const keylessChain = \(async \(\) => \{/);
  assert.match(apiJs, /onDelta: relay\('openai'\)/);
  assert.match(apiJs, /onDelta: relay\('llm7'\)/);
  assert.match(apiJs, /if \(raceWinner\) return raceWinner;/);
  /* المربع: إطار محايد في التركيز والانشغال — بلا برتقالي */
  assert.match(studioCss, /\.nxs-composer\.focused \{\n  border-color: var\(--text-3\);\n  box-shadow: var\(--shadow-m\);\n\}/);
  assert.match(studioCss, /\.nxs-composer\.busy \{ border-color: var\(--line\); \}/);
  assert.doesNotMatch(studioCss, /rgba\(180, 85, 45/);
});

test('الجولة السادسة: لا خفوت بعد الآن — نص المستخدم بوزن كامل وألوان أغمق', () => {
  /* رسالة المستخدم كانت بلا وزن خط إطلاقًا (ترث 400 النحيف) — الآن 600 */
  assert.match(studioCss, /\.nxs-user-text \{ font-size: 14px; line-height: 1\.6; font-weight: 600; white-space: pre-wrap; word-break: break-word; \}/);
  /* الألوان الثانوية أغمق في الوضعين — كانت التباين 3.4:1 فقط */
  assert.match(studioCss, /--text-3: #6b655a;/);
  assert.match(studioCss, /--text-3: #a5a094;/);
  assert.doesNotMatch(studioCss, /#8a8478/);
  assert.doesNotMatch(studioCss, /#7d776c/);
  /* لا أوزان 450 نحيفة متبقية */
  assert.doesNotMatch(studioCss, /font: 450 /);
  /* اسم الموديل أكبر تحت الرد */
  assert.match(studioCss, /\.nxs-asst-model \{ font-size: 11\.5px; color: var\(--text-3\); \}/);
  /* منصة الذكاء: فقرات الرد بوزن 600 أيضًا */
  assert.match(cssFile, /\.nx-md p,\.nx-md li\{font-weight:600\}/);
});

test('الجولة السابعة: نص أبيض لم يعد + وكيل يعمل عملًا حقيقيًا بلا مفاتيح', () => {
  /* 1) الخط الأبيض: عارض الماركداون المشترك يحمل حبرًا أبيض لمنصة الذكاء
     الداكنة، وكان ثيم جذر الصفحة (الداكن افتراضيًا) يجعله أبيض على كريم
     الاستوديو — الآن الاستوديو يملك لونه بنفسه في كل الحالات */
  assert.match(studioCss, /\.nxs \.nx-md \{ color: var\(--ink\); \}/);
  assert.match(studioCss, /\.nxs \.nx-md h1, \.nxs \.nx-md h2, \.nxs \.nx-md h3, \.nxs \.nx-md h4 \{ color: var\(--ink\); \}/);
  assert.match(studioCss, /\.nxs \.nx-md a \{ color: var\(--blue\); \}/);
  assert.match(studioCss, /:root\[data-theme=light\] \.nxs \.nx-md,/);
  /* 2) سلسلة الوكيل صارت تملك مزوّدًا مجانيًا ثانيًا (llm7) بعد Pollinations */
  assert.match(studioAi, /id: 'llm7', label: 'llm7\.io \(free\)', kind: 'openai', keyless: true,/);
  assert.match(studioAi, /base: \(\) => 'https:\/\/api\.llm7\.io\/v1',/);
  /* 3) العمل الحقيقي: إن ردّ النموذج على create/continue بلا أي وسم ملف،
     جولة تصحيح واحدة تعيد طلب الملفات صراحة قبل الاستسلام */
  assert.match(routesJs, /const streamerHandlers = \{/);
  assert.match(routesJs, /const retryStreamer = createProtocolStreamer\(streamerHandlers\);/);
  assert.match(routesJs, /Your previous answer contained no <file> tag, so no file was created\./);
  assert.match(routesJs, /Retrying file output \(protocol\)/);
});

test('الجولة الثامنة: إعلانات الويب في الاستوديو + خصوصية محدّثة + sitemap لإعادة الفهرسة', () => {
  /* الإعلان: حاوية Adsterra المحروسة تركب في عمود محادثة الاستوديو — ويب فقط،
     وأبدًا ليس داخل تطبيق أندرويد (هناك AdMob) */
  assert.match(webAd, /Capacitor\.isNativePlatform\(\)\) return null;/);
  assert.match(webAd, /AdsterraBanner/);
  assert.match(chat, /<StudioWebAd \/>/);
  assert.match(studioCss, /\.nxs-chat \.nx-adsterra-placement \{ width: min\(768px, 100%\); \}/);
  /* الخصوصية: قسم الاستوديو والتكاملات + التاريخ الجديد + بقاء مصطلحات الشبكات */
  assert.match(privacyAr, /NEXORA Studio/);
  assert.match(privacyAr, /Google Docs/);
  assert.match(privacyAr, /GitHub وVercel/);
  assert.match(privacyAr, /18 نوفمبر 2026/);
  assert.doesNotMatch(privacyAr, /(15|17) نوفمبر 2026/);
  assert.match(privacyEn, /NEXORA Studio/);
  assert.match(privacyEn, /18 November 2026/);
  for (const term of ['Adsterra', 'Monetag', 'AdSense', 'AdMob']) {
    assert.ok(privacyAr.includes(term), 'privacy ar: ' + term);
    assert.ok(privacyEn.includes(term), 'privacy en: ' + term);
  }
  /* خريطة الموقع: تاريخ اليوم على كل الروابط لإعادة الفهرسة */
  assert.match(sitemap, /<lastmod>2026-11-18<\/lastmod>/);
  assert.doesNotMatch(sitemap, /<lastmod>2026-11-1[57]<\/lastmod>/);
});
