# NEXORA Studio — منصة بناء التطبيقات بالذكاء الاصطناعي

> **ما هذا؟** مساحة عمل كاملة داخل NEXORA: تكتب وصف التطبيق بالعربية أو الإنجليزية،
> فيخطّط الوكيل، ثم يكتب ملفات المشروع الحقيقية على الخادم، وتعدّلها في محرر أكواد،
> وتشغّل الأوامر في طرفية حقيقية، وتشاهد المعاينة الحيّة، ثم تنشر على GitHub أو Vercel.
>
> هذا الدليل يشرح المعمارية، ومتغيّرات البيئة، والاختبارات، وحدود ما هو مُتحقَّق منه فعلًا.

---

## 1) ما الذي حُذف وما الذي بُني

حُذفت واجهة NEXORA Studio القديمة بالكامل (`src/ai/ArenaStudio.jsx`, `ArenaStudio.css`, ومتجر
العرض التجريبي وبياناته وصوره وأزراره الوهمية) ولم يُرقَّع أي جزء منها. المسار الجديد هو
`src/studio/` + `api/_lib/studio/`، وهو المسار الافتراضي عند فتح الموقع:

| الطبقة | الملفات | الوظيفة |
| --- | --- | --- |
| الواجهة | `src/studio/StudioApp.jsx`, `Workspace.jsx`, `ProjectsPanel.jsx`, `ChatPanel.jsx`, `FileTree.jsx`, `CodeEditor.jsx`, `PreviewPane.jsx`, `TerminalPane.jsx`, `DeployPanel.jsx`, `SettingsPanel.jsx` | الشاشة الكاملة: مشاريع، محادثة، ملفات، محرر، معاينة، طرفية، نشر، إعدادات |
| الحالة | `src/studio/state.jsx` | مصدر الحقيقة الوحيد: المشروع، الملفات، رسائل الوكيل، البثّ، الحفظ، النشر |
| المعاينة | `src/studio/preview/bundler.js` | يبني مشروع المستخدم داخل المتصفح (esbuild-wasm) أو يشغّل خادم تطوير |
| الخادم | `api/_lib/studio/*.js` | التخزين، الملفات، المشاريع، النماذج، الوكيل، التنفيذ، النشر، البثّ، المسارات |
| الدخول | `api/index.js`, `api/_lib/handlers.js` | تمرير SSE و`registerStudioRoutes` |

---

## 2) كيف يعمل: خطة ← إنشاء/تعديل ← تنفيذ

الحلقة ليست شكلًا: كل خطوة تنداء النموذج فعليًا وتكتب على القرص/قاعدة البيانات.

```
رسالة المستخدم
      │
      ▼
 [plan]  النموذج يعيد <plan> (العنوان، الحزمة التقنية، قائمة الملفات، الخطوات)
      │        الخادم يحفظ الخطة في message(kind='plan') ويكشف الملفات الناقصة
      ▼
 [create] جولة أو أكثر: النموذج يعيد <file path="...">…</file> لكل ملف
      │        الخادم يطبّق العمليات، يحفظ نسخة مراجعة، ويعيد الملفات الناقصة
      ▼
 [edit]  بعد وجود ملفات: التعديل يلمس الملفات المعنية فقط
      │
      ▼
 معاينة حيّة (تُبنى من نفس الملفات) + طرفية حقيقية + نشر
```

- **بروتوكول الوسوم** هو العقد بين النموذج والخادم:
  `<plan>{…}</plan>`, `<file path="src/App.jsx">…</file>`, `<delete path="…"/>`, `<message>…</message>`.
  أي ردّ لا يتبع الوسوم يُقرأ كـ JSON بديل، وإن كان الردّ مقطوعًا تُعلَن الملفات الناقصة
  (`truncatedFiles`) بدل الادّعاء بأن البناء نجح. التنفيذ في `api/_lib/studio/agent.js`.
- **البثّ**: كل شيء يصل عبر SSE (`user_message`, `status`, `prose`, `file`, `delete`, `plan`,
  `message`, `done`, `error`) فيرى المستخدم الملفات تظهر لحظة كتابتها.
- **الجولات محدودة** (`MAX_AGENT_ROUNDS`) حتى لا تدور الحلقة بلا نهاية، وما يبقى ناقصًا
  يُعرض كملاحظة.
- **التعديل لا يمسّ ما لم يُطلب**: يُختبر صراحة (تعديل `style.css` يترك `index.html` سليمًا).

---

## 3) الواجهة

- **لوحة المشاريع** (يسار): إنشاء، فتح، إعادة تسمية، حذف، حصص التخزين.
- **المحادثة** (العمود الأوسط): وصف التطبيق، ومؤشّر الخطة/الجولة، والملفات المكتوبة كرقائق
  تُفتح بنقرة، وزر إيقاف يُبقي ما كُتب حتى اللحظة.
- **مساحة العمل** (يمين) بأربع تبويبات:
  - **Preview**: معاينة حيّة مع جسر `postMessage` يجلب أخطاء الكونسول إلى طرفية NEXORA.
  - **Code**: شجرة ملفات (إنشاء/إعادة تسمية/حذف) + محرر CodeMirror 6 بتمييز لغات وإكمال.
  - **Terminal**: أوامر حقيقية (`npm`, `node`, `git`)، زر تشغيل خادم تطوير، وسجل أوامر.
  - **Publish**: نشر Vercel، دفع GitHub، تصدير ZIP، قائمة النشرات ونقاط الاستعادة.
- **الإعدادات**: مفاتيح المزوّدين (تُختبر وتُحفظ مشفّرة) · ربط GitHub/Vercel · معلومات
  بيئة التشغيل والتخزين.
- **Ctrl/Cmd + K**: لوحة أوامر حقيقية (فتح مشروع، تبديل التبويب، نشر، إعدادات…).

---

## 4) الـ API

كل المسارات تحت `/api/studio` وتتطلب جلسة NEXORA (Bearer) عدا في وضع التطوير المحلي.

| الطريقة | المسار | الوظيفة |
| --- | --- | --- |
| GET | `/session` | من أنا + حالة التخزين + بيئة التشغيل + مزوّد النموذج |
| GET | `/config` · `/runtime` | الإمكانات المتاحة (تنفيذ، معاينة، نشر) |
| GET/POST | `/projects` | قائمة المشاريع · إنشاء مشروع |
| GET/PATCH/DELETE | `/projects/:id` | مشروع كامل بملفاته · حفظ · حذف |
| POST | `/projects/:id/files` | إضافة/حذف/إعادة تسمية ملف من الشجرة |
| POST | `/projects/:id/save` | حفظ دفعة ملفات + نسخة مراجعة |
| GET | `/projects/:id/revisions` | نقاط الاستعادة |
| POST | `/projects/:id/revisions/:revisionId/restore` | استعادة نسخة |
| GET | `/projects/:id/runs` · `/runs/:id` | سجلّ التشغيلات |
| POST | `/agent` | **SSE**: تشغيل الوكيل (plan / create / edit / fix) |
| POST | `/exec` | **SSE**: أمر حقيقي + خرجه |
| POST | `/projects/:id/dev/start` · `/dev/stop` · `/dev/status` | خادم التطوير |
| POST | `/projects/:id/deploy/vercel` · `/deploy/github` | نشر حقيقي |
| GET | `/deploy/vercel/:deploymentId` | حالة النشر |
| GET | `/projects/:id/deployments` | قائمة النشرات |
| POST | `/ai/keys` · DELETE `/ai/keys/:provider` | مفاتيح المزوّدين |
| POST | `/ai/test` | اختبار مفتاح/موديل فعليًا |
| POST/DELETE | `/integrations/:provider` | ربط/فصل GitHub وVercel |
| GET | `/workspace/:id/files` | ملفات مساحة العمل |

> بثّ الوكيل والطرفية يمرّ عبر `api/index.js` مباشرة (`studio/agent` و`studio/exec`)،
> وبقية المسارات عبر `registerStudioRoutes` في `api/_lib/studio/routes.js`.

---

## 5) التخزين

- **Postgres (Neon)** عند وجود `DATABASE_URL` أو `POSTGRES_URL` — عبر HTTP، بلا حزم إضافية.
- **SQLite محلي** (`node:sqlite`) على `STUDIO_DB_PATH` (الافتراضي `.nexora/studio.sqlite`).
- الجداول تُنشأ تلقائيًا أول مرة: `studio_projects`, `studio_files`, `studio_messages`,
  `studio_revisions`, `studio_deployments`, `studio_keys`, `studio_integrations`.
- **الحدود**: 400 ملف للمشروع، 400 كيلوبايت للملف، 3 ميغابايت للمشروع، وعدد المشاريع حسب
  الباقة. تجاوزها يعيد خطأ واضحًا لا نجاحًا صوريًا.
- ⚠️ على Vercel بدون `DATABASE_URL` يعمل SQLite على قرص مؤقت: المشاريع تختفي بين
  الطلبات. `/session` يعلن ذلك (`ephemeral: true`).

---

## 6) مزوّدو النماذج

الترتيب: مفتاح الحساب المحفوظ في `studio_keys` ← ثم متغيّرات البيئة على الخادم. `STUDIO_MODEL` يفرض موديلًا واحدًا على كل المزوّدين.

| المزوّد | متغيّر المفتاح | متغيّر الموديل (اختياري) |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL`, `STUDIO_MODEL` |
| Google Gemini | `GEMINI_API_KEY` (أو `GOOGLE_API_KEY`) | `GEMINI_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` |
| Groq | `GROQ_API_KEY` | `GROQ_MODEL` |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` |
| xAI | `XAI_API_KEY` | `XAI_MODEL` |
| Mistral | `MISTRAL_API_KEY` | `MISTRAL_MODEL` |
| Cerebras | `CEREBRAS_API_KEY` | `CEREBRAS_MODEL` |
| GitHub Models | `GITHUB_MODELS_TOKEN` / `GH_MODELS_TOKEN` | `GITHUB_MODEL` |
| خادم متوافق | `STUDIO_AI_BASE_URL` + `STUDIO_AI_KEY` | `STUDIO_AI_MODEL` |

`STUDIO_ALLOW_KEYLESS=1` يسمح بخدمة عامة بلا مفتاح (مثل Pollinations) — للتجربة فقط.

---

## 7) بيئة التنفيذ

1. **E2B** عند `E2B_API_KEY` — عزل حقيقي لكل مشروع.
2. **محلي** عند `STUDIO_LOCAL_EXEC=1` (يعمل فقط مع `scripts/studio-server.mjs`).
3. غير ذلك: `exec_unavailable` — تظهر رسالة صريحة بدل أوامر وهمية.

> Vercel Serverless لا يستضيف خوادم تطوير طويلة العمر (`maxDuration: 60`). شغّل
> `npm run studio` محليًا لبيئة تنفيذ كاملة.

---

## 8) المعاينة

- **مشروع ثابت / React / TS**: يُبنى داخل المتصفح عبر `esbuild-wasm` مع استيراد React من
  `/studio/vendor/*` (لا شبكة، لا CDN). الناتج `srcDoc` يُحدَّث بعد كل حفظ.
- **مشروع خادم (Next.js/Express)**: يُشغَّل بخادم تطوير حقيقي ويُعرض `iframe` على رابطه؛
  وبدون بيئة تنفيذ تظهر التعليمات بدل شاشة بيضاء.
- الملفات التي يستوردها المشروع ولا وجود لها تُعرض كتحذير، لا تختفي بصمت.

---

## 9) النشر

- **GitHub**: إنشاء المستودع إن لمس، ثم blobs → tree → commit → ref للفرع المطلوب. رمز
  الدخول من `studio_integrations` أو `GITHUB_STUDIO_TOKEN` / `GH_TOKEN`.
- **Vercel**: إنشاء مشروع، رفع الملفات، بدء النشر ومتابعة حالته، ثم رابط مباشر.
  من `studio_integrations` أو `VERCEL_STUDIO_TOKEN` / `VERCEL_API_TOKEN` (+ `VERCEL_TEAM_ID`).
- **ZIP**: تصدير كامل يعمل بلا أي خدمة خارجية.

---

## 10) التشغيل محليًا

```bash
npm install
npm run studio          # الواجهة (5173) + الـ API (3001) معًا
# أو منفصلين
npm run studio:api      # API فقط
npm run dev             # vite فقط (يمرّر /api إلى 3001)
```

- `npm run studio:vendor` يُنزّل `esbuild.wasm` ونسخ React المحلية إلى `public/studio/`
  (يعمل تلقائيًا قبل `dev` و`build`).
- لتجربة بلا تسجيل دخول: `STUDIO_DEV_AUTH=1` (يُرفض على Vercel إلا بـ
  `STUDIO_ALLOW_DEV_AUTH_ON_VERCEL=1`، وهذا ممنوع في الإنتاج).

---

## 11) النشر على Vercel

| المتغيّر | لماذا |
| --- | --- |
| `DATABASE_URL` | حفظ المشاريع فعليًا (Neon) |
| `OPENAI_API_KEY` أو مزوّد آخر | تشغيل الوكيل |
| `E2B_API_KEY` | تنفيذ معزول للأوامر |
| `GITHUB_STUDIO_TOKEN` | النشر إلى GitHub |
| `VERCEL_STUDIO_TOKEN` | النشر إلى Vercel |
| `STUDIO_SECRET` / `NEXORA_SECRET` | تشفير المفاتيح المحفوظة |

`vercel.json` يضبط `api/index.js` بـ `maxDuration: 60`. البناء يشغّل `studio:vendor`
قبل `vite build`، فتُنشر أصول المعاينة مع الموقع.

---

## 12) الاختبارات

```bash
npm test                                  # كل شيء
node --test tests/studio-protocol.test.mjs   # بروتوكول الوسوم + تطبيق العمليات (8)
node --test tests/studio-agent-e2e.test.mjs  # وكيل SSE حقيقي + SQLite (2)
node --test tests/studio-exec.test.mjs       # أوامر وخادم تطوير حقيقيان (8)
node --test tests/studio-preview.test.mjs    # بناء المعاينة + ZIP (8)
node --test tests/studio-ui.test.mjs         # الواجهة في DOM حقيقي (2)
npm run smoke                                # المنتج كاملًا عبر HTTP حقيقي
```

`npm run smoke` يشغّل الـ API بقاعدة بيانات مؤقتة ونموذجًا محليًا، ثم ينفّذ المسار الحقيقي:
إنشاء مشروع ← خطة ← إنشاء ← حفظ الملفات ← تعديل ملف واحد ← أمر طرفية فعلي ← خادم تطوير
يجيب عبر HTTP ← لقطة مراجعة واستعادتها ← حذف المشروع. لا شيء داخل NEXORA محاكى فيه.

- `studio-agent-e2e` يشغّل خادمًا متوافقًا مع OpenAI على `127.0.0.1` ويقود المسار كاملًا:
  خطة ← جلبتا إنشاء ← تعديل ← حالة خطأ — مع قاعدة بيانات مؤقتة.
- `studio-ui` يركّب الواجهة فعليًا في jsdom: تحميل مشروع، فتح المحرر، بناء المعاينة، ثم
  كتابة رسالة تُقود خطة ← إنشاء ← ملفات ← معاينة، ويفشل عند أي خطأ React.
- **حدود التحقق في هذه البيئة**: الشبكة إلى مزوّدي النماذج وVercel محجوبة، فلا يمكن إثبات
  توليد حقيقي أو نشر Vercel من هنا. الدفع إلى GitHub تم التحقق منه فعليًا
  (`scripts/studio-verify-github.mjs`) بإنشاء فرع ودفع ملفات وقراءتها وحذف الفرع.

---

## 13) الأمان

- مسارات الملفات تُعقَّم: لا `..`، ولا مسارات مطلقة، ولا `.git`، ولا ملفات تنفيذية.
- المفاتيح تُشفَّر (AES-256-GCM) بمفتاح مشتق من `STUDIO_SECRET` ثم `JWT_SECRET` ثم `NEXORA_SECRET`،
  ولا تُعاد للعميل أبدًا — يُعاد آخر ٤ محارف فقط.
- `STUDIO_DEV_AUTH` لا يعمل على Vercel إلا بتفعيل صريح.
- كل استدعاء يتطلب ملكية المشروع (`owner_id`).
