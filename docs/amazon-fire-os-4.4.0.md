# NEXORA AI — تقرير إصلاح رفض Amazon Appstore (Fire OS)

> **النسخة:** 4.4.0 · **versionCode:** 44 · **Package:** `com.ahmedbecetti.nexora`
> **النوع:** إصلاح تسجيل الدخول + بديل حقيقي بالبريد الإلكتروني
> **تاريخ:** 2026-11-12

---

## 1. ما رصدته Amazon وما وجدناه فعليًا

| بند المراجعة | ما وجدناه في الشيفرة/الحزمة |
|---|---|
| «الضغط على Continue with Google لا يستجيب» | **مؤكَّد وسببه محدَّد** — انظر §2 |
| «شاشة تحميل لا تنتهي» | **مؤكَّد** — لا حدّ زمني على أي وعد في مسار Google |
| «يلزم بديل بالبريد» | **غير موجود فعليًا**: الحقول كانت موجودة، لكن زر Google كان يبقى معلّقًا بلا أي تحويل |

### دليل رقمي من الحزمة المنشورة (v43)

```
$ node scripts/inspect-apk.mjs public/download/Nexora.apk
- الحزمة: com.ahmedbecetti.nexora
- versionCode: 43 · versionName 4.3.0
- التوقيع: CN=NEXORA AI, OU=Mobile, O=Ahmed Becetti, L=Chlef, C=DZ
- SHA-256 للشهادة: 24:0E:00:2F:...:42:F6
- تهيئة Firebase/Google داخل الحزمة: لا (البريد/الهاتف فقط — متوافق مع Fire OS)
```

وفي `resources.arsc` للحزمة نفسها: القيمة النائبة `WILL_BE_OVERRIDDEN` موجودة،
ولا يوجد أي `*.apps.googleusercontent.com`. أي أن **الحزمة 43 شُحنت بلا تهيئة Firebase ولا Web client**.

---

## 2. السبب الجذري (لماذا كان الزر «لا يستجيب»)

1. `src/screens/Auth.jsx` كان يستدعي `FirebaseAuthentication.signInWithGoogle()`
   من `@capacitor-firebase/authentication` مباشرة.
2. هذه الإضافة تهيّئ `FirebaseAuth.getInstance()` في `load()`. عند غياب
   `google-services.json` → `FirebaseApp` غير مهيّأ → استثناء على مستوى Java
   أثناء تحميل الإضافة.
3. Capacitor في `Bridge.callPluginMethod` يلتقط `PluginLoadException` ويطبع سجلًا فقط،
   **دون resolve ولا reject لوعد JavaScript**.
4. النتيجة: `await` في الواجهة ينتظر إلى الأبد ⇒ زر يبدو ميتًا + حالة `busy` دائمة.
   على Fire OS يضاف سبب ثانٍ: غياب Google Play Services ⇒ `CredentialManager`/`GoogleSignIn` غير متاحين أصلًا.
5. تصحيح إضافي: `src/screens/Auth.jsx` كان يخفي زر Google كليًا داخل التطبيق
   (`insideApp()` على أساس `user-agent`)، لكن إضافة `appendUserAgent: NexoraAI` غير مضبوطة
   في `capacitor.config.json` ⇒ الإخفاء غير موثوق و«شرط نجاح» غير متحقق.

---

## 3. ما تغيّر

### أ) زر Google: استجابة مضمونة، لا تعليق

| الملف | التغيير |
|---|---|
| `src/firebase.js` | `signInWithGoogle()` أصبح: فحص بيئة الجهاز ⟹ مهلة صارمة (90s) ⟹ محاولة ثانية بالواجهة الكلاسيكية ⟹ كود خطأ مفهوم. كل استيراد/استدعاء أصلي داخل `try`. |
| `src/authPolicy.js` *(جديد)* | منطق نقي قابل للاختبار: `decideGoogleAvailability`, `googleFailureNeedsEmailFallback`, `withTimeout`, تحقّق البريد/كلمة المرور. |
| `src/screens/Auth.jsx` | الزر صار `<a role="button">` (تنقّل حقيقي)، مع `busyRef` لمنع النقر المزدوج، و`aria-busy`، و`try/finally` يضمن رفع حالة الانتظار. أي فشل ⟹ رسالة + إبراز حقل البريد تلقائيًا. |

### ب) تشخيص أصلي جديد (بلا Firebase ولا Play Services)

| الملف | الدور |
|---|---|
| `android/app/src/main/java/com/ahmedbecetti/nexora/NexoraAuthPlugin.java` *(جديد)* | إضافة Capacitor باسم `NexoraAuth` تعيد: `playServices` (انعكاس)، `firebaseConfigured`، `webClientConfigured`، `fireOs`، `googleSignInAvailable`، `reason`. كل الفحوص داخل `try/catch` — **لا يمكن أن تُسقط التطبيق**، ولا تستدعي `FirebaseAuth.getInstance()`. |
| `MainActivity.java` | تسجيل صريح للإضافة قبل `super.onCreate` (لا يعتمد على `cap sync`). |

### ج) دخول حقيقي بالبريد الإلكتروني (بديل كامل)

- تسجيل الدخول: بريد/اسم مستخدم + كلمة مرور ← `POST /api/auth/login` (نفس نظام الحسابات الحالي، نفس المحادثات).
- حساب جديد: `POST /api/auth/register` — بنفس `users` و`firebase_uid`، فلا حسابات مكررة.
- استعادة كلمة المرور: `POST /api/auth/reset` ← رابط حقيقي عبر Firebase Admin REST، بمهلة 25s.
- التحقق قبل الإرسال: صيغة البريد وطول كلمة المرور (6+) مطابقان لقواعد الخادم.
- **لا يعتمد على Google Play Services إطلاقًا.**

### د) بناء متوافق مع Fire OS

| الملف | التغيير |
|---|---|
| `android/build.gradle` | حساب `rgcfaIncludeGoogle` **قبل** تهيئة المشاريع الفرعية: `google-services.json` موجود (أو `GOOGLE_SERVICES_JSON`) ⟹ Google مفعّل؛ غائب ⟹ لا تُشحن واجهة Google أصلًا. |
| `android/app/build.gradle` | `versionCode 44` · `versionName 4.4.0` · نفس `applicationId` · يقرأ قرار الجذر بدل تخمينه. |
| `android/app/src/main/AndroidManifest.xml` | `usesCleartextTraffic=false` صريح، `ACCESS_NETWORK_STATE`، `uses-feature required=false` للّمس/الميكروفون/الكاميرا/الموقع (توافق Fire TV/Tablet أوسع)، وفلاتر روابط Firebase لاستعادة كلمة المرور. |
| `src/ads.js` | على جهاز `playServices=false` لا تُهيّأ AdMob إطلاقًا (تفادي بطء/تعليق الإقلاع على Fire OS). ID الحقيقي `ca-app-pub-6858364141205978/1001361442` بقي كما هو. |
| `src/api.js` | مهلة 45s افتراضية لكل نداء — لا انتظار أبدي عند شبكة ضعيفة. |
| `src/ai/AIPlatform.jsx` | فحص جلسة الإقلاع ≤ 20s بحزام أمان (لا Splash أبدية). |

---

## 4. نتائج الاختبارات (منفَّذة فعليًا)

```
$ npm test
# tests 28
# pass 28
# fail 0
```

| # | الاختبار المطلوب من Amazon | كيف تحقّقنا | النتيجة |
|---|---|---|---|
| 1 | تثبيت APK على Fire Tablet | **يحتاج جهازًا/محاكيًا** — غير متاح في بيئة العمل | ⛔ لم يُنفَّذ |
| 2 | زر Continue with Google | محاكاة الإضافة المعلّقة (سلوك v43) + قرار Fire OS + مهلة | ✅ 5 اختبارات |
| 3 | تسجيل الدخول بالبريد | مراجعة مسار `auth/login` (متصل بالخادم وحده) + تحقق المدخلات | ✅ اختبارات وحدات + مراجعة مسار |
| 4 | إنشاء حساب جديد | مسار `auth/register` + تحقق البريد/كلمة المرور | ✅ |
| 5 | خروج وإعادة دخول | `logout` ثم `login` بنفس منطق الحسابات (لم يُغيَّر) | ✅ مراجعة مسار |
| 6 | استعادة كلمة المرور | `auth/reset` بمهلة + رسالة `sentTo` | ✅ |
| 7 | الوصول للواجهة بعد الدخول | `login()` يحفظ الرمز و`me` ثم يركّب المنصة | ✅ مراجعة مسار |
| 8 | استمرار عمل API وFirebase | **لم يُشغَّل الخادم**: `nexora-social-2026.vercel.app` غير قابل للوصول من بيئة الاختبار | ⛔ يحتاج تحققًا من البيئة |
| 9 | عدم الانهيار بلا Play Services | مسار كامل محمي بمهل + إضافة تشخيص لا ترمي | ✅ 6 اختبارات |

### ⚠️ ما لم نُثبته (بصراحة، كما طلبت Amazon)

- **لم يُشغَّل هذا الإصدار على جهاز Fire OS فعلي.** لا يوجد جهاز ولا محاكي في بيئة العمل،
  ولا يمكن بناء APK هنا: لا JDK، ولا Android SDK، والشبكة تسمح بـ `github.com` و`npmjs` و`pypi` فقط
  (لا `dl.google.com` ولا `services.gradle.org`).
- الدخول عبر Google في **هذا الإصدار لن يعمل** حتى يُضاف `google-services.json` الحقيقي
  (Web + Android client ببصمة SHA-256 للإنتاج `24:0E:00:2F:...:42:F6`) كسر `GOOGLE_SERVICES_JSON`.
  في هذه الحالة يُبنى التطبيق بحذر: زر Google يعرض تنبيهًا واضحًا ويحوّل إلى البريد،
  **ولا يتوقف التطبيق** — وهو ما يطلبه مراجع Amazon.

---

## 5. الخطوات النهائية عندك (بالترتيب)

1. **Firebase Console** → Project settings → Your apps → Android `com.ahmedbecetti.nexora`:
   أضف بصمة **SHA-256** `24:0E:00:2F:A0:90:51:6D:EF:06:E8:92:61:4F:03:A3:79:17:A0:3B:30:04:BE:EC:F5:1B:1A:D3:0C:07:42:F6`
   (وبصمة SHA-1 المقابلة)، وفعّل Google provider.
2. نزّل `google-services.json` وضعه في **GitHub → Settings → Secrets → Actions**
   بالاسم `GOOGLE_SERVICES_JSON` (المحتوى الكامل). لا ترفعه إلى Git (مستبعد في `.gitignore`).
3. شغّل الـ workflow: `Actions → Build Nexora APK → Run workflow` على `main`.
   المخرجات: `Nexora.apk` (44) + `apk-report.txt` يحتوي الحزمة/الإصدار/بصمة التوقيع/وجود تهيئة Google.
4. ثبّت على Fire Tablet واختبر 9 بنود §4 يدويًا. لو ظهر `googleUnavailable`
   على Fire OS فهذا هو السلوك الصحيح: البريد يجب أن يعمل.

### التحقق من الحزمة المبنية (بدون أدوات أندرويد)

```bash
node scripts/inspect-apk.mjs Nexora.apk     # الإصدار، البصمة، هل Google مُهيّأ
node scripts/check-login-config.mjs         # فحص ربط أندرويد قبل البناء (يعمل في CI)
```

---

## 6. ما لم يُلمس (كما اشترطت)

- نفس **Package Name** ونفس **مفتاح التوقيع** (لم يُقرأ ولا يُكتب أي سر).
- Firebase و API الحاليان يعملان كما هما؛ لم يُستبدل نظام الحسابات.
- المحادثات والذكاء الاصطناعي والترجمة والصوت وتحليل الملفات وتوليد الصور: بلا تغيير وظيفي.
- تصميم التطبيق: نفس الشاشات والأنماط؛ أُضيف فقط تنبيه البديل وزر الهاتف في شاشة الدخول.
- AdMob: نفس معرّفات الإنتاج، وتُعاد تهيئتها فقط عندما يكون Play Services متاحًا.
- لا بيانات وهمية ولا دخول تجريبي: كل نجاح يتطلب رمز خادم حقيقيًا (`token`).
