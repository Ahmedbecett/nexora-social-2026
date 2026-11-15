// Generates the public, JavaScript-free information pages and sitemap.
// The interactive app remains at /; Vite copies public/ into dist/ on every build.
// Run `npm run generate:seo` when editing the copy below. --check is used by tests.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'https://nexora-social-2026.vercel.app';
// Change this date only when the public copy actually changes, not on every build.
const lastmod = '2026-11-15';
const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version;
// Rounded size stays honest even when CI refreshes the APK with small binary changes.
const apkSize = Math.round(statSync(resolve(root, 'public/download/Nexora.apk')).size / 1_000_000);
const url = (path) => base + path;
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const json = (data) => JSON.stringify(data).replaceAll('<', String.fromCharCode(92) + 'u003c');

export const pairs = {
  home: { ar: '/', en: '/en.html' },
  about: { ar: '/about.html', en: '/en/about.html' },
  features: { ar: '/features.html', en: '/en/features.html' },
  download: { ar: '/download.html', en: '/en/download.html' },
  faq: { ar: '/faq.html', en: '/en/faq.html' },
  privacy: { ar: '/privacy.html', en: '/en/privacy.html' },
};

const faq = {
  ar: [
    ['ما هو NEXORA AI؟', 'منصة ذكاء اصطناعي متكاملة على الويب — مثل Arena AI — للمحادثة والكتابة والبرمجة والترجمة والتلخيص وإنشاء الصور مباشرة في المتصفح.'],
    ['هل NEXORA شبكة اجتماعية؟', 'لا. هي منصة ذكاء اصطناعي متكاملة، وليست شبكة للنشر أو الريلز أو الرسائل بين الأشخاص. يمكنك طلب المساعدة في صياغة محتوى تنشره بنفسك في أماكن أخرى.'],
    ['هل أحتاج إلى حساب؟', 'يمكنك قراءة هذه الصفحات دون حساب. لإرسال طلبات إلى المساعد وحفظ محادثاتك، سجّل الدخول أو أنشئ حساباً.'],
    ['هل الاستخدام مجاني؟', 'المنصة تعمل على الويب مع نقطة بداية مجانية. قد تنطبق حدود استخدام على بعض الميزات، ويعتمد توفر النماذج على المزوّد؛ راجع ما يظهر لك داخل حسابك.'],
    ['هل أحتاج لتحميل تطبيق؟', 'لا — NEXORA تعمل كاملة على الويب بدون تثبيت. يتوفر ملف APK كخيار ثانوي لمن يفضّل التطبيق على أندرويد 6.0+.'],
    ['هل إجابات المساعد دقيقة دائماً؟', 'لا. قد يخطئ الذكاء الاصطناعي؛ تحقق من المعلومات المهمة والمصادر قبل اتخاذ قرارات طبية أو قانونية أو مالية أو مشاركة محتوى.'],
  ],
  en: [
    ['What is NEXORA AI?', 'A full web AI platform — like Arena AI — for chat, writing, coding, translation, summaries and image generation directly in your browser.'],
    ['Is NEXORA a social networking app?', 'No. It is a complete AI platform, not a social network with a feed, reels or person-to-person messaging. You can ask it to draft content to publish elsewhere yourself.'],
    ['Do I need an account?', 'You can read these pages without an account. To send prompts to the assistant and save conversations, sign in or create an account.'],
    ['Is it free to use?', 'The web platform has a free starting tier. Some features may have usage limits, and model availability depends on providers; check the options shown in your account.'],
    ['Do I need to download an app?', 'No — NEXORA works fully on the web without installation. An APK is available as an optional download for Android 6.0+.'],
    ['Are AI answers always accurate?', 'No. AI can make mistakes. Check important claims and sources before making medical, legal or financial decisions or publishing generated content.'],
  ],
};

const copy = {
  en: {
    home: {
      title: 'NEXORA AI | Web AI Platform — Chat, Code & Create',
      description: 'NEXORA AI is a web-first AI platform like Arena AI — chat, writing, coding, translation and image generation directly in your browser. No install required.',
      eyebrow: 'A complete web AI platform', heading: 'Build, write and create with NEXORA AI',
      lead: 'A full platform like Arena AI: ask, write, code, translate and generate images — all in your browser. No APK needed to get started.',
      body: `<section><h2>What can you do here?</h2><p>Everything runs on the web platform — like Arena AI. Start with a question and follow up in the same conversation. Pick a focused tool for a first draft or a technical problem; your own judgement still matters when checking the answer.</p>
        <div class="seo-grid"><article><h3>AI chat and research</h3><p>Explore a topic in Arabic or English, request a concise explanation and ask follow-up questions. Web search with source links is available when supported by the service.</p></article><article><h3>Write, translate and summarize</h3><p>Draft a message or outline, rephrase an awkward sentence, translate between languages or extract key points from a longer passage.</p></article><article><h3>Code and create images</h3><p>Ask for a code example or explanation, or describe an image you want to generate. Some features depend on provider availability and usage limits.</p></article></div></section>
        <section class="seo-callout"><h2>Start instantly in your browser</h2><p>The full platform runs on the web — just like Arena AI. Create an account to send prompts and save conversations. No installation required.</p><a class="seo-button" href="/">Open the AI workspace</a><a class="seo-button secondary" href="/en/features.html">Explore features</a></section>
        <section><h2>Learn before you sign in</h2><p>See the <a href="/en/features.html">feature guide</a> for practical examples, read <a href="/en/about.html">about the project</a>, or check the <a href="/en/faq.html">frequently asked questions</a> for account, download and accuracy information.</p></section>`,
    },
    about: {
      title: 'About NEXORA AI | Web AI Platform by Ahmed Becetti',
      description: 'Learn what NEXORA AI is — a web-first AI platform like Arena AI — and how it differs from social apps. Built by Ahmed Becetti for your browser.',
      eyebrow: 'About the platform', heading: 'A complete web workspace for ideas',
      lead: 'NEXORA AI is a web platform by Ahmed Becetti (AI BECETTI) — inspired by Arena AI — bringing chat, writing, coding and creation together in your browser.',
      body: `<section><h2>Why a web platform?</h2><p>Like Arena AI, NEXORA runs fully on the web. No APK is needed — open your browser and start. Chat, writing, coding, translation, summaries and images are available in one workspace so you can move from a first question to a useful draft without switching apps.</p><p>An account is needed to send prompts and keep conversation history. The public information pages remain readable without one. An optional Android APK is available for those who prefer an app, but the web platform is complete on its own.</p></section>
        <section><h2>About the name</h2><p>The project repository and web address include “social”, but this deployed version is <strong>NEXORA AI — a web platform like Arena AI</strong>. It does not offer a public social feed, reels or direct messaging. Older social screens remain in the repository for reference but are not part of the running platform.</p></section>
        <section><h2>Responsible use</h2><p>Generated text and images can be useful starting points, not guarantees. Review outputs and verify important claims. Tools such as live search, voice and image generation may vary with device capabilities, usage limits and available providers.</p><p>Explore the <a href="/en/features.html">feature guide</a> and <a href="/en/privacy.html">privacy policy</a> or <a href="/">open the platform</a> directly.</p></section>`,
    },
    features: {
      title: 'NEXORA AI Features | Web Platform — Chat, Code & Create',
      description: 'Explore NEXORA AI as a web AI platform like Arena AI — chat, drafting, coding, translation, images, voice and file analysis in your browser.',
      eyebrow: 'Explore the platform', heading: 'A full platform for thinking and building',
      lead: 'Everything you need in one web workspace — just like Arena AI. Choose the tool that fits the task and refine until it is right.',
      body: `<section><h2>Ask, write and refine</h2><div class="seo-grid"><article><h3>AI chat</h3><p>Ask a question, request a step-by-step explanation or continue from an earlier answer. Saved conversations are available in your signed-in account.</p></article><article><h3>Writing assistance</h3><p>Turn bullet points into a first draft, make a paragraph shorter or try a different tone. You decide what to keep, edit and publish.</p></article><article><h3>Summaries and translation</h3><p>Pull out key ideas from provided text or request a translation. You can write prompts in Arabic, English and other supported languages; quality can vary by provider.</p></article></div></section>
        <section><h2>Build and explore</h2><div class="seo-grid"><article><h3>Coding help</h3><p>Request an example, ask what an error means or compare possible approaches. Check and run any generated code before using it in a project.</p></article><article><h3>Image creation and analysis</h3><p>Describe an image to generate or attach an image for interpretation. Generation and vision requests rely on third-party AI providers and may be subject to limits.</p></article><article><h3>Files, voice and sources</h3><p>Attach a PDF, DOCX or text file, dictate a request, listen to a response or enable web search with source links — all in the browser. Microphone access is requested only when you use voice.</p></article></div></section>
        <section class="seo-callout"><h2>Use the full platform on the web</h2><p>Like Arena AI — no install, no APK. Sign in and start working immediately.</p><a class="seo-button" href="/">Open NEXORA AI</a><a class="seo-button secondary" href="/en/faq.html">Read common questions</a></section>`,
    },
    download: {
      title: 'NEXORA AI — Web Platform | Optional Android APK',
      description: 'NEXORA AI is a web platform first — like Arena AI. An optional Android APK is available. Prefer the browser: no install needed. APK version and size inside.',
      eyebrow: 'Web platform first', heading: 'NEXORA AI runs on the web',
      lead: 'The complete platform is on the web — no download needed. An Android APK is available as an optional extra for those who want it.',
      body: `<section class="seo-callout"><h2>Use the web platform — no install</h2><p><strong>Web platform</strong> · Works in any modern browser · <strong>APK optional</strong> · Version ${esc(version)} · about ${apkSize} MB · Android 6.0+ if you want the app.</p><a class="seo-button" href="/">Open NEXORA AI on the web</a><a class="seo-button secondary" href="/download/Nexora.apk" download>Download optional APK</a></section>
        <section><h2>Why web first?</h2><p>Like Arena AI, NEXORA is a complete web platform. You get all features — chat, code, images, files, voice and search — directly in your browser with your account. No APK, no store, no extra steps.</p></section>
        <section><h2>Optional APK — if you want it</h2><ol><li>Download the optional APK from the link above on Android.</li><li>Open the file. Android may ask you to allow installation from this source; review the prompt before continuing.</li><li>Open NEXORA AI and sign in — same account, same backend as the web.</li></ol><p>The APK is optional — <a href="/">the web platform is complete</a> without it.</p></section>`,
    },
    faq: {
      title: 'NEXORA AI FAQ | Web Platform, Accounts & Answers',
      description: 'Answers about NEXORA AI as a web platform like Arena AI — what it does, accounts, optional Android download, limits and AI accuracy.',
      eyebrow: 'Frequently asked questions', heading: 'Answers before you get started',
      lead: 'Learn what is available in this release and what to expect from an AI assistant. For help with your account, consult the privacy page for contact details.',
      body: `<section><h2>Using NEXORA AI</h2><p>NEXORA is a full web platform like Arena AI — no download required. See the <a href="/en/features.html">feature guide</a> for examples. An optional <a href="/en/download.html">APK download</a> exists for Android.</p></section>`,
    },
  },
  ar: {
    about: {
      title: 'حول NEXORA AI | منصة ويب ذكية من أحمد بسيتي',
      description: 'تعرّف على NEXORA AI كمنصة ويب متكاملة مثل Arena AI — محادثة وبرمجة وكتابة وترجمة مباشرة في المتصفح. من تطوير أحمد بسيتي.',
      eyebrow: 'عن المنصة', heading: 'منصة ويب متكاملة لأفكارك',
      lead: 'يطوّر أحمد بسيتي (AI BECETTI) منصة NEXORA AI كمنصة ويب متكاملة مثل Arena AI — كل الأدوات في المتصفح بدون تثبيت.',
      body: `<section><h2>لماذا منصة ويب؟</h2><p>مثل Arena AI، تعمل NEXORA كاملة على الويب — بدون APK. افتح المتصفح وابدأ: محادثة، كتابة، برمجة، ترجمة، تلخيص وصور في مساحة واحدة. تابع تحسين النتيجة بدون تبديل تطبيقات.</p><p>يتطلب إرسال الطلبات وحفظ السجل حساباً؛ قراءة هذه الصفحات لا تتطلب تسجيل. يتوفر APK اختياري لمن يفضّل التطبيق، لكن المنصة كاملة على الويب.</p></section>
        <section><h2>عن الاسم والنسخة الحالية</h2><p>يحمل اسم المستودع ورابط الموقع كلمة “social”، لكن النسخة المنشورة هي <strong>NEXORA AI — منصة ويب مثل Arena AI</strong>. لا توفر موجز منشورات أو ريلز أو رسائل بين المستخدمين. شاشات اجتماعية قديمة بقيت في الشيفرة للمرجع فقط وليست جزءاً من المنصة.</p></section>
        <section><h2>استخدام واعٍ</h2><p>النصوص والصور المولّدة نقاط بداية مفيدة، وليست ضماناً للدقة. راجع الإجابات وتحقق من المعلومات المهمة. يعتمد توفر البحث الحي والصوت وتوليد الصور على إمكانات الجهاز وحدود الاستخدام والمزوّدين المتاحين.</p><p>استكشف <a href="/features.html">الميزات</a> أو اقرأ <a href="/privacy.html">سياسة الخصوصية</a> أو <a href="/">افتح المنصة مباشرة</a>.</p></section>`,
    },
    features: {
      title: 'ميزات NEXORA AI | منصة ويب — محادثة وبرمجة وإبداع',
      description: 'اكتشف NEXORA AI كمنصة ويب متكاملة مثل Arena AI — محادثة، كتابة، برمجة، ترجمة، صور وصوت وتحليل ملفات في المتصفح.',
      eyebrow: 'استكشف المنصة', heading: 'منصة كاملة للتفكير والبناء',
      lead: 'كل ما تحتاجه في مساحة ويب واحدة مثل Arena AI — اختر الأداة لمهمتك وتابع الحوار حتى تصل للنتيجة المطلوبة.',
      body: `<section><h2>اسأل واكتب وحسّن</h2><div class="seo-grid"><article><h3>المحادثة الذكية</h3><p>اطرح سؤالاً أو اطلب شرحاً خطوة بخطوة ثم تابع بأسئلة أخرى. محادثاتك محفوظة في حسابك على المنصة.</p></article><article><h3>مساعدة الكتابة</h3><p>حوّل نقاطاً سريعة إلى مسودة، اختصر فقرة أو غيّر أسلوب النص. أنت تختار ما تحتفظ به وتنشره.</p></article><article><h3>التلخيص والترجمة</h3><p>استخرج الأفكار من نص أو اطلب ترجمة. تكتب طلباتك بالعربية أو الإنجليزية؛ تختلف الجودة بحسب المزوّد.</p></article></div></section>
        <section><h2>ابنِ واستكشف</h2><div class="seo-grid"><article><h3>مساعد البرمجة</h3><p>اطلب مثال كود أو تفسير خطأ أو مقارنة حلول. افحص الكود وشغّله قبل الاستخدام.</p></article><article><h3>الصور وتحليلها</h3><p>صف صورة لإنشائها أو أرفق صورة لتحليلها. تعتمد الخدمة على مزوّدين خارجيين وقد تخضع لحدود.</p></article><article><h3>الملفات والصوت والمصادر</h3><p>أرفق PDF أو DOCX أو نص، أملِ طلبك صوتياً، استمع للرد، أو فعّل بحث الويب بالمصادر — كل ذلك في المتصفح. يُطلب الميكروفون عند الاستخدام فقط.</p></article></div></section>
        <section class="seo-callout"><h2>المنصة كاملة على الويب</h2><p>مثل Arena AI — بدون تثبيت. سجّل الدخول وابدأ العمل فوراً.</p><a class="seo-button" href="/">افتح NEXORA AI</a><a class="seo-button secondary" href="/faq.html">الأسئلة الشائعة</a></section>`,
    },
    download: {
      title: 'NEXORA AI — منصة ويب | تحميل APK اختياري',
      description: 'NEXORA AI منصة ويب أولاً مثل Arena AI — بدون تثبيت. تحميل APK اختياري لمن يريد التطبيق. الإصدار والحجم داخل الصفحة.',
      eyebrow: 'المنصة على الويب أولاً', heading: 'NEXORA AI تعمل على الويب',
      lead: 'المنصة كاملة في المتصفح — بدون تحميل. يتوفر APK اختياري لمن يفضّل التطبيق على أندرويد.',
      body: `<section class="seo-callout"><h2>استخدم المنصة على الويب — بدون تثبيت</h2><p><strong>منصة ويب</strong> · تعمل في أي متصفح حديث · <strong>APK اختياري</strong> · الإصدار ${esc(version)} · حوالي ${apkSize} ميغابايت · أندرويد 6.0+ إن أردت التطبيق.</p><a class="seo-button" href="/">افتح NEXORA AI على الويب</a><a class="seo-button secondary" href="/download/Nexora.apk" download>تحميل APK الاختياري</a></section>
        <section><h2>لماذا الويب أولاً؟</h2><p>مثل Arena AI، NEXORA منصة ويب كاملة: كل الميزات — محادثة، برمجة، صور، ملفات، صوت وبحث — في المتصفح مباشرة مع حسابك. لا APK ولا متجر ولا خطوات إضافية.</p></section>
        <section><h2>APK اختياري — إن رغبت</h2><ol><li>نزّل ملف APK الاختياري من الرابط أعلاه على أندرويد.</li><li>افتح الملف؛ قد يطلب أندرويد السماح بالتثبيت من هذا المصدر.</li><li>سجّل الدخول — نفس الحساب ونفس الخادم كالويب.</li></ol><p>الـ APK اختياري — <a href="/">المنصة كاملة على الويب</a> بدونه.</p></section>
        <section><h2>قبل التحميل</h2><p>حمّل من الرابط الرسمي فقط إن أردت الـ APK. على الويب لا تحتاج تحميلاً. راجع <a href="/features.html">الميزات</a> و<a href="/faq.html">الأسئلة الشائعة</a> و<a href="/privacy.html">الخصوصية</a> أولاً.</p></section>`,
    },
    faq: {
      title: 'الأسئلة الشائعة عن NEXORA AI | منصة الويب',
      description: 'إجابات عن NEXORA AI كمنصة ويب مثل Arena AI: هل هي شبكة اجتماعية؟ هل أحتاج تحميل؟ ما حدود الاستخدام؟',
      eyebrow: 'الأسئلة الشائعة', heading: 'إجابات قبل أن تبدأ',
      lead: 'تعرّف على الخدمات المتاحة في النسخة الحالية وكيف تستخدم المساعد الذكي بوعي. ستجد معلومات التواصل المتعلقة بحسابك في صفحة الخصوصية.',
      body: `<section><h2>استخدام NEXORA AI</h2><p>NEXORA منصة ويب متكاملة مثل Arena AI — تعمل بدون تحميل. راجع <a href="/features.html">دليل الميزات</a> أو <a href="/download.html">صفحة APK الاختياري</a> إن رغبت بالتطبيق.</p></section>`,
    },
  },
};

const labels = {
  ar: { lang: 'العربية', other: 'English', brand: 'NEXORA AI', home: 'الرئيسية', about: 'حول', features: 'الميزات', download: 'التحميل', faq: 'الأسئلة الشائعة', privacy: 'الخصوصية', app: 'افتح المنصة', footer: 'NEXORA AI منصة ويب متكاملة للذكاء الاصطناعي — مثل Arena AI. طوّرها أحمد بسيتي.', related: 'المزيد عن NEXORA AI', relatedText: 'منصة ويب متكاملة — استكشف الميزات وابدأ مباشرة في المتصفح.' },
  en: { lang: 'English', other: 'العربية', brand: 'NEXORA AI', home: 'Home', about: 'About', features: 'Features', download: 'Download', faq: 'FAQ', privacy: 'Privacy', app: 'Open platform', footer: 'NEXORA AI — a complete web AI platform like Arena AI, by Ahmed Becetti.', related: 'Explore NEXORA AI', relatedText: 'A complete web platform — explore features and open it in your browser.' },
};

function alternateLinks(pair) {
  return `<link rel="alternate" hreflang="ar" href="${url(pair.ar)}" />\n<link rel="alternate" hreflang="en" href="${url(pair.en)}" />\n<link rel="alternate" hreflang="x-default" href="${url(pair.en)}" />`;
}
function breadCrumbs(lang, key, data) {
  const names = labels[lang];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: names.home, item: url(pairs.home[lang]) },
      { '@type': 'ListItem', position: 2, name: data.heading, item: url(pairs[key][lang]) },
    ],
  };
}
function render(lang, key, data) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const names = labels[lang];
  const path = pairs[key][lang];
  const id = url(path);
  const langOther = lang === 'ar' ? 'en' : 'ar';
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': key === 'faq' ? 'FAQPage' : key === 'about' ? 'AboutPage' : 'WebPage',
        '@id': `${id}#webpage`, url: id, name: data.title, description: data.description, inLanguage: lang,
        isPartOf: { '@id': `${base}/#website` },
        ...(key === 'faq' ? { mainEntity: faq[lang].map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) } : {}),
        ...(key === 'home' ? {} : { breadcrumb: { '@id': `${id}#breadcrumb` } }),
      },
      ...(key === 'home' ? [] : [{ ...breadCrumbs(lang, key, data), '@id': `${id}#breadcrumb` }]),
    ],
  };
  const faqBody = key === 'faq' ? `<section class="seo-faq" aria-label="${esc(data.heading)}">${faq[lang].map(([question, answer]) => `<article><h3>${esc(question)}</h3><p>${esc(answer)}</p></article>`).join('\n')}</section>` : '';
  const nav = Object.keys(pairs).map((item) => `<a href="${pairs[item][lang]}"${item === key ? ' aria-current="page"' : ''}>${esc(names[item])}</a>`).join('');
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#15102c" />
<title>${esc(data.title)}</title>
<meta name="description" content="${esc(data.description)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${id}" />
${alternateLinks(pairs[key])}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="NEXORA AI" />
<meta property="og:locale" content="${lang === 'ar' ? 'ar_DZ' : 'en_US'}" />
<meta property="og:title" content="${esc(data.title)}" />
<meta property="og:description" content="${esc(data.description)}" />
<meta property="og:url" content="${id}" />
<meta property="og:image" content="${base}/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="NEXORA AI — AI chat, writing, coding and images" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(data.title)}" />
<meta name="twitter:description" content="${esc(data.description)}" />
<meta name="twitter:image" content="${base}/og-image.jpg" />
<link rel="icon" type="image/png" href="/favicon-48.png" />
<link rel="stylesheet" href="/seo.css" />
<script type="application/ld+json">${json(schema)}</script>
<script src="/monetag-web.js" defer></script>
<script src="/adsterra-web.js" defer></script>
</head>
<body class="seo-page">
<a class="seo-skip" href="#content">${lang === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
<header class="seo-header"><div class="seo-container seo-header-inner"><a class="seo-brand" href="${pairs.home[lang]}"><img src="/mascot-ui.webp" width="42" height="42" alt="" /><span>NEXORA <b>AI</b></span></a><nav aria-label="${lang === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}">${nav}</nav><a class="seo-language" href="${pairs[key][langOther]}" lang="${langOther}" hreflang="${langOther}">${names.other}</a></div></header>
<main id="content" class="seo-container">
${key === 'home' ? '' : `<nav class="seo-breadcrumb" aria-label="${lang === 'ar' ? 'مسار التصفح' : 'Breadcrumb'}"><a href="${pairs.home[lang]}">${names.home}</a><span aria-hidden="true"> / </span><span>${esc(data.heading)}</span></nav>`}
<div class="seo-hero${key === 'home' ? ' seo-home' : ''}"><div><p class="seo-eyebrow">${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p class="seo-lead">${esc(data.lead)}</p>${key === 'home' ? `<div class="seo-actions"><a class="seo-button" href="/">${names.app}</a><a class="seo-button secondary" href="${pairs.features[lang]}">${names.features}</a></div>` : ''}</div>${key === 'home' ? '<img class="seo-hero-image" src="/mascot-ui.webp" alt="NEXORA AI mascot" width="256" height="256" fetchpriority="high" />' : ''}</div>
<div class="seo-adsterra" role="complementary" aria-label="${lang === 'ar' ? 'مساحة إعلانية' : 'Advertisement'}"><div id="container-5641403c5558334d50a26de1c90fe61d"></div></div>
${data.body}
${faqBody}
<section class="seo-more"><h2>${names.related}</h2><p>${names.relatedText}</p><div class="seo-links"><a href="${pairs.about[lang]}">${names.about}</a><a href="${pairs.features[lang]}">${names.features}</a><a href="${pairs.download[lang]}">${names.download}</a><a href="${pairs.faq[lang]}">${names.faq}</a></div></section>
</main>
<footer class="seo-footer"><div class="seo-container"><p>${names.footer}</p><a href="${pairs.privacy[lang]}">${names.privacy}</a> · <a href="${pairs.home[lang]}">${names.home}</a> · <a href="${pairs.home[langOther]}" lang="${langOther}" hreflang="${langOther}">${names.other}</a></div></footer>
</body>
</html>
`;
}

const files = new Map();
for (const [lang, entries] of Object.entries(copy)) {
  for (const [key, data] of Object.entries(entries)) {
    const path = pairs[key][lang];
    files.set(`public${path}`, render(lang, key, data));
  }
}
const allUrls = Object.values(pairs).flatMap((pair) => [pair.ar, pair.en]);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${Object.values(pairs).flatMap((pair) => [pair.ar, pair.en].map((path) => `  <url><loc>${url(path)}</loc><lastmod>${lastmod}</lastmod>${['ar', 'en', 'x-default'].map((lang) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${url(pair[lang === 'x-default' ? 'en' : lang])}" />`).join('')}</url>`)).join('\n')}\n</urlset>\n`;
files.set('public/sitemap.xml', sitemap);
files.set('public/sitemap-webapp.xml', sitemap); // Firebase hosting uses this file for /sitemap.xml

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    for (const [path, contents] of files) {
      if (readFileSync(resolve(root, path), 'utf8') !== contents) throw new Error(`Outdated ${path}: run npm run generate:seo`);
    }
  } else {
    for (const [path, contents] of files) {
      const target = resolve(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }
    console.log(`Generated ${files.size} SEO files for ${allUrls.length} indexable URLs (${version}, APK ${apkSize} MB).`);
  }
}
