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
    ['ما هو NEXORA AI؟', 'مساحة عمل للذكاء الاصطناعي تتيح المحادثة والمساعدة في الكتابة والبرمجة والترجمة والتلخيص وإنشاء الصور عبر الويب وتطبيق أندرويد.'],
    ['هل NEXORA شبكة اجتماعية؟', 'لا. الإصدار الحالي تطبيق محادثة مع الذكاء الاصطناعي، وليس شبكة للنشر أو الريلز أو الرسائل بين الأشخاص. يمكنك طلب المساعدة في صياغة محتوى تنشره بنفسك في أماكن أخرى.'],
    ['هل أحتاج إلى حساب؟', 'يمكنك قراءة هذه الصفحات دون حساب. لإرسال طلبات إلى المساعد وحفظ محادثاتك، سجّل الدخول أو أنشئ حساباً.'],
    ['هل الاستخدام مجاني؟', 'تتوفر نقطة بداية مجانية للويب وتطبيق أندرويد. قد تنطبق حدود استخدام على بعض الميزات، ويعتمد توفر النماذج والخدمات على المزوّد؛ راجع ما يظهر لك داخل حسابك.'],
    ['أين أحصل على تطبيق أندرويد؟', 'حمّل ملف APK الرسمي من صفحة التحميل على هذا الموقع. يتطلب التطبيق أندرويد 6.0 أو أحدث، وقد تحتاج إلى السماح بالتثبيت من مصدر موثوق على جهازك.'],
    ['هل إجابات المساعد دقيقة دائماً؟', 'لا. قد يخطئ الذكاء الاصطناعي؛ تحقق من المعلومات المهمة والمصادر قبل اتخاذ قرارات طبية أو قانونية أو مالية أو مشاركة محتوى.'],
  ],
  en: [
    ['What is NEXORA AI?', 'An AI workspace for chat, writing, coding, translation, summaries and image generation, available on the web and as an Android app.'],
    ['Is NEXORA a social networking app?', 'No. The current release is an AI chat application, not a social network with a feed, reels or person-to-person messaging. You can ask it to draft content to publish elsewhere yourself.'],
    ['Do I need an account?', 'You can read these pages without an account. To send prompts to the assistant and save conversations, sign in or create an account.'],
    ['Is it free to use?', 'There is a free starting option for the web and Android app. Some features may have usage limits, and model availability depends on providers; check the options shown in your account.'],
    ['Where can I get the Android app?', 'Download the official APK from the download page on this site. It requires Android 6.0 or later; your device may ask you to allow installation from a trusted source.'],
    ['Are AI answers always accurate?', 'No. AI can make mistakes. Check important claims and sources before making medical, legal or financial decisions or publishing generated content.'],
  ],
};

const copy = {
  en: {
    home: {
      title: 'NEXORA AI | AI Chat, Writing, Coding & Images',
      description: 'Explore NEXORA AI, a web and Android AI chat application for writing, coding, translation, summaries and image generation. Learn what it does and how to get started.',
      eyebrow: 'An AI workspace for real tasks', heading: 'Make ideas easier to explore with NEXORA AI',
      lead: 'Ask a question, refine a draft, work through code or turn a description into an image. NEXORA AI brings these tools together in a web app and an Android download.',
      body: `<section><h2>What can you do here?</h2><p>Start with a question and follow up in the same conversation. Pick a focused tool for a first draft or a technical problem; your own judgement still matters when checking the answer.</p>
        <div class="seo-grid"><article><h3>AI chat and research</h3><p>Explore a topic in Arabic or English, request a concise explanation and ask follow-up questions. Web search with source links is available when supported by the service.</p></article><article><h3>Write, translate and summarize</h3><p>Draft a message or outline, rephrase an awkward sentence, translate between languages or extract key points from a longer passage.</p></article><article><h3>Code and create images</h3><p>Ask for a code example or explanation, or describe an image you want to generate. Some features depend on provider availability and usage limits.</p></article></div></section>
        <section class="seo-callout"><h2>Start in your browser or on Android</h2><p>The workspace requires an account to send prompts and save your conversations. Reading these guides does not require sign-in.</p><a class="seo-button" href="/">Open the AI workspace</a><a class="seo-button secondary" href="/en/download.html">Get the Android app</a></section>
        <section><h2>Learn before you sign in</h2><p>See the <a href="/en/features.html">feature guide</a> for practical examples, read <a href="/en/about.html">about the project</a>, or check the <a href="/en/faq.html">frequently asked questions</a> for account, download and accuracy information.</p></section>`,
    },
    about: {
      title: 'About NEXORA AI | The AI Workspace by Ahmed Becetti',
      description: 'Learn what NEXORA AI is, who created it and how the current AI workspace differs from a social network. Explore the web and Android experience.',
      eyebrow: 'About the project', heading: 'A practical space for questions and creative work',
      lead: 'NEXORA AI is developed by Ahmed Becetti (AI BECETTI). The current release centers on an AI workspace for everyday writing, learning and building tasks.',
      body: `<section><h2>Why it exists</h2><p>Moving between separate tools can interrupt an idea. NEXORA AI offers chat plus dedicated entry points for writing, coding, translation, summaries and images so you can move from a first question to a more useful draft in one place.</p><p>It is available through the website and a downloadable Android APK. An account is needed to send prompts and keep conversation history. The public information pages remain readable without one.</p></section>
        <section><h2>About the name</h2><p>The project repository and web address include “social”, but this deployed version is <strong>NEXORA AI</strong>. It does not currently offer a public social feed, reels or direct messaging between users. Older social screens remain in the repository for reference but are not part of the running app. We do not advertise those unavailable features as live services.</p></section>
        <section><h2>Responsible use</h2><p>Generated text and images can be useful starting points, not guarantees. Review outputs and verify important claims. Tools such as live search, voice and image generation may vary with device capabilities, usage limits and available providers.</p><p>Read the <a href="/en/features.html">feature guide</a> and <a href="/en/privacy.html">privacy policy</a> to learn more, or <a href="/en/download.html">get the Android app</a>.</p></section>`,
    },
    features: {
      title: 'NEXORA AI Features | Chat, Code, Translate & Create',
      description: 'See how NEXORA AI supports AI chat, drafting, coding, translation, summaries, images, voice and file analysis on the web and Android.',
      eyebrow: 'Explore the tools', heading: 'Tools for thinking, writing and building',
      lead: 'Choose the tool that fits the task. NEXORA AI keeps the conversation in one workspace so you can ask for a clearer explanation or a different version.',
      body: `<section><h2>Ask, write and refine</h2><div class="seo-grid"><article><h3>AI chat</h3><p>Ask a question, request a step-by-step explanation or continue from an earlier answer. Saved conversations are available in your signed-in account.</p></article><article><h3>Writing assistance</h3><p>Turn bullet points into a first draft, make a paragraph shorter or try a different tone. You decide what to keep, edit and publish.</p></article><article><h3>Summaries and translation</h3><p>Pull out key ideas from provided text or request a translation. You can write prompts in Arabic, English and other supported languages; quality can vary by provider.</p></article></div></section>
        <section><h2>Build and explore</h2><div class="seo-grid"><article><h3>Coding help</h3><p>Request an example, ask what an error means or compare possible approaches. Check and run any generated code before using it in a project.</p></article><article><h3>Image creation and analysis</h3><p>Describe an image to generate or attach an image for interpretation. Generation and vision requests rely on third-party AI providers and may be subject to limits.</p></article><article><h3>Files, voice and sources</h3><p>Depending on device and service availability, attach a PDF, DOCX or text file, dictate a request, listen to a response or enable web search with source links. Microphone access is requested only when you use voice.</p></article></div></section>
        <section class="seo-callout"><h2>Try the real workspace</h2><p>Sign in to use the AI tools; these pages do not simulate a chat or replace the working application.</p><a class="seo-button" href="/">Open NEXORA AI</a><a class="seo-button secondary" href="/en/faq.html">Read common questions</a></section>`,
    },
    download: {
      title: 'Download NEXORA AI for Android | Official APK',
      description: 'Download the official NEXORA AI Android APK from this site. Check the version, file size and device requirements, or use the AI workspace in your browser.',
      eyebrow: 'Official Android download', heading: 'Take NEXORA AI with you',
      lead: 'Get the Android APK directly from this website, or use the same AI workspace in your browser without installing anything.',
      body: `<section class="seo-callout"><h2>NEXORA AI for Android</h2><p><strong>Version ${esc(version)}</strong> · APK · <strong>about ${apkSize} MB</strong> · Android 6.0 or later. The file is served from this site; it is not a Play Store listing.</p><a class="seo-button" href="/download/Nexora.apk" download>Download the official APK</a><a class="seo-button secondary" href="/">Use the web app instead</a></section>
        <section><h2>How to install</h2><ol><li>Download the APK using the button above on your Android device.</li><li>Open the downloaded file. Android may ask you to allow installation from this source; review the prompt before continuing.</li><li>Open NEXORA AI and sign in or create an account to use the assistant.</li></ol><p>If you prefer not to install an APK, <a href="/">use the browser version</a>. The actual app and its authentication run on the same backend; this page is only a download guide.</p></section>
        <section><h2>Before you install</h2><p>Only download from the official link above. Device compatibility, network access and AI provider availability affect individual tools. You can review the <a href="/en/features.html">features</a>, <a href="/en/faq.html">common questions</a> and <a href="/en/privacy.html">privacy policy</a> first.</p></section>`,
    },
    faq: {
      title: 'NEXORA AI FAQ | Accounts, Android & AI Answers',
      description: 'Answers to common NEXORA AI questions: what the app does, whether it is social media, account access, Android download, limits and AI accuracy.',
      eyebrow: 'Frequently asked questions', heading: 'Answers before you get started',
      lead: 'Learn what is available in this release and what to expect from an AI assistant. For help with your account, consult the privacy page for contact details.',
      body: `<section><h2>Using NEXORA AI</h2><p>These answers describe the current web and Android AI workspace. Read the <a href="/en/features.html">feature guide</a> for examples or <a href="/en/download.html">visit the download page</a> for the APK.</p></section>`,
    },
  },
  ar: {
    about: {
      title: 'حول NEXORA AI | مساحة الذكاء الاصطناعي من أحمد بسيتي',
      description: 'تعرّف على NEXORA AI ومطوّرها أحمد بسيتي، وعلى خدمات مساحة الذكاء الاصطناعي الحالية للويب وأندرويد والفرق بينها وبين الشبكات الاجتماعية.',
      eyebrow: 'عن المشروع', heading: 'مساحة للأسئلة والأفكار والعمل الإبداعي',
      lead: 'يطوّر أحمد بسيتي (AI BECETTI) منصة NEXORA AI لتجمع المساعدة الذكية في الكتابة والتعلّم والبرمجة في مساحة عمل واحدة.',
      body: `<section><h2>لماذا NEXORA AI؟</h2><p>قد تقاطع كثرة الأدوات مسار فكرة صغيرة. تجمع NEXORA AI المحادثة مع أدوات للكتابة والبرمجة والترجمة والتلخيص والصور، لتبدأ بسؤال وتتابع تحسين النتيجة في المكان نفسه.</p><p>يمكن الوصول إلى المساحة من الموقع أو عبر ملف APK لأندرويد. يتطلب إرسال الطلبات وحفظ سجل المحادثات حساباً؛ أما صفحات المعلومات هذه فيمكن قراءتها دون تسجيل.</p></section>
        <section><h2>عن الاسم والنسخة الحالية</h2><p>يحمل اسم المستودع ورابط الموقع كلمة “social”، لكن النسخة المنشورة اليوم هي <strong>NEXORA AI</strong>. لا توفر حالياً موجز منشورات أو ريلز أو رسائل مباشرة بين المستخدمين. بقيت شاشات اجتماعية قديمة في الشيفرة للرجوع إليها، لكنها ليست جزءاً من التطبيق الجاري تشغيله.</p></section>
        <section><h2>استخدام واعٍ</h2><p>النصوص والصور المولّدة نقاط بداية مفيدة، وليست ضماناً للدقة. راجع الإجابات وتحقق من المعلومات المهمة. يعتمد توفر البحث الحي والصوت وتوليد الصور على إمكانات الجهاز وحدود الاستخدام والمزوّدين المتاحين.</p><p>تعرّف على <a href="/features.html">الميزات</a> أو اقرأ <a href="/privacy.html">سياسة الخصوصية</a> أو <a href="/download.html">نزّل التطبيق</a>.</p></section>`,
    },
    features: {
      title: 'ميزات NEXORA AI | محادثة وكتابة وبرمجة وترجمة',
      description: 'اكتشف أدوات NEXORA AI للمحادثة الذكية والكتابة والبرمجة والترجمة والتلخيص وتوليد الصور وتحليل الملفات والصوت على الويب وأندرويد.',
      eyebrow: 'استكشف الأدوات', heading: 'أدوات للتفكير والكتابة والبناء',
      lead: 'اختر الأداة المناسبة لمهمتك. تتيح مساحة NEXORA AI متابعة الحوار لطلب شرح أوضح أو صياغة جديدة بدلاً من البدء من الصفر.',
      body: `<section><h2>اسأل واكتب وحسّن</h2><div class="seo-grid"><article><h3>المحادثة الذكية</h3><p>اطرح سؤالاً أو اطلب شرحاً خطوة بخطوة ثم تابع بأسئلة أخرى. تُحفظ محادثاتك في حسابك عند تسجيل الدخول.</p></article><article><h3>مساعدة الكتابة</h3><p>حوّل نقاطاً سريعة إلى مسودة، اختصر فقرة أو غيّر أسلوب النص. أنت من يقرر ما يراجعه وينشره لاحقاً.</p></article><article><h3>التلخيص والترجمة</h3><p>استخرج الأفكار الرئيسية من نص تقدمه أو اطلب ترجمة. يمكنك كتابة الطلبات بالعربية أو الإنجليزية وغيرها؛ تختلف جودة النتائج بحسب المزوّد.</p></article></div></section>
        <section><h2>ابنِ واستكشف</h2><div class="seo-grid"><article><h3>مساعد البرمجة</h3><p>اطلب مثال كود أو تفسير خطأ أو مقارنة بين حلّين. شغّل الكود الناتج وافحصه قبل استخدامه في مشروعك.</p></article><article><h3>الصور وتحليلها</h3><p>صف صورة تريد إنشاءها أو أرفق صورة لتحليلها. يعتمد التوليد وتحليل الصور على مزوّدي خدمة خارجيين وقد يخضعان لحدود الاستخدام.</p></article><article><h3>الملفات والصوت والمصادر</h3><p>بحسب الجهاز والخدمة المتاحة، يمكنك إرفاق PDF أو DOCX أو ملف نصي، أو إملاء طلبك، أو سماع الرد، أو تشغيل بحث ويب مع روابط المصادر. يُطلب إذن الميكروفون عند استخدام الصوت فقط.</p></article></div></section>
        <section class="seo-callout"><h2>جرّب المساحة الفعلية</h2><p>سجّل الدخول لاستخدام الأدوات؛ هذه الصفحات تشرح المنتج ولا تحاكي محادثة وهمية.</p><a class="seo-button" href="/">افتح NEXORA AI</a><a class="seo-button secondary" href="/faq.html">الأسئلة الشائعة</a></section>`,
    },
    download: {
      title: 'تحميل NEXORA AI لأندرويد | ملف APK الرسمي',
      description: 'حمّل ملف NEXORA AI الرسمي لأندرويد من الموقع. اطّلع على الإصدار وحجم الملف ومتطلبات الجهاز أو استخدم مساحة الذكاء الاصطناعي عبر المتصفح.',
      eyebrow: 'التحميل الرسمي لأندرويد', heading: 'خذ NEXORA AI معك',
      lead: 'حمّل ملف APK مباشرة من هذا الموقع، أو استخدم مساحة العمل نفسها من متصفحك دون تثبيت.',
      body: `<section class="seo-callout"><h2>NEXORA AI لأندرويد</h2><p><strong>الإصدار ${esc(version)}</strong> · ملف APK · <strong>حوالي ${apkSize} ميغابايت</strong> · أندرويد 6.0 أو أحدث. الملف متاح من هذا الموقع، وليس صفحة متجر Google Play.</p><a class="seo-button" href="/download/Nexora.apk" download>تحميل ملف APK الرسمي</a><a class="seo-button secondary" href="/">استخدام نسخة الويب</a></section>
        <section><h2>خطوات التثبيت</h2><ol><li>نزّل الملف من الزر أعلاه على جهاز أندرويد.</li><li>افتح الملف بعد التنزيل. قد يطلب أندرويد السماح بالتثبيت من هذا المصدر؛ راجع التنبيه قبل المتابعة.</li><li>افتح NEXORA AI وسجّل الدخول أو أنشئ حساباً لاستخدام المساعد.</li></ol><p>إن لم ترد تثبيت APK، <a href="/">استخدم المنصة في متصفحك</a>. يتصل التطبيق الحقيقي بنظام المصادقة والخادم نفسه؛ هذه الصفحة دليل تحميل فقط.</p></section>
        <section><h2>قبل أن تثبّت</h2><p>حمّل من الرابط الرسمي أعلاه فقط. تختلف الأدوات المتاحة بحسب توافق الجهاز والاتصال والمزوّدين. راجع <a href="/features.html">الميزات</a> و<a href="/faq.html">الأسئلة الشائعة</a> و<a href="/privacy.html">سياسة الخصوصية</a>.</p></section>`,
    },
    faq: {
      title: 'الأسئلة الشائعة عن NEXORA AI | الحساب والتطبيق',
      description: 'إجابات عن NEXORA AI: هل هي شبكة اجتماعية؟ كيف تنزّل تطبيق أندرويد؟ ما حدود الاستخدام ودقة إجابات الذكاء الاصطناعي؟',
      eyebrow: 'الأسئلة الشائعة', heading: 'إجابات قبل أن تبدأ',
      lead: 'تعرّف على الخدمات المتاحة في النسخة الحالية وكيف تستخدم المساعد الذكي بوعي. ستجد معلومات التواصل المتعلقة بحسابك في صفحة الخصوصية.',
      body: `<section><h2>استخدام NEXORA AI</h2><p>تصف هذه الإجابات مساحة الذكاء الاصطناعي الحالية على الويب وأندرويد. راجع <a href="/features.html">دليل الميزات</a> لأمثلة أو <a href="/download.html">صفحة التحميل</a> للحصول على ملف APK.</p></section>`,
    },
  },
};

const labels = {
  ar: { lang: 'العربية', other: 'English', brand: 'NEXORA AI', home: 'الرئيسية', about: 'حول', features: 'الميزات', download: 'التحميل', faq: 'الأسئلة الشائعة', privacy: 'الخصوصية', app: 'افتح المنصة', footer: 'مساحة NEXORA AI للمحادثة والإبداع. طوّرها أحمد بسيتي.', related: 'المزيد عن NEXORA AI', relatedText: 'تعرّف على الميزات، حمّل تطبيق أندرويد، أو ابدأ من المتصفح.' },
  en: { lang: 'English', other: 'العربية', brand: 'NEXORA AI', home: 'Home', about: 'About', features: 'Features', download: 'Download', faq: 'FAQ', privacy: 'Privacy', app: 'Open the app', footer: 'NEXORA AI is a workspace for chat and creative tasks by Ahmed Becetti.', related: 'Explore NEXORA AI', relatedText: 'Read about the features, download for Android or open the web workspace.' },
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
</head>
<body class="seo-page">
<a class="seo-skip" href="#content">${lang === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
<header class="seo-header"><div class="seo-container seo-header-inner"><a class="seo-brand" href="${pairs.home[lang]}"><img src="/mascot-ui.webp" width="42" height="42" alt="" /><span>NEXORA <b>AI</b></span></a><nav aria-label="${lang === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}">${nav}</nav><a class="seo-language" href="${pairs[key][langOther]}" lang="${langOther}" hreflang="${langOther}">${names.other}</a></div></header>
<main id="content" class="seo-container">
${key === 'home' ? '' : `<nav class="seo-breadcrumb" aria-label="${lang === 'ar' ? 'مسار التصفح' : 'Breadcrumb'}"><a href="${pairs.home[lang]}">${names.home}</a><span aria-hidden="true"> / </span><span>${esc(data.heading)}</span></nav>`}
<div class="seo-hero${key === 'home' ? ' seo-home' : ''}"><div><p class="seo-eyebrow">${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p class="seo-lead">${esc(data.lead)}</p>${key === 'home' ? `<div class="seo-actions"><a class="seo-button" href="/">${names.app}</a><a class="seo-button secondary" href="${pairs.features[lang]}">${names.features}</a></div>` : ''}</div>${key === 'home' ? '<img class="seo-hero-image" src="/mascot-ui.webp" alt="NEXORA AI mascot" width="256" height="256" fetchpriority="high" />' : ''}</div>
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
