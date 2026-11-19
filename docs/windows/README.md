# NEXORA AI — Windows Edition 4.4.0

<div dir="rtl">

## نظرة سريعة

هذه الحزمة تُحضّر **نسخة Windows حقيقية** من NEXORA AI اعتمادًا على تطبيق الويب الإنتاجي نفسه:
نفس الحساب، نفس قاعدة البيانات، نفس الـ API، نفس محادثات الذكاء الاصطناعي، ونفس NEXORA Studio.
لا يوجد أي خادم وهمي أو بيانات تجريبية أو مستخدمين مزيفين.

| المسار | ماذا يقدّم |
|---|---|
| `public/sw.js` + `public/offline.html` | خدمة عمل (service worker) تجعل التطبيق قابلًا للتثبيت على Windows وتعمل دون اتصال |
| `public/manifest.webmanifest` | بيانات PWA مع `window-controls-overlay` واختصارات وتثبيت على Windows |
| `src/WindowsShell.jsx` + `src/windows.css` | شريط عنوان Windows أصلي، قائمة تطبيق، اختصارات، حالة عدم الاتصال، نافذة تحديث |
| `src/pwa.js` + `src/pwaCore.js` | تسجيل خدمة العمل والتحديث والتثبيت — معطّل تمامًا داخل تطبيق أندرويد |
| `src/ads/` + `public/windows/ads-config.json` | خانة إعلان مخصّصة تظهر عند التفعيل فقط، موافقة، بوابات أسطح، **معطّلة افتراضيًا** |
| `windows/msix/` | مرجع AppxManifest وكل شعارات MSIX وSplash |
| `windows/scripts/` | أدوات Windows: توليد الأصول، تطبيق هوية Store، فحص الحزمة |
| `windows/package-identity.json` | هوية الحزمة والإصدار الرباعي (4.4.0.0) وقيم Partner Center |
| `public/windows/` | صفحة Windows العامة + سياسة خصوصية مكتوبة لنسخة Windows |

## ما هو جاهز الآن

- ✅ PWA قابلة للتثبيت على Windows 10/11 (Edge/Chrome) مع خدمة عمل آمنة.
- ✅ شريط عنوان Window Controls Overlay وقائمة تطبيق واختصارات لوحة مفاتيح.
- ✅ حالات تحديث/عدم اتصال/خطأ احترافية دون شاشة بيضاء.
- ✅ أصول MSIX كاملة (StoreLogo، مربعات بكل المقاييس، Wide، Splash، Unplated).
- ✅ سكربتات بناء/توقيع/فحص MSIX تعمل على Windows SDK.
- ✅ سياسة خصوصية Windows وروابط الدعم جاهزة لـ Partner Center.
- ✅ إعدادات إعلانات منفصلة عن الكود، بموافقة وبوابات أسطح، ومعطّلة افتراضيًا.

## ما لا يمكن تسليمه من هذا المستودع وحده

هذه ليست نواقص مخفية، بل خطوات تحتاج حسابك أو جهازك:

1. **شهادة توقيع MSIX** تصدر من Partner Center بعد التحقق من هوية الناشر. لا توجد شهادة في المستودع، ولا يجب أن تكون.
2. **Package/Identity/Name** و **Publisher** يُنسخان من Partner Center. القيم الحالية Placeholders صريحة.
3. **Product ID** في Microsoft Store لا يُخترع؛ يظهر بعد إنشاء المنتج.
4. **لقطات شاشة Store** يجب التقاطها من التطبيق الحقيقي على Windows (السكربت جاهز في `docs/windows/SCREENSHOTS.md`).
5. **تحقق الإعلانات** لا يكتمل إلا بعد موافقة كتابية من مزوّد مناسب لنوع الحزمة، ثم اختبار إعلان حقيقي. لا يُعلَن أن الإعلانات تعمل قبل ذلك.

## ابدأ من هنا

1. [`BUILD-AND-DEPLOY.md`](BUILD-AND-DEPLOY.md) — البناء والنشر والتحقق.
2. [`MSIX.md`](MSIX.md) — من Partner Center إلى حزمة موقّعة.
3. [`ADS-INTEGRATION.md`](ADS-INTEGRATION.md) — نتيجة التحقيق في MG Ads وAdSense وAdMob وMonetag.
4. [`STORE-LISTING.md`](STORE-LISTING.md) — نصوص المتجر والأصول والمتطلبات.
5. [`TEST-REPORT.md`](TEST-REPORT.md) — ما اختُبر فعليًا وما ينتظر جهاز Windows.
6. [`UNSUPPORTED.md`](UNSUPPORTED.md) — الميزات غير المدعومة والقيود المعروفة.
7. [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) — قائمة تحقق قبل الإرسال للمتجر.
8. [`SCREENSHOTS.md`](SCREENSHOTS.md) — التقاط لقطات المتجر الحقيقية.
9. [`SECURITY-AND-PRIVACY.md`](SECURITY-AND-PRIVACY.md) — مراجعة الأمان والخصوصية وما لم يُختبر.

</div>

## English summary

This folder prepares a genuine Windows edition of NEXORA AI on top of the existing production web app:
same account, database, API, AI conversations and Studio. There is no mock backend, fake user or demo data.

**Ready:** installable PWA, service worker + offline shell, Window Controls Overlay title bar, app menu,
keyboard shortcuts, update/offline/error states, complete MSIX icon and splash assets, MSIX build/patch/sign
scripts, a Windows privacy policy, and a fail-closed advertising configuration that ships disabled.

**Requires your account or Windows machine:** Partner Center package identity and signing certificate,
the Store Product ID, real Store screenshots, and any advertising verification. None of these are invented
in the repository.
