// Generates the public, JavaScript-free information pages and sitemap.
// The interactive app remains at /; Vite copies public/ into dist/ on every build.
// Run `npm run generate:seo` when editing the copy below. --check is used by tests.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'https://nexora-social-2026.vercel.app';
// Change this date only when the public copy actually changes, not on every build.
// It is exported so `lastmod` in the sitemap, `dateModified` in the JSON-LD, the visible
// "last updated" line and the tests all read one value — a stale sitemap date tells Google
// nothing changed and delays re-crawling of pages that were just fixed.
export const LAST_UPDATED = { iso: '2026-11-24', ar: '24 نوفمبر 2026', en: '24 November 2026' };
const lastmod = LAST_UPDATED.iso;
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
    ['ما هو NEXORA Studio؟', 'هو باني التطبيقات داخل NEXORA: تصف التطبيق فيكتب ملفات المشروع الحقيقية، ثم تعدّلها وتشغّلها وتعاينها وتنشرها من نفس الحساب.'],
    ['هل إجابات المساعد دقيقة دائماً؟', 'لا. قد يخطئ الذكاء الاصطناعي؛ تحقق من المعلومات المهمة والمصادر قبل اتخاذ قرارات طبية أو قانونية أو مالية أو مشاركة محتوى.'],
    ['كيف أحذف حسابي وبياناتي؟', 'من داخل التطبيق: الحساب والأمان ← منطقة الخطر ← «حذف حسابي وكل بياناتي نهائيًا». يُحذف الحساب ومحتواه نهائيًا ولا يمكن التراجع، وتجد التفاصيل الكاملة في سياسة الخصوصية.'],
    ['هل محادثاتي ومشاريعي خاصة؟', 'نعم. محادثاتك ومشاريعك مرتبطة بحسابك ولا تُعرض لمستخدمين آخرين، ولا نبيعها ولا نستخدمها لتدريب النماذج. تُرسَل طلباتك إلى مزوّد الذكاء الاصطناعي المتاح لتوليد الرد فقط.'],
    ['بأي لغات تعمل NEXORA AI؟', 'الواجهة بالعربية والإنجليزية، ويمكنك كتابة طلباتك بعدة لغات يدعمها المزوّد. تختلف جودة الردود بحسب اللغة والنموذج المتاح وحدود الاستخدام.'],
  ],
  en: [
    ['What is NEXORA AI?', 'A full web AI platform — like Arena AI — for chat, writing, coding, translation, summaries and image generation directly in your browser.'],
    ['Is NEXORA a social networking app?', 'No. It is a complete AI platform, not a social network with a feed, reels or person-to-person messaging. You can ask it to draft content to publish elsewhere yourself.'],
    ['Do I need an account?', 'You can read these pages without an account. To send prompts to the assistant and save conversations, sign in or create an account.'],
    ['Is it free to use?', 'The web platform has a free starting tier. Some features may have usage limits, and model availability depends on providers; check the options shown in your account.'],
    ['Do I need to download an app?', 'No — NEXORA works fully on the web without installation. An APK is available as an optional download for Android 6.0+.'],
    ['What is NEXORA Studio?', 'It is the app builder inside NEXORA: you describe an app, it writes the real project files, and you edit, run, preview and publish them from the same account.'],
    ['Are AI answers always accurate?', 'No. AI can make mistakes. Check important claims and sources before making medical, legal or financial decisions or publishing generated content.'],
    ['How do I delete my account and data?', 'In the app: Account & Security → Danger zone → “Delete my account and all my data”. The account and its content are removed permanently; the privacy policy has the full details.'],
    ['Are my conversations and projects private?', 'Yes. Your conversations and projects belong to your account and are not shown to other users. We do not sell them or use them to train models; requests go to an available AI provider only to produce the answer.'],
    ['Which languages does NEXORA AI support?', 'The interface is Arabic and English, and you can write prompts in several languages supported by the provider. Answer quality varies with the language, the available model and usage limits.'],
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
        <section><h2>NEXORA Studio — build the app, not just the code</h2><p>Describe an app in plain language and Studio plans it, writes the real project files, opens them in a code editor, runs commands in a terminal and shows a live preview. You can save a project, reopen it without losing work, and publish it to GitHub or Vercel. It is part of NEXORA and runs on the same account.</p><div class="seo-grid"><article><h3>Plan, then build</h3><p>The assistant returns a plan with the files it intends to write, then creates them. Anything missing is reported instead of pretending the build finished.</p></article><article><h3>Real editor and terminal</h3><p>Edit files in the browser, run build and test commands, and read the actual output. Nothing in the workspace is simulated.</p></article><article><h3>Live preview and publishing</h3><p>See the app immediately after every change, save restore points, then publish to GitHub or Vercel from the same screen.</p></article></div></section>
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
      description: 'Clear answers about NEXORA AI — is it a social network, do you need an account or an APK, usage limits, conversation privacy, account deletion and supported languages.',
      eyebrow: 'Frequently asked questions', heading: 'Answers before you get started',
      lead: 'Learn what is available in this release and what to expect from an AI assistant. For help with your account, consult the privacy page for contact details.',
      body: `<section><h2>Using NEXORA AI</h2><p>NEXORA is a full web platform like Arena AI — no download required. See the <a href="/en/features.html">feature guide</a> for examples. An optional <a href="/en/download.html">APK download</a> exists for Android.</p></section>`,
    },
    privacy: {
      title: 'Privacy & Cookie Policy | NEXORA AI',
      description: 'What NEXORA AI collects and why: legal bases, sub-processors, cookies and ads, retention periods, your rights, and how to delete your account and data.',
      eyebrow: 'NEXORA AI · web and Android app',
      heading: 'Privacy and cookie policy',
      lead: 'Four questions answered in detail: what we collect, why, who processes it, and how you stay in control — in plain language.',
      toc: [
        ['who', 'Who we are and scope'],
        ['data', 'Data we collect'],
        ['use', 'Why we use your data'],
        ['legal', 'Legal bases'],
        ['ai', 'AI requests'],
        ['cookies', 'Cookies and local storage'],
        ['ads', 'Advertising'],
        ['sharing', 'Who we share data with'],
        ['retention', 'How long we keep data'],
        ['security', 'Security'],
        ['rights', 'Your rights'],
        ['delete', 'Deleting your account'],
        ['children', 'Children'],
        ['generated', 'Generated content and acceptable use'],
        ['transfers', 'International transfers'],
        ['changes', 'Changes to this policy'],
        ['contact', 'Contact us'],
      ],
      body: `<section id="who"><h2>1. Who we are and what this policy covers</h2>
        <p><strong>NEXORA AI</strong> is a web platform for AI chat and app building (with an optional Android app), developed and operated by <strong>Ahmed Becetti (AI BECETTI)</strong>, who is the controller of the personal data processed through the service.</p>
        <p>This policy applies to <a href="/en.html">nexora-social-2026.vercel.app</a>, the Android app, the public information pages (About, Features, Download, FAQ), NEXORA Studio, and any request sent through the service.</p>
        <p>It does not cover third-party services you open from links inside the platform — such as GitHub, Vercel, Google or ad networks. Each has its own privacy policy.</p></section>

        <section id="data"><h2>2. Data we collect</h2>
        <h3>Account and identity</h3>
        <ul><li>Name and username, email address or phone number, optional profile photo, and interface language.</li>
        <li>Internal account identifier, sign-in method (email, Google or phone), account creation date and last sign-in date.</li>
        <li>Passwords are stored as a one-way hash, never as readable text, and cannot be recovered by us.</li></ul>
        <h3>Content you send</h3>
        <ul><li>Messages, prompts and generated replies, conversations saved to your account, and images you ask us to generate.</li>
        <li>Files you intentionally upload (PDF, DOCX, text, images) and the processing needed to read them.</li>
        <li>NEXORA Studio project files, terminal commands, project revisions and restore points, and publish links when you publish.</li>
        <li>Usage preferences stored in your account (preferred model, reply language, display settings).</li></ul>
        <h3>Optional integrations</h3>
        <ul><li>When you connect Google Docs/Drive, GitHub or Vercel we request only the scopes the feature needs, and store access tokens encrypted on the server.</li>
        <li>No file from those services is read or sent unless you explicitly ask for it, and you can disconnect an integration at any time.</li></ul>
        <h3>Subscriptions and payments</h3>
        <ul><li>Subscription status and plan, transaction reference, and the payment identifier issued by the provider (PayPal, or a postal/bank transfer for paid plans).</li>
        <li>We never store card numbers or banking verification codes; those are entered directly with the payment provider.</li></ul>
        <h3>Technical data</h3>
        <ul><li>IP address, browser, operating system and device type, requested page and time, and error messages — for security and troubleshooting.</li>
        <li>The Android advertising identifier (Google AdMob) as configured on your device.</li></ul>
        <h3>What we do not request or collect</h3>
        <ul><li>No location, contacts, text messages, call logs, or photo-library access without your explicit choice.</li>
        <li>Android permissions are limited to internet, network state and microphone — the last one only while you use voice input.</li></ul></section>

        <section id="use"><h2>3. Why we use your data</h2>
        <ul><li><strong>Run the service:</strong> create your account, sign you in, verify by email or phone, and restore access.</li>
        <li><strong>Answer your requests:</strong> send the prompt to an AI provider, return the reply, and save the conversation to your account.</li>
        <li><strong>Build and publish:</strong> generate project files, run commands and publish an app only when you explicitly ask.</li>
        <li><strong>Security:</strong> prevent abuse, fraud and limit evasion, and detect attacks and outages.</li>
        <li><strong>Subscriptions:</strong> manage your plan, limits and receipts where applicable.</li>
        <li><strong>Service messages:</strong> verification codes, security alerts and material policy changes. We do not send marketing without consent you can withdraw.</li>
        <li><strong>Performance:</strong> aggregate, non-profiling measurements of speed and stability.</li></ul></section>

        <section id="legal"><h2>4. Legal bases for processing</h2>
        <p>Where the EU GDPR or a similar law applies, each purpose relies on a clear legal basis:</p>
        <ul><li><strong>Performance of a contract:</strong> providing the service you asked for (account, conversations, Studio, publishing).</li>
        <li><strong>Legitimate interests:</strong> service security, abuse prevention and stability — balanced so your fundamental rights are not overridden.</li>
        <li><strong>Consent:</strong> personalised advertising, optional notifications and third-party integrations. You can withdraw consent at any time in settings.</li>
        <li><strong>Legal obligation:</strong> keeping records required by law or answering a valid legal request.</li></ul></section>

        <section id="ai"><h2>5. How AI requests are processed</h2>
        <p>When you send a request, its text — with only the context needed, such as a file excerpt or the attachment you selected — is sent to one or more providers to generate the answer: OpenAI · Google Gemini · OpenRouter · Groq · Mistral · DeepSeek · xAI · Cerebras · GitHub Models · Pollinations · llm7.io, depending on what is available and enabled in the current deployment.</p>
        <ul><li>We do not use your content to train models, do not sell it, and do not use it for ad targeting from our servers.</li>
        <li>A provider may retain a request for a limited period under its own policy; we prefer providers that offer a no-retention option where available.</li>
        <li>Do not send sensitive data (medical, financial, identity documents, passwords) in prompts. Answers can be wrong, and verifying them is your responsibility.</li>
        <li>You can delete a conversation or project in the interface, which removes its content from your account.</li></ul></section>

        <section id="cookies"><h2>6. Cookies and local storage</h2>
        <p>We use limited local storage in your browser to run the interface, and we do not use it to track you across other websites:</p>
        <ul><li><strong>Essential:</strong> <code>nx_theme</code> (theme), <code>nx_view</code> (chosen view), and session or sign-in tokens — the platform cannot work without them.</li>
        <li><strong>Third party:</strong> ad networks (Google AdSense, AdMob, Monetag, Adsterra) may set cookies or identifiers for delivery, measurement and fraud prevention; this varies by country and your consent.</li>
        <li><strong>Global Privacy Control:</strong> we honour the browser's GPC signal; when it is set, the Adsterra and Monetag units are not loaded on web pages.</li>
        <li>You can clear local storage or block third-party cookies in your browser settings; some features, such as staying signed in, may stop working.</li></ul></section>

        <section id="ads"><h2>7. Advertising and how the service is funded</h2>
        <p><strong>On the website</strong> we may show Google AdSense, Monetag and Adsterra ads. Adsterra loads as a Native Banner and Monetag as OnClick/Popunder units on public pages, sign-in screens and chat; Monetag may open a new window or tab when clicked.</p>
        <p>Ad networks may process technical data such as IP address, browser identifiers, cookies and page interaction to serve and measure ads. Third-party ad code runs inside the web page and may technically read its content and user input; we do not send conversation history from our servers to ad networks for targeting, but we cannot guarantee what third-party code reads inside your browser.</p>
        <p><strong>In the Android app</strong> we show Google AdMob only: a banner under the welcome screen, a rare interstitial (at most once every 10 minutes and three times a day) on a natural transition, and an optional rewarded ad the user requests. AdMob never appears during text or voice conversations or over dialogs. Consent is handled by the Google UMP framework where it applies, and you can accept or refuse it in the in-app consent dialog.</p>
        <p>Managing personalised ads: <a href="https://adssettings.google.com" rel="nofollow noopener" target="_blank">Google Ads Settings</a> · <a href="https://www.aboutads.info/choices/" rel="nofollow noopener" target="_blank">aboutads.info</a>. Choosing non-personalised ads does not remove ads; it reduces personalisation.</p></section>

        <section id="sharing"><h2>8. Who we share data with</h2>
        <p>We do not sell your personal data. We share only the minimum necessary with processors working on our behalf:</p>
        <ul><li><strong>Hosting and runtime:</strong> Vercel (functions and site delivery) and Vercel Blob (image and file storage).</li>
        <li><strong>Database:</strong> Neon (managed PostgreSQL) for accounts, conversations and projects.</li>
        <li><strong>Sign-in:</strong> Google Firebase Authentication for email, Google or phone verification.</li>
        <li><strong>Email and messaging:</strong> Brevo for service email, and an SMS gateway (sms-gate.app or Textbee) to deliver a verification code to your number; both receive only the number and the message text.</li>
        <li><strong>AI:</strong> the providers listed in section 5, to answer your request.</li>
        <li><strong>Advertising:</strong> the networks listed in section 7.</li>
        <li><strong>Publishing you request:</strong> GitHub and Vercel when publishing a project, and Google Docs/Drive when you connect them for reference material.</li>
        <li><strong>Payments:</strong> PayPal or a postal/bank transfer for paid plans; payment details are handled by the provider and not stored by us.</li>
        <li><strong>Legal compliance:</strong> we may disclose data if compelled by a valid legal request or to protect our rights and user safety.</li></ul></section>

        <section id="retention"><h2>9. How long we keep data</h2>
        <ul><li><strong>Account and content:</strong> until you delete the content or the account.</li>
        <li><strong>After account deletion:</strong> removed from the database immediately; encrypted backups may persist up to 30 days and are then destroyed.</li>
        <li><strong>Error and security logs:</strong> up to 90 days.</li>
        <li><strong>Subscription and billing records:</strong> for the period required by tax or accounting law.</li>
        <li><strong>Verification codes:</strong> a few minutes, then they expire.</li></ul></section>

        <section id="security"><h2>10. Security</h2>
        <ul><li>Encrypted HTTPS for all requests; provider keys stay on the server and are never shipped to the browser.</li>
        <li>Hashed passwords, encrypted integration tokens, and production access limited to the operator.</li>
        <li>No system is 100% secure; if you discover a vulnerability or suspect an incident, email us immediately using the address below so we can act.</li></ul></section>

        <section id="rights"><h2>11. Your rights</h2>
        <p>Depending on your country, you have the right to <strong>access</strong> your data, <strong>correct</strong> it, <strong>delete</strong> it, <strong>restrict</strong> or <strong>object</strong> to processing, <strong>port</strong> it, and <strong>withdraw consent</strong> at any time with no retroactive effect.</p>
        <ul><li>Most actions are available in account settings (edit your details, delete conversations and projects, delete the account).</li>
        <li>For anything else, email us below. We answer within 30 days at most and may ask you to verify your identity to protect the account.</li>
        <li>You may complain to your local supervisory authority — in Algeria, the National Authority for the Protection of Personal Data (ANPDP) — or to the data protection authority in your EU member state.</li></ul></section>

        <section id="delete"><h2>12. Deleting your account and data</h2>
        <ol><li>Open <strong>Account &amp; Security</strong> → <strong>Danger zone</strong> → <strong>“Delete my account and all my data”</strong>.</li>
        <li>The account and its content (conversations, outputs, generated images, projects) are deleted permanently and cannot be restored.</li>
        <li>To remove only part of it, delete an individual conversation or project in the interface without deleting the whole account.</li>
        <li>We may retain limited records where the law requires it, or to prevent repeated abuse.</li></ol></section>

        <section id="children"><h2>13. Children</h2>
        <p>The service is not directed to children under 13, or under the minimum age in your country (up to 16 in some EU states). We do not knowingly collect children's data; if we learn a child under that age holds an account, we delete it. If your child created an account, contact us at the address below.</p></section>

        <section id="generated"><h2>14. Generated content and acceptable use</h2>
        <ul><li>Outputs may be inaccurate, biased or incomplete; review them before publishing or making an important decision.</li>
        <li>You are responsible for what you publish and for not infringing third-party rights.</li>
        <li>Do not use the service to harm others, break the law, generate illegal content, evade usage limits or attempt to compromise the service.</li></ul></section>

        <section id="transfers"><h2>15. International transfers</h2>
        <p>Our providers operate in several countries (EU and the United States), so your data may be processed outside your country of residence. We rely on providers offering recognised transfer safeguards — such as standard contractual clauses — where required, and we ask them to protect data to at least the standard described here.</p></section>

        <section id="changes"><h2>16. Changes to this policy</h2>
        <p>We may update this policy when features or providers change. The update date appears at the top of the page and in the page's structured data, and material changes are announced in the app or by email before they take effect. Continuing to use the service after an update means you accept the policy then in force.</p></section>

        <section id="contact"><h2>17. Contact us</h2>
        <p>Email: <a href="mailto:ahmedbecetti35@gmail.com">ahmedbecetti35@gmail.com</a> · Developer and data controller: Ahmed Becetti (AI BECETTI). We answer privacy requests within 30 days at most.</p>
        <p>Explore the rest of the platform: <a href="/en/about.html">About NEXORA AI</a> · <a href="/en/features.html">Features</a> · <a href="/en/faq.html">FAQ</a>.</p></section>`,
    },
  },
  ar: {
    about: {
      title: 'حول NEXORA AI | منصة ويب ذكية من أحمد بسيتي',
      description: 'تعرّف على NEXORA AI: منصة ويب متكاملة للمحادثة والبرمجة والكتابة والترجمة وتوليد الصور في المتصفح، مع NEXORA Studio لبناء التطبيقات ونشرها — من تطوير أحمد بسيتي.',
      eyebrow: 'عن المنصة', heading: 'منصة ويب متكاملة لأفكارك',
      lead: 'يطوّر أحمد بسيتي (AI BECETTI) منصة NEXORA AI كمنصة ويب متكاملة مثل Arena AI — كل الأدوات في المتصفح بدون تثبيت.',
      body: `<section><h2>لماذا منصة ويب؟</h2><p>مثل Arena AI، تعمل NEXORA كاملة على الويب — بدون APK. افتح المتصفح وابدأ: محادثة، كتابة، برمجة، ترجمة، تلخيص وصور في مساحة واحدة. تابع تحسين النتيجة بدون تبديل تطبيقات.</p><p>يتطلب إرسال الطلبات وحفظ السجل حساباً؛ قراءة هذه الصفحات لا تتطلب تسجيل. يتوفر APK اختياري لمن يفضّل التطبيق، لكن المنصة كاملة على الويب.</p></section>
        <section><h2>عن الاسم والنسخة الحالية</h2><p>يحمل اسم المستودع ورابط الموقع كلمة “social”، لكن النسخة المنشورة هي <strong>NEXORA AI — منصة ويب مثل Arena AI</strong>. لا توفر موجز منشورات أو ريلز أو رسائل بين المستخدمين. شاشات اجتماعية قديمة بقيت في الشيفرة للمرجع فقط وليست جزءاً من المنصة.</p></section>
        <section><h2>استخدام واعٍ</h2><p>النصوص والصور المولّدة نقاط بداية مفيدة، وليست ضماناً للدقة. راجع الإجابات وتحقق من المعلومات المهمة. يعتمد توفر البحث الحي والصوت وتوليد الصور على إمكانات الجهاز وحدود الاستخدام والمزوّدين المتاحين.</p><p>استكشف <a href="/features.html">الميزات</a> أو اقرأ <a href="/privacy.html">سياسة الخصوصية</a> أو <a href="/">افتح المنصة مباشرة</a>.</p></section>`,
    },
    features: {
      title: 'ميزات NEXORA AI | منصة ويب — محادثة وبرمجة وإبداع',
      description: 'ميزات NEXORA AI: محادثة ذكية، كتابة وترجمة وتلخيص، مساعد برمجة، توليد صور وتحليل ملفات، صوت وبحث بالمصادر، وNEXORA Studio لبناء التطبيقات ونشرها في المتصفح.',
      eyebrow: 'استكشف المنصة', heading: 'منصة كاملة للتفكير والبناء',
      lead: 'كل ما تحتاجه في مساحة ويب واحدة مثل Arena AI — اختر الأداة لمهمتك وتابع الحوار حتى تصل للنتيجة المطلوبة.',
      body: `<section><h2>اسأل واكتب وحسّن</h2><div class="seo-grid"><article><h3>المحادثة الذكية</h3><p>اطرح سؤالاً أو اطلب شرحاً خطوة بخطوة ثم تابع بأسئلة أخرى. محادثاتك محفوظة في حسابك على المنصة.</p></article><article><h3>مساعدة الكتابة</h3><p>حوّل نقاطاً سريعة إلى مسودة، اختصر فقرة أو غيّر أسلوب النص. أنت تختار ما تحتفظ به وتنشره.</p></article><article><h3>التلخيص والترجمة</h3><p>استخرج الأفكار من نص أو اطلب ترجمة. تكتب طلباتك بالعربية أو الإنجليزية؛ تختلف الجودة بحسب المزوّد.</p></article></div></section>
        <section><h2>ابنِ واستكشف</h2><div class="seo-grid"><article><h3>مساعد البرمجة</h3><p>اطلب مثال كود أو تفسير خطأ أو مقارنة حلول. افحص الكود وشغّله قبل الاستخدام.</p></article><article><h3>الصور وتحليلها</h3><p>صف صورة لإنشائها أو أرفق صورة لتحليلها. تعتمد الخدمة على مزوّدين خارجيين وقد تخضع لحدود.</p></article><article><h3>الملفات والصوت والمصادر</h3><p>أرفق PDF أو DOCX أو نص، أملِ طلبك صوتياً، استمع للرد، أو فعّل بحث الويب بالمصادر — كل ذلك في المتصفح. يُطلب الميكروفون عند الاستخدام فقط.</p></article></div></section>
        <section><h2>NEXORA Studio — ابنِ التطبيق لا الكود فقط</h2><p>صف التطبيق بلغتك، فيخططه Studio ويكتب ملفات المشروع الحقيقية، ثم تعدّلها في محرر أكواد، وتشغّل الأوامر في طرفية حقيقية، وتشاهد معاينة حيّة. تحفظ المشروع وتفتحه لاحقاً دون فقدان عملك، ثم تنشره على GitHub أو Vercel — كل ذلك داخل NEXORA وبنفس الحساب.</p><div class="seo-grid"><article><h3>خطة ثم تنفيذ</h3><p>يعيد المساعد خطة بالملفات التي سيكتبها ثم ينشئها فعلياً، ويُعلن أي ملف ناقص بدل الادّعاء بأن البناء انتهى.</p></article><article><h3>محرر وطرفية حقيقيان</h3><p>عدّل الملفات في المتصفح، شغّل أوامر البناء والاختبار، واقرأ الخرج الفعلي. لا شيء في مساحة العمل محاكى.</p></article><article><h3>معاينة حيّة ونشر</h3><p>شاهد التطبيق فور كل تعديل، احفظ نقاط استعادة، ثم انشر على GitHub أو Vercel من الشاشة نفسها.</p></article></div></section>
        <section class="seo-callout"><h2>المنصة كاملة على الويب</h2><p>مثل Arena AI — بدون تثبيت. سجّل الدخول وابدأ العمل فوراً.</p><a class="seo-button" href="/">افتح NEXORA AI</a><a class="seo-button secondary" href="/faq.html">الأسئلة الشائعة</a></section>`,
    },
    download: {
      title: 'NEXORA AI — منصة ويب | تحميل APK اختياري',
      description: 'NEXORA AI منصة ويب أولاً — كل الميزات في المتصفح بلا تثبيت. نزّل APK اختياري لأندرويد 6.0+ إن أردت التطبيق، مع الإصدار والحجم وخطوات التثبيت والتحقق من المصدر.',
      eyebrow: 'المنصة على الويب أولاً', heading: 'NEXORA AI تعمل على الويب',
      lead: 'المنصة كاملة في المتصفح — بدون تحميل. يتوفر APK اختياري لمن يفضّل التطبيق على أندرويد.',
      body: `<section class="seo-callout"><h2>استخدم المنصة على الويب — بدون تثبيت</h2><p><strong>منصة ويب</strong> · تعمل في أي متصفح حديث · <strong>APK اختياري</strong> · الإصدار ${esc(version)} · حوالي ${apkSize} ميغابايت · أندرويد 6.0+ إن أردت التطبيق.</p><a class="seo-button" href="/">افتح NEXORA AI على الويب</a><a class="seo-button secondary" href="/download/Nexora.apk" download>تحميل APK الاختياري</a></section>
        <section><h2>لماذا الويب أولاً؟</h2><p>مثل Arena AI، NEXORA منصة ويب كاملة: كل الميزات — محادثة، برمجة، صور، ملفات، صوت وبحث — في المتصفح مباشرة مع حسابك. لا APK ولا متجر ولا خطوات إضافية.</p></section>
        <section><h2>APK اختياري — إن رغبت</h2><ol><li>نزّل ملف APK الاختياري من الرابط أعلاه على أندرويد.</li><li>افتح الملف؛ قد يطلب أندرويد السماح بالتثبيت من هذا المصدر.</li><li>سجّل الدخول — نفس الحساب ونفس الخادم كالويب.</li></ol><p>الـ APK اختياري — <a href="/">المنصة كاملة على الويب</a> بدونه.</p></section>
        <section><h2>قبل التحميل</h2><p>حمّل من الرابط الرسمي فقط إن أردت الـ APK. على الويب لا تحتاج تحميلاً. راجع <a href="/features.html">الميزات</a> و<a href="/faq.html">الأسئلة الشائعة</a> و<a href="/privacy.html">الخصوصية</a> أولاً.</p></section>`,
    },
    faq: {
      title: 'الأسئلة الشائعة عن NEXORA AI | منصة الويب',
      description: 'إجابات واضحة عن NEXORA AI: هل هي شبكة اجتماعية؟ هل أحتاج حسابًا أو تحميل تطبيق؟ حدود الاستخدام، خصوصية المحادثات، حذف الحساب، ولغات الواجهة والردود.',
      eyebrow: 'الأسئلة الشائعة', heading: 'إجابات قبل أن تبدأ',
      lead: 'تعرّف على الخدمات المتاحة في النسخة الحالية وكيف تستخدم المساعد الذكي بوعي. ستجد معلومات التواصل المتعلقة بحسابك في صفحة الخصوصية.',
      body: `<section><h2>استخدام NEXORA AI</h2><p>NEXORA منصة ويب متكاملة مثل Arena AI — تعمل بدون تحميل. راجع <a href="/features.html">دليل الميزات</a> أو <a href="/download.html">صفحة APK الاختياري</a> إن رغبت بالتطبيق.</p></section>`,
    },
    privacy: {
      title: 'سياسة الخصوصية وملفات تعريف الارتباط | NEXORA AI',
      description: 'ما تجمعه NEXORA AI ولماذا، الأساس القانوني، مزوّدو الخدمة، ملفات تعريف الارتباط والإعلانات، مدة الاحتفاظ، حقوقك، وحذف الحساب والبيانات بالتفصيل.',
      eyebrow: 'NEXORA AI · الويب والتطبيق',
      heading: 'سياسة الخصوصية وملفات تعريف الارتباط',
      lead: 'نجيب هنا بالتفصيل عن أربعة أسئلة: ما البيانات التي نجمعها، ولماذا، ومن يعالجها، وكيف تتحكّم بها — بلغة واضحة وبلا حشو.',
      toc: [
        ['who', 'من نحن ونطاق السياسة'],
        ['data', 'البيانات التي نجمعها'],
        ['use', 'لماذا نستخدم بياناتك'],
        ['legal', 'الأساس القانوني'],
        ['ai', 'طلبات الذكاء الاصطناعي'],
        ['cookies', 'ملفات تعريف الارتباط'],
        ['ads', 'الإعلانات'],
        ['sharing', 'مع من نشارك البيانات'],
        ['retention', 'مدة الاحتفاظ'],
        ['security', 'الأمان'],
        ['rights', 'حقوقك'],
        ['delete', 'حذف الحساب والبيانات'],
        ['children', 'الأطفال'],
        ['generated', 'المحتوى المولّد والاستخدام المقبول'],
        ['transfers', 'النقل الدولي'],
        ['changes', 'تغييرات هذه السياسة'],
        ['contact', 'التواصل معنا'],
      ],
      body: `<section id="who"><h2>١. من نحن ونطاق هذه السياسة</h2>
        <p><strong>NEXORA AI</strong> منصة ويب للذكاء الاصطناعي وبناء التطبيقات (مع تطبيق أندرويد اختياري)، يطوّرها ويشغّلها <strong>أحمد بسيتي (AI BECETTI)</strong>، وهو المتحكّم في البيانات الشخصية المعالجة عبر الخدمة.</p>
        <p>تنطبق هذه السياسة على موقع <a href="/">nexora-social-2026.vercel.app</a>، وتطبيق أندرويد، والصفحات العامة (حول · الميزات · التحميل · الأسئلة الشائعة)، وNEXORA Studio، وأي طلب يمرّ عبر واجهة الخدمة.</p>
        <p>لا تنطبق على خدمات خارجية تفتحها من روابط داخل المنصة — مثل GitHub أو Vercel أو Google أو شبكات الإعلان — فلكل منها سياسة خصوصية مستقلة.</p></section>

        <section id="data"><h2>٢. البيانات التي نجمعها</h2>
        <h3>بيانات الحساب والهوية</h3>
        <ul><li>الاسم واسم المستخدم، والبريد الإلكتروني أو رقم الهاتف، وصورة الملف الشخصي إن أضفتها، ولغة الواجهة.</li>
        <li>معرّف الحساب الداخلي وطريقة تسجيل الدخول (بريد · Google · هاتف)، وتاريخ إنشاء الحساب وتاريخ آخر دخول.</li>
        <li>كلمة المرور تُحفظ كبصمة مشفّرة (hash) لا كنص مقروء، ولا نستطيع استخراجها.</li></ul>
        <h3>المحتوى الذي ترسله</h3>
        <ul><li>الرسائل والطلبات والردود المولّدة، والمحادثات المحفوظة في حسابك، والصور المطلوب توليدها.</li>
        <li>الملفات التي ترفعها طوعًا (PDF · DOCX · نص · صور) والمعالجة اللازمة لقراءتها.</li>
        <li>ملفات مشاريع NEXORA Studio، وأوامر الطرفية، ومراجعات المشروع ونقاط الاستعادة، ورابط النشر إن نشرت.</li>
        <li>تفضيلات الاستخدام المحفوظة في حسابك (النموذج المفضّل، لغة الرد، إعدادات العرض).</li></ul>
        <h3>التكاملات الاختيارية</h3>
        <ul><li>عند ربط Google Docs/Drive أو GitHub أو Vercel نطلب فقط النطاقات اللازمة للوظيفة المطلوبة، ونخزّن رموز الوصول مشفّرة على الخادم.</li>
        <li>لا يُقرأ أو يُرسل أي ملف من هذه الخدمات إلا بإجراء صريح منك، ويمكنك فصل التكامل في أي وقت.</li></ul>
        <h3>الاشتراكات والمدفوعات</h3>
        <ul><li>حالة الاشتراك والخطة، ومرجع العملية، ومعرّف الدفع لدى المزوّد (PayPal أو تحويل بريدي/بريدي موب عند الاشتراك المدفوع).</li>
        <li>لا نحفظ أرقام البطاقات البنكية ولا رموز التحقق البنكية؛ تُدخل لدى المزوّد مباشرة.</li></ul>
        <h3>بيانات تقنية</h3>
        <ul><li>عنوان IP، نوع المتصفح والنظام والجهاز، الصفحة والوقت، ورسائل الأخطاء — لأمن الخدمة وتشخيص الأعطال.</li>
        <li>معرّف الإعلان في تطبيق أندرويد (Google AdMob) وفق إعدادات جهازك.</li></ul>
        <h3>ما لا نطلبه ولا نجمعه</h3>
        <ul><li>لا نطلب الموقع الجغرافي، ولا جهات الاتصال، ولا الرسائل النصية، ولا سجل المكالمات، ولا الصور من المعرض دون اختيارك.</li>
        <li>أذونات تطبيق أندرويد محدودة: الإنترنت، وشبكة الاتصال، والميكروفون — والأخير يُستخدم فقط عند تشغيل الإدخال الصوتي.</li></ul></section>

        <section id="use"><h2>٣. لماذا نستخدم بياناتك</h2>
        <ul><li><strong>تشغيل الخدمة:</strong> إنشاء الحساب، تسجيل الدخول، التحقق بالبريد أو الهاتف، واستعادة الوصول.</li>
        <li><strong>تنفيذ طلباتك:</strong> إرسال الطلب إلى مزوّد الذكاء الاصطناعي، وإرجاع الإجابة، وحفظ المحادثة في حسابك.</li>
        <li><strong>البناء والنشر:</strong> إنشاء ملفات المشروع وتشغيل الأوامر ونشر التطبيق عندما تطلب ذلك صراحة.</li>
        <li><strong>الأمان:</strong> منع إساءة الاستخدام والتزوير وتجاوز حدود الاستخدام، وكشف الهجمات والأعطال.</li>
        <li><strong>الاشتراكات:</strong> إدارة الخطة والحدود وإصدار الإيصالات إن وُجدت.</li>
        <li><strong>رسائل خدمية:</strong> رموز التحقق وتنبيهات أمنية وتغييرات جوهرية في السياسة. لا نرسل رسائل تسويقية دون موافقة قابلة للسحب.</li>
        <li><strong>تحسين الأداء:</strong> قياسات عامة ومجمّعة للسرعة والاستقرار دون بناء ملف تعريف إعلاني عنك.</li></ul></section>

        <section id="legal"><h2>٤. الأساس القانوني للمعالجة</h2>
        <p>حيث ينطبق نظام حماية البيانات الأوروبي (GDPR) أو أنظمة مشابهة، نعتمد أساسًا قانونيًا واضحًا لكل غرض:</p>
        <ul><li><strong>تنفيذ العقد:</strong> تقديم الخدمة التي طلبتها (الحساب، المحادثات، Studio، النشر).</li>
        <li><strong>المصلحة المشروعة:</strong> أمن الخدمة ومنع الإساءة وتحسين الاستقرار — مع موازنة لا تمسّ حقوقك الأساسية.</li>
        <li><strong>الموافقة:</strong> الإعلانات المخصّصة، والإشعارات الاختيارية، والتكاملات الخارجية. يمكنك سحب الموافقة في أي وقت من الإعدادات.</li>
        <li><strong>الالتزام القانوني:</strong> حفظ السجلات المطلوبة نظامًا، أو الاستجابة لطلب قضائي صحيح.</li></ul></section>

        <section id="ai"><h2>٥. كيف تُعالَج طلبات الذكاء الاصطناعي</h2>
        <p>عند إرسال طلب، يُحوَّل نصّه — مع السياق الضروري فقط (مثل مقتطف الملفات أو المرفق الذي اخترته) — إلى مزوّد واحد أو أكثر لتوليد الرد: OpenAI · Google Gemini · OpenRouter · Groq · Mistral · DeepSeek · xAI · Cerebras · GitHub Models · Pollinations · llm7.io، بحسب المتاح والمفعّل في التوزيع الحالي.</p>
        <ul><li>لا نستخدم محتواك لتدريب النماذج، ولا نبيعه، ولا نستخدمه لاستهداف إعلاني من جانب خوادمنا.</li>
        <li>قد يحتفظ المزوّد بالطلب مدة محدودة وفق سياسته الخاصة؛ نختار مزوّدين يوفّرون خيار عدم الاحتفاظ حيث يتوفر.</li>
        <li>لا ترسل بيانات حساسة (طبية، مالية، وثائق هوية، كلمات مرور) في الطلبات. الإجابات قد تكون غير دقيقة، والتحقق مسؤوليتك.</li>
        <li>يمكنك حذف محادثة أو مشروع من الواجهة، فيُحذف محتواه من حسابك.</li></ul></section>

        <section id="cookies"><h2>٦. ملفات تعريف الارتباط والتخزين المحلي</h2>
        <p>نستخدم تخزينًا محليًا محدودًا في متصفحك لتشغيل الواجهة، ولا نستخدمه لتتبعك عبر مواقع أخرى:</p>
        <ul><li><strong>ضروري:</strong> <code>nx_theme</code> (المظهر)، <code>nx_view</code> (العرض المختار)، وبيانات الجلسة أو رمز الدخول — بدونهما لا تعمل المنصة.</li>
        <li><strong>طرف ثالث:</strong> قد تضع شبكات الإعلان (Google AdSense · AdMob · Monetag · Adsterra) ملفات تعريف ارتباط أو معرّفات لأجل العرض والقياس ومكافحة الاحتيال، ويختلف ذلك بحسب بلدك وموافقتك.</li>
        <li><strong>Global Privacy Control:</strong> نحترم إشارة GPC المرسلة من المتصفح؛ عند تفعيلها لا تُحمَّل وحدتا Adsterra وMonetag في صفحات الويب.</li>
        <li>يمكنك حذف التخزين المحلي أو حظر ملفات طرف ثالث من إعدادات المتصفح؛ قد تتأثر بعض الوظائف مثل البقاء مسجّل الدخول.</li></ul></section>

        <section id="ads"><h2>٧. الإعلانات وكيف تُموّل الخدمة</h2>
        <p><strong>على الموقع</strong> قد نعرض إعلانات Google AdSense وMonetag وAdsterra. تُحمَّل Adsterra بنمط Native Banner وMonetag بنمط OnClick/Popunder في الصفحات العامة وصفحات الدخول والمحادثات، وقد تفتح Monetag نافذة أو تبويبًا جديدًا عند النقر.</p>
        <p>قد تعالج الشبكات الإعلانية بيانات تقنية مثل عنوان IP ومعرّفات المتصفح وملفات تعريف الارتباط والتفاعل مع الصفحة لعرض الإعلان وقياسه. تعمل شيفرات الإعلانات الخارجية داخل صفحة الويب وقد تتمكن تقنيًا من قراءة محتواها ومدخلات المستخدم؛ لا نرسل سجل المحادثات من خوادمنا إلى شبكات الإعلان للاستهداف، لكننا لا نستطيع ضمان ما تقرؤه شيفرة طرف ثالث داخل المتصفح.</p>
        <p><strong>في تطبيق أندرويد</strong> نعرض إعلانات Google AdMob فقط: بانر أسفل شاشة الترحيب، وإعلان بيني نادر (بحد أقصى مرة كل 10 دقائق و3 مرات يوميًا) عند انتقال طبيعي، وإعلان بمكافأة اختياري يطلبه المستخدم بنفسه. لا تظهر إعلانات AdMob أثناء المحادثة النصية أو الصوتية أو فوق النوافذ. تُدار الموافقة عبر إطار Google UMP حيث ينطبق، ويمكنك قبولها أو رفضها من نافذة الموافقة داخل التطبيق.</p>
        <p>لإدارة الإعلانات المخصّصة: <a href="https://adssettings.google.com" rel="nofollow noopener" target="_blank">إعدادات إعلانات Google</a> · <a href="https://www.aboutads.info/choices/" rel="nofollow noopener" target="_blank">aboutads.info</a>. اختيارك غير المخصّص لا يوقف الإعلانات، لكنه يقلّل تخصيصها.</p></section>

        <section id="sharing"><h2>٨. مع من نشارك البيانات</h2>
        <p>لا نبيع بياناتك الشخصية. نشارك الحد الأدنى الضروري فقط مع مزوّدين يعملون لحسابنا لتقديم الوظيفة:</p>
        <ul><li><strong>الاستضافة والتشغيل:</strong> Vercel (تنفيذ الدوال وتوزيع الموقع) وVercel Blob (تخزين الصور والملفات).</li>
        <li><strong>قاعدة البيانات:</strong> Neon (PostgreSQL مُدار) لحفظ الحسابات والمحادثات والمشاريع.</li>
        <li><strong>تسجيل الدخول:</strong> Google Firebase Authentication للتحقق بالبريد أو Google أو الهاتف.</li>
        <li><strong>البريد والرسائل:</strong> Brevo للبريد الخدمي، وبوابة SMS (sms-gate.app أو Textbee) لإرسال رمز التحقق إلى رقمك؛ يستلمان الرقم ونص الرسالة فقط.</li>
        <li><strong>الذكاء الاصطناعي:</strong> المزوّدون المذكورون في القسم ٥، لتوليد الرد على طلبك.</li>
        <li><strong>الإعلانات:</strong> الشبكات المذكورة في القسم ٧.</li>
        <li><strong>النشر بطلبك:</strong> GitHub وVercel عند نشر مشروع، وGoogle Docs/Drive عند ربطها لجلب مرجع.</li>
        <li><strong>المدفوعات:</strong> PayPal أو تحويل بريدي/بنكي عند الاشتراك المدفوع؛ تُعالَج بيانات الدفع لدى المزوّد ولا تُخزَّن عندنا.</li>
        <li><strong>الالتزام القانوني:</strong> قد نفصح عن بيانات إذا أُلزمنا بذلك بطلب قضائي صحيح أو لحماية حقوقنا وأمن المستخدمين.</li></ul></section>

        <section id="retention"><h2>٩. مدة الاحتفاظ</h2>
        <ul><li><strong>الحساب والمحتوى:</strong> يبقى حتى تحذفه أنت أو تحذف الحساب.</li>
        <li><strong>بعد حذف الحساب:</strong> يُحذف من قاعدة البيانات فورًا، وقد تبقى نسخ احتياطية مشفّرة مدة أقصاها 30 يومًا ثم تُتلف.</li>
        <li><strong>سجلات الأخطاء والأمان:</strong> حتى 90 يومًا.</li>
        <li><strong>سجلات الاشتراك والفوترة:</strong> للمدة التي يفرضها القانون الضريبي أو المحاسبي.</li>
        <li><strong>رموز التحقق:</strong> دقائق معدودة ثم تنتهي صلاحيتها.</li></ul></section>

        <section id="security"><h2>١٠. الأمان</h2>
        <ul><li>اتصال HTTPS مشفّر لكل الطلبات، ومفاتيح المزوّدين على الخادم فقط ولا تُرسل إلى المتصفح.</li>
        <li>كلمات المرور كبصمة مشفّرة، ورموز التكاملات مشفّرة، والوصول إلى الإنتاج محدود بالمشغّل.</li>
        <li>لا يوجد نظام آمن بنسبة 100%؛ إذا اكتشفت ثغرة أو اشتباهًا أمنيًا فأبلغنا فورًا عبر البريد أدناه لنعالجه.</li></ul></section>

        <section id="rights"><h2>١١. حقوقك</h2>
        <p>لك — بحسب بلدك — الحق في: <strong>الوصول</strong> إلى بياناتك، و<strong>تصحيحها</strong>، و<strong>حذفها</strong>، و<strong>تقييد المعالجة</strong> أو <strong>الاعتراض</strong> عليها، و<strong>قابلية النقل</strong>، و<strong>سحب الموافقة</strong> في أي وقت دون أثر رجعي.</p>
        <ul><li>يمكنك تنفيذ أغلبها مباشرة من إعدادات الحساب (تعديل البيانات، حذف المحادثات والمشاريع، حذف الحساب).</li>
        <li>لأي طلب آخر راسلنا على البريد أدناه؛ نرد خلال 30 يومًا كحد أقصى وقد نطلب تحقّقًا من الهوية لحماية حسابك.</li>
        <li>لك الحق في تقديم شكوى إلى السلطة المختصة في بلدك — في الجزائر: السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي (ANPDP) — أو إلى هيئة حماية البيانات في دولتك داخل الاتحاد الأوروبي.</li></ul></section>

        <section id="delete"><h2>١٢. حذف الحساب والبيانات</h2>
        <ol><li>افتح <strong>الحساب والأمان</strong> ← <strong>منطقة الخطر</strong> ← <strong>«حذف حسابي وكل بياناتي نهائيًا»</strong>.</li>
        <li>يُحذف الحساب ومحتواه (المحادثات، المخرجات، الصور المولّدة، المشاريع) نهائيًا ولا يمكن التراجع.</li>
        <li>لحذف جزء فقط: احذف المحادثة أو المشروع من الواجهة، أو أزل الملف من حسابك، دون حذف الحساب كله.</li>
        <li>قد نُبقي على سجلات محدودة إذا ألزمنا القانون بالاحتفاظ بها، أو لمنع إساءة استخدام متكررة.</li></ol></section>

        <section id="children"><h2>١٣. الأطفال</h2>
        <p>الخدمة غير موجّهة لمن دون 13 عامًا، أو دون السن الأدنى المعتمد في بلدك (قد يصل إلى 16 عامًا في بعض دول الاتحاد الأوروبي). لا نجمع بيانات الأطفال عن قصد؛ وإذا تبيّن لنا وجود حساب لطفل دون السن نحذفه. إن كان طفلك أنشأ حسابًا، راسلنا على البريد أدناه.</p></section>

        <section id="generated"><h2>١٤. المحتوى المولّد والاستخدام المقبول</h2>
        <ul><li>المخرجات قد تكون غير دقيقة أو متحيّزة أو غير مكتملة؛ راجعها قبل النشر أو اتخاذ قرار مهم.</li>
        <li>أنت مسؤول عن المحتوى الذي تنشره وعن عدم انتهاكه حقوق طرف ثالث.</li>
        <li>يُمنع استخدام الخدمة لإيذاء الآخرين، أو انتهاك القانون، أو توليد محتوى غير قانوني، أو محاولة تجاوز حدود الاستخدام أو اختراق الخدمة.</li></ul></section>

        <section id="transfers"><h2>١٥. النقل الدولي للبيانات</h2>
        <p>يعمل مزوّدونا في دول مختلفة (الاتحاد الأوروبي والولايات المتحدة)، لذلك قد تُعالَج بياناتك خارج بلد إقامتك. نعتمد مزوّدين يوفّرون ضمانات نقل معتمدة — مثل البنود التعاقدية القياسية — حيث تنطبق، ونطلب منهم حماية البيانات بدرجة لا تقلّ عن الموصوفة هنا.</p></section>

        <section id="changes"><h2>١٦. تغييرات هذه السياسة</h2>
        <p>قد نحدّث السياسة عند إضافة ميزات أو تغيير مزوّد. يظهر تاريخ التحديث أعلى الصفحة وفي بيانات الصفحة المنظمة، ونُعلن التغييرات الجوهرية داخل التطبيق أو بالبريد قبل سريانها. استمرارك في استخدام الخدمة بعد التحديث يعني قبولك النسخة السارية.</p></section>

        <section id="contact"><h2>١٧. التواصل معنا</h2>
        <p>البريد: <a href="mailto:ahmedbecetti35@gmail.com">ahmedbecetti35@gmail.com</a> · المطوّر والمتحكّم بالبيانات: أحمد بسيتي (AI BECETTI). نرد على طلبات الخصوصية خلال 30 يومًا كحد أقصى.</p>
        <p>للاطلاع على بقية المنصة: <a href="/about.html">حول NEXORA AI</a> · <a href="/features.html">الميزات</a> · <a href="/faq.html">الأسئلة الشائعة</a>.</p></section>`,
    },
  },
};

const labels = {
  ar: { lang: 'العربية', other: 'English', brand: 'NEXORA AI', home: 'الرئيسية', about: 'حول', features: 'الميزات', download: 'التحميل', faq: 'الأسئلة الشائعة', privacy: 'الخصوصية', app: 'افتح المنصة', footer: 'NEXORA AI منصة ويب متكاملة للذكاء الاصطناعي — مثل Arena AI — مع NEXORA Studio لبناء التطبيقات. طوّرها أحمد بسيتي.', related: 'المزيد عن NEXORA AI', relatedText: 'منصة ويب متكاملة — استكشف الميزات وابدأ مباشرة في المتصفح.', toc: 'في هذه الصفحة', updated: 'آخر تحديث' },
  en: { lang: 'English', other: 'العربية', brand: 'NEXORA AI', home: 'Home', about: 'About', features: 'Features', download: 'Download', faq: 'FAQ', privacy: 'Privacy', app: 'Open platform', footer: 'NEXORA AI — a complete web AI platform like Arena AI, with NEXORA Studio for building apps, by Ahmed Becetti.', related: 'Explore NEXORA AI', relatedText: 'A complete web platform — explore features and open it in your browser.', toc: 'On this page', updated: 'Last updated' },
};

const ORG_ID = `${base}/#organization`;
const APP_ID = `${base}/#app`;

function alternateLinks(pair) {
  return `<link rel="alternate" hreflang="ar" href="${url(pair.ar)}" />
<link rel="alternate" hreflang="en" href="${url(pair.en)}" />
<link rel="alternate" hreflang="x-default" href="${url(pair.en)}" />`;
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
/* كيانات مشتركة: المنظمة والموقع والتطبيق — تُشار إليها كل الصفحات بمعرّف ثابت */
function organization() {
  return {
    '@type': 'Organization', '@id': ORG_ID, name: 'NEXORA AI', alternateName: 'NEXORA', url: `${base}/`,
    logo: { '@type': 'ImageObject', url: `${base}/icon-512.png`, width: 512, height: 512 },
    founder: { '@type': 'Person', name: 'Ahmed Becetti' },
    email: 'ahmedbecetti35@gmail.com',
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'ahmedbecetti35@gmail.com', availableLanguage: ['ar', 'en'] }],
  };
}
function website() {
  return {
    '@type': 'WebSite', '@id': `${base}/#website`, name: 'NEXORA AI', url: `${base}/`,
    inLanguage: ['ar', 'en'], publisher: { '@id': ORG_ID },
  };
}
function application() {
  return {
    '@type': 'SoftwareApplication', '@id': APP_ID, name: 'NEXORA AI',
    applicationCategory: 'ProductivityApplication', operatingSystem: 'Web, Android',
    url: `${base}/`, softwareVersion: version, image: `${base}/og-image.jpg`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'Ahmed Becetti' }, publisher: { '@id': ORG_ID },
  };
}
function render(lang, key, data) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const names = labels[lang];
  const path = pairs[key][lang];
  const id = url(path);
  const langOther = lang === 'ar' ? 'en' : 'ar';
  const isHome = key === 'home';
  const pageType = key === 'faq' ? 'FAQPage' : key === 'about' ? 'AboutPage' : 'WebPage';
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      organization(),
      website(),
      {
        '@type': pageType,
        '@id': `${id}#webpage`, url: id, name: data.title, description: data.description, inLanguage: lang,
        dateModified: LAST_UPDATED.iso,
        isPartOf: { '@id': `${base}/#website` },
        publisher: { '@id': ORG_ID },
        author: { '@type': 'Person', name: 'Ahmed Becetti' },
        primaryImageOfPage: { '@type': 'ImageObject', url: `${base}/og-image.jpg`, width: 1200, height: 630 },
        ...(key === 'faq' ? { mainEntity: faq[lang].map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) } : {}),
        ...(isHome ? { about: { '@id': APP_ID } } : { breadcrumb: { '@id': `${id}#breadcrumb` } }),
      },
      ...(isHome ? [] : [{ ...breadCrumbs(lang, key, data), '@id': `${id}#breadcrumb` }]),
      ...(isHome || key === 'download' ? [application()] : []),
    ],
  };
  const faqBody = key === 'faq' ? `<section class="seo-faq" aria-label="${esc(data.heading)}">${faq[lang].map(([question, answer]) => `<article><h3>${esc(question)}</h3><p>${esc(answer)}</p></article>`).join('\n')}</section>` : '';
  const toc = data.toc ? `<nav class="seo-toc" aria-label="${names.toc}"><p class="seo-toc-title">${names.toc}</p><ol>${data.toc.map(([anchor, label]) => `<li><a href="#${anchor}">${esc(label)}</a></li>`).join('')}</ol></nav>` : '';
  const nav = Object.keys(pairs).map((item) => `<a href="${pairs[item][lang]}"${item === key ? ' aria-current="page"' : ''}>${esc(names[item])}</a>`).join('');
  const related = `<a href="${pairs.about[lang]}">${names.about}</a><a href="${pairs.features[lang]}">${names.features}</a><a href="${pairs.download[lang]}">${names.download}</a><a href="${pairs.faq[lang]}">${names.faq}</a><a href="${pairs.privacy[lang]}">${names.privacy}</a>`;
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#15102c" />
<title>${esc(data.title)}</title>
<meta name="description" content="${esc(data.description)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1" />
<meta name="author" content="Ahmed Becetti" />
<meta name="application-name" content="NEXORA AI" />
<meta name="apple-mobile-web-app-title" content="NEXORA AI" />
<meta name="format-detection" content="telephone=no" />
<link rel="canonical" href="${id}" />
${alternateLinks(pairs[key])}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="NEXORA AI" />
<meta property="og:locale" content="${lang === 'ar' ? 'ar_DZ' : 'en_US'}" />
<meta property="og:locale:alternate" content="${lang === 'ar' ? 'en_US' : 'ar_DZ'}" />
<meta property="og:title" content="${esc(data.title)}" />
<meta property="og:description" content="${esc(data.description)}" />
<meta property="og:url" content="${id}" />
<meta property="og:image" content="${base}/og-image.jpg" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(data.heading)} — NEXORA AI" />
<meta property="og:updated_time" content="${LAST_UPDATED.iso}T00:00:00+00:00" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(data.title)}" />
<meta name="twitter:description" content="${esc(data.description)}" />
<meta name="twitter:image" content="${base}/og-image.jpg" />
<meta name="twitter:image:alt" content="${esc(data.heading)} — NEXORA AI" />
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="stylesheet" href="/seo.css" />
${isHome ? '<link rel="preload" as="image" href="/mascot-ui.webp" fetchpriority="high" />' : ''}
<script type="application/ld+json">${json(schema)}</script>
<script src="/monetag-web.js" defer></script>
<script src="/adsterra-web.js" defer></script>
</head>
<body class="seo-page">
<a class="seo-skip" href="#content">${lang === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
<header class="seo-header"><div class="seo-container seo-header-inner"><a class="seo-brand" href="${pairs.home[lang]}"><img src="/mascot-ui.webp" width="42" height="42" alt="" /><span>NEXORA <b>AI</b></span></a><nav aria-label="${lang === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}">${nav}</nav><a class="seo-language" href="${pairs[key][langOther]}" lang="${langOther}" hreflang="${langOther}">${names.other}</a></div></header>
<main id="content" class="seo-container">
${isHome ? '' : `<nav class="seo-breadcrumb" aria-label="${lang === 'ar' ? 'مسار التصفح' : 'Breadcrumb'}"><a href="${pairs.home[lang]}">${names.home}</a><span aria-hidden="true"> / </span><span>${esc(data.heading)}</span></nav>`}
<div class="seo-hero${isHome ? ' seo-home' : ''}"><div><p class="seo-eyebrow">${esc(data.eyebrow)}</p><h1>${esc(data.heading)}</h1><p class="seo-lead">${esc(data.lead)}</p><p class="seo-updated">${names.updated}: <time datetime="${LAST_UPDATED.iso}">${LAST_UPDATED[lang]}</time></p>${isHome ? `<div class="seo-actions"><a class="seo-button" href="/">${names.app}</a><a class="seo-button secondary" href="${pairs.features[lang]}">${names.features}</a></div>` : ''}</div>${isHome ? '<img class="seo-hero-image" src="/mascot-ui.webp" alt="NEXORA AI mascot" width="256" height="256" fetchpriority="high" />' : ''}</div>
${toc}
<div class="seo-adsterra" role="complementary" aria-label="${lang === 'ar' ? 'مساحة إعلانية' : 'Advertisement'}"><div id="container-5641403c5558334d50a26de1c90fe61d"></div></div>
${data.body}
${faqBody}
<section class="seo-more"><h2>${names.related}</h2><p>${names.relatedText}</p><div class="seo-links">${related}</div></section>
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
