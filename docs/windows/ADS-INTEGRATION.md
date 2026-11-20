# Advertising integration — Windows Edition

> **Status: not operational.** No third-party advertising network is enabled in the NEXORA AI Windows app
> (PWA or MSIX). This document records the investigation, the implementation that is ready, and the exact
> conditions required before any ad can be shown. Nothing here should be read as a claim that ads work.
>
> **MG Ads revalidated 19 Nov 2026:** MG publishes a UWP SDK (`MiracleGames.Sdk.Uwp`, UAP 10.0, C#/XAML),
> a native C++ (Win32) SDK, and an H5 SDK for its own H5 Store channel. None can be attached to this
> PWABuilder Win32/WebView2 hosted PWA without a native host we own or a verified H5/WebView2 integration.
> A banner is not integrated. Full evidence: [`MG-ADS-FEASIBILITY.md`](MG-ADS-FEASIBILITY.md).

<div dir="rtl">

## ١) الخلاصة التنفيذية

- **لا يوجد مزوّد إعلانات متحقق منه يعمل داخل حزمة Windows الحالية.** لذلك بقيت الإعلانات **معطّلة** في
  `public/windows/ads-config.json` (`enabled: false`, `provider: "none"`).
- **AdMob لا يدعم Windows desktop**؛ هو SDK لأندرويد/iOS. معرّفات AdMob الإنتاجية الموجودة في تطبيق
  أندرويد لا تُستخدم ولا تُنسخ إلى نسخة Windows.
- **AdSense مخصّص لصفحات الويب**، وسياساته تمنع عرضه داخل أغلفة تطبيقات سطح المكتب وتقنيات WebView.
  أبقيناه على صفحات الموقع العامة فقط، ولم نفعّله في التطبيق المثبّت ولا في MSIX.
- **MG Ads = عائلة SDKs من Miracle Games**: منتجها الحالي **MG Ads SDK for UWP** (NuGet `UAP 10.0`،
  C#/XAML)، ولديها أيضًا **C++ SDK** لمضيف Win32 أصلي، و**H5 SDK** لقناة H5 Microsoft Store الخاصة بها.
  حزمة PWABuilder الحالية هي **Win32/PWA host عبر WebView2**، وليست تطبيق UWP، ولا تملك مشروع C++ أصليًا
  يمكن ربط المكتبة فيه، ولا يوجد توثيق عام متاح لـ H5 SDK يثبت عملها داخل WebView2. لذلك **غير متوافق
  مع نوع الحزمة الحالية** دون مشروع أصلي منفصل أو تأكيد كتابي من MG.
- **Monetag / Adsterra**: لم نتحقق كتابيًا من سماح شروطها بالعمل داخل MSIX/WebView2 أو التطبيق المثبّت،
  ولم نُدمجهما. سكربتات Adsterra الحالية تبقى على صفحات الموقع فقط.
- **القياس الحقيقي لدى المزوّد فقط.** لا يوجد أي عدّاد انطباعات/نقرات محلي مزيف. بوابة التكرار في
  `src/ads/windowsAds.js` هي حدّ تجربة مستخدم (30 دقيقة/3 يوميًا) وليست تقرير أرباح.

### جدول التوافق

| المزوّد / التقنية | نوع البيئة المدعومة | يعمل في PWA مثبّت؟ | يعمل في MSIX/WebView2؟ | القرار |
|---|---|---|---|---|
| Google AdMob | Android / iOS SDK | ❌ لا يوجد SDK لسطح المكتب | ❌ | غير مستخدم |
| Google AdSense | صفحات ويب في متصفح | ⚠️ غير مؤكد/سياسات الأغلفة | ❌ ممنوع في WebView | معطّل داخل التطبيق |
| MG Ads (UWP / C++ / H5 SDKs) | UWP، Win32 أصلي، أو H5 Store الخاص بـ MG | ❌ لا مضيف أصلي نملكه | ❌ لا جسر JS موثّق | غير متوافق حاليًا |
| Monetag | وسوم ويب/نوافذ منبثقة | ⚠️ غير متحقق | ⚠️ غير متحقق | غير مُدمج |
| Adsterra | بانرات ويب | ⚠️ غير متحقق | ⚠️ غير متحقق | موقع فقط |
| Microsoft UWP ad monetization | UWP | — | — | أُغلق (مصدر ثانوي) |
| Microsoft Monetize (Xandr) | ناشر ويب/مؤسسات | — | — | لا تكامل جاهز |

> التحقق من الشروط مسؤولية الناشر ويجب أن يُعاد قبل كل تفعيل؛ الشروط تتغير. المصادر في نهاية الملف.

## ٢) ما الذي بُني فعليًا

| الملف | الوظيفة |
|---|---|
| `public/windows/ads-config.json` | تهيئة مستقلة عن الكود: المزوّد، الأسطح، التكرار، الموافقة، المقاس المحجوز |
| `src/ads/windowsAds.js` | تحقق صارم، فشل مغلق، أسطح، موافقة، بوابة تكرار، محوّل مزوّد |
| `src/ads/WindowsAdSlot.jsx` | خانة محجوزة، موافقة، تحميل AdSense عند التحقق فقط، لا قياس محلي |
| `src/ads/windowsAds.css` | مساحة متجاوبة لا تغطي المحتوى؛ عند الظهور تشغل مساحتها داخل التخطيط |
| `tests/windows-ads.test.mjs` | يثبت التعطيل الافتراضي، رفض معرّفات الاختبار، وبوابات الأسطح والموافقة |

### كيف تُحجز المساحة دون تغطية المحتوى؟

- الخانة تُرسم داخل تدفّق الصفحة (`ai-home-banner`) لا فوقه، بارتفاع محجوز `minHeight`/`maxHeight`
  من الإعدادات (96–140 بكسل افتراضيًا)، وبعرض `min(850px, 100% - 44px)`.
- عند التعطيل تُرجع `null` — لا مساحة فارغة دائمة ولا قفزة تخطيط.
- عند التفعيل تظهر بعلامة «إعلان» و`aria-label`، وتختفي بعد `visibleSeconds` (15s) ضمن بوابة 30 دقيقة.
- لا تُغطي الأزرار أو مربع الكتابة أو شريط التنقل؛ هي عنصر مستقل في مساحة الترحيب.

### الموافقة (Consent)

- المفتاح: `nx_ads_consent` بالقيمتين `granted` أو `denied`، ويُقرأ قبل أي طلب إعلان.
- عند `required: true` ولا توجد موافقة، تُعرض بطاقة موافقة واضحة مع رابط السياسة وخيار رفض متساوٍ.
- الرفض يعطّل الخانة كليًا ولا يحدّ من ميزات الذكاء الاصطناعي.
- سحب الموافقة = مسح المفتاح من بيانات التطبيق.
- لا تُحمَّل أي سكربتات إعلانية قبل الموافقة، ولا تُرسل أي معرّفات.

### الأسطح (Surfaces)

`runtimeSurface()` يقرأ معامل `?nx_surface=msix` الذي تضعه الحزمة في `--app-fallback-url`، ويحفظه في
`sessionStorage`، ويميّز:

| السطح | الوصف | الإعلانات |
|---|---|---|
| `android` | تطبيق Capacitor | ممنوع (AdMob فقط هناك) |
| `web` | متصفح عادي | مسموح نظريًا حسب التهيئة |
| `windows-browser` | Windows في المتصفح | مسموح نظريًا حسب التهيئة |
| `windows-pwa` | PWA مثبّت | معطّل افتراضيًا (سياسات المزوّد غير مؤكدة) |
| `windows-msix` | حزمة Store/WebView2 | ممنوع حتى تحقق كتابي + `allowInMsix: true` |

`allowInMsix` يبقى `false` في المستودع. حتى لو أضاف أحد `windows-msix` إلى `allowedSurfaces`،
يُحذف السطح تلقائيًا ما لم يُفعَّل `allowInMsix` صراحةً — وهذا يمنع تفعيلًا عرضيًا.

كذلك **AdSense مرفوض برمجيًا** على `windows-pwa` و`windows-msix` في `adsAllowedForSurface`،
حتى لو أُضيفا يدويًا إلى الإعدادات؛ لا يكفي تعديل JSON لتفعيله داخل تطبيق مثبّت.

## ٣) تفعيل مزوّد مستقبلًا (بعد التحقق فقط)

### الخطوات الإلزامية

1. **تحقق كتابي** من المزوّد: هل يسمح بعرض إعلاناته في (أ) PWA مثبّت على Windows، (ب) تطبيق MSIX
   يستضيف الموقع عبر WebView2؟ احتفظ بالرد (بريد/وثيقة) مع ملف الإصدار.
2. **تحقق من سياسة Microsoft Store**: الإعلانات يجب أن تتوافق مع سياسة المحتوى، وألا تحاكي واجهة
   النظام، وألا تسبب نقرات غير مقصودة، وأن تفصح عن نفسها.
3. **اختبار على حزمة حقيقية**: PWA مثبّت + MSIX موقّع، على Windows 10 و11، مع مانع إعلانات وبدونه،
   وعلى شبكة بطيئة. سجّل النتائج في `TEST-REPORT.md`.
4. **حدّث السياسة** (`public/windows/privacy.html#ads`) باسم المزوّد ونوع البيانات قبل التفعيل.
5. **فعّل الإعدادات**:

```json
{
  "enabled": true,
  "provider": "adsense",
  "providers": {
    "adsense": {
      "client": "ca-pub-XXXXXXXXXXXXXXXX",
      "slot": "1234567890",
      "allowedSurfaces": ["web", "windows-browser"]
    }
  }
}
```

6. **لا تفعّل MSIX** إلا بعد استيفاء البند 1 صراحةً:

```json
{ "allowInMsix": true, "allowedSurfaces": ["web", "windows-browser", "windows-pwa", "windows-msix"] }
```

### ما لا يُسمح به

- ❌ معرّفات Google الاختبارية (`ca-app-pub-3940256099942544/...`) في الإنتاج. الاختبارات ترفضها.
- ❌ معرّفات AdMob الإنتاجية في نسخة Windows (لا تعمل ولا معنى لها).
- ❌ توليد انطباعات أو نقرات أو إحصاءات محليًا، أو «إعلان وهمي» لملء المساحة.
- ❌ تحميل سكربت إعلاني قبل الموافقة.
- ❌ إعلان يغطي المحتوى أو يظهر فوق نافذة/كيبورد دون إغلاق.
- ❌ الادعاء أن الإعلانات «تعمل» قبل رؤية إعلان حقيقي في الحزمة النهائية.
- ❌ تغيير الهوية المسجلة من Partner Center أو نشر رابط متجر قبل الاعتماد.

### واجهة المحوّل

محوّل AdSense هو الوحيد المنفَّذ (`providerAdapter`). لإضافة مزوّد جديد:

1. أضف اسمه إلى `PROVIDER_STATUS` و`IMPLEMENTED_PROVIDERS` فقط بعد التحقق.
2. أضف دالة تحقق لمعرّفاته في `validateAdsConfig` (ترفض الاختبارية وتفشل مغلقًا).
3. أضف طلب الإعلان في `WindowsAdSlot.jsx`، مع تنظيف عند الإلغاء.
4. أضف اختبارات: تفعيل، رفض، سطح MSIX، موافقة، معرّف اختباري، غياب القياس المزيف.

## ٤) الخصوصية والامتثال

- الإعلانات المخصّصة تتطلب أساسًا قانونيًا (موافقة في EEA/UK وفق GDPR/ePrivacy). نستخدم موافقة
  صريحة مسبقة، ولا نعتمد «موافقة ضمنية».
- لا ننشئ نحن معرّفًا إعلانيًا في التطبيق. أي معرّف يستخدمه المزوّد يخضع لسياسته وإفصاحه.
- يجب أن يذكر الإفصاح اسم المزوّد، ونوع البيانات، ورابط سياسة الخصوصية/الإعلانات.
- Microsoft Store policy 10.2 (Advertising) يتطلب ألا تكون الإعلانات مضللة أو تسبب نقرات غير مقصودة.
  راجع النسخة الحالية من [Store Policies](https://learn.microsoft.com/windows/apps/publish/store-policies).

## ٥) نتيجة التحقيق في MG Ads (بالتفصيل)

**MG Ads** هي منصة إعلانات من **Miracle Games**، وتقدّم أكثر من حزمة واحدة:

- **MG Ads SDK for UWP** (المنتج الرئيسي الحالي): حزمة NuGet `MiracleGames.Sdk.Uwp` تستهدف `UAP 10.0`،
  وواجهة C#/XAML (`ApplicationManager.SetupAsync` و`AdvertisingManager.ShowAd(..., AdType.Banner, ...)`).
  أحدث إصدار موثّق وقت المراجعة: 2.8.7.0 (2026-01-08)، ويتطلب Windows 10 SDK 14393+ وVisual Studio.
- **Miracle Games C++ SDK (Win32)**: مكتبة أصلية، آخر إصدار موثّق `V1.2.6.6` (2024-12-30)، وتشمل
  واجهة إعلانات (Banner 728×90، افتتاحي، بيني، إلخ). تحتاج مضيف Win32 أصليًا.
- **H5 SDK**: مخصّص لنسخ **H5 Microsoft Store** التي يديرها MG. صفحة توثيقه تُرجع خطأ حاليًا، ورابط
  تنزيله في صفحة Advertising SDK يشير إلى صفحة UWP SDK؛ لا توجد واجهة JS عامة موثّقة ومتحقق منها.
- WebView2 داخل SDK (منذ 2.8.6) هو متصفح داخلي لصفحات MG، وليس واجهة JavaScript للمحتوى الخارجي.

**لماذا لا يعمل مع نسخة NEXORA AI الحالية؟**

1. حزمة PWABuilder هي **Win32 Hosted App Model** تستضيف الموقع في WebView2، وليست تطبيق UWP.
2. SDK الخاص بـ UWP يعتمد على XAML/`Windows.UI`، ولا يمكن استدعاؤه من صفحة ويب.
3. C++ SDK يحتاج مضيف Win32 أصليًا نملك مصدره؛ المشروع المضيف الذي يولّده PWABuilder ليس في هذا
   المستودع، ولا نضيف إليه مكتبة أصلية دون إعادة بناء الحزمة واختبارها.
4. H5 SDK مرتبط بقناة H5 Store الخاصة بـ MG، ولا يوجد دليل على أنه يعمل داخل WebView2 لتطبيق PWA
   مستقل أو أن انطباعاته تُحتسب لهوية المتجر هذه. لا نبني على افتراض أو معرّفات مؤقتة.
5. لا يوجد `AppKey` أو `BannerAdUnitId` إنتاجي من MG، والمنتج ما زال Draft.

**الخلاصة:** MG Ads غير متوافق مع PWA/MSIX بهذا الشكل. لا نضيفه، ولا نستخدم معرّفاته. إن أراد المالك
لاحقًا مسارًا أصليًا بالكامل (WinUI/UWP أو Win32 C++) فهذا مشروع منفصل، ويجب فيه إعادة بناء الواجهة
والتحقق من كل المتطلبات. المسار الوحيد الآخر هو تأكيد كتابي من MG بأن H5 SDK يعمل داخل WebView2،
مع توثيق عام ومفاتيح إنتاجية، ثم اختبار حقيقي قبل أي ادعاء.

## ٦) مصادر للمراجعة (روابط عامة)

- Google AdSense — سياسات المواضع: <https://support.google.com/adsense/answer/1354736>
- Google AdSense — سياسات البرنامج (تطبيقات/WebView): <https://support.google.com/adsense/answer/48182>
- MG Ads — الموقع الرسمي: <https://www.mg-ads.com/>
- MG Ads SDK for UWP — وصف المنتج: <https://www.mguwp.com/MGAds>
- MG UWP SDK — التنزيلات والمتطلبات: <https://doc.mguwp.net/en/uwpsdkupdate.html>
- MG C++ SDK (Win32) — التنزيلات والإعلانات: <https://doc.mguwp.net/c_sdk_update.html>
- MG Advertising SDK — مداخل Native/Win32/H5: <https://www.mguwp.net/en/adcenter/receive.html>
- MG SDK index (UWP/Win32/H5): <https://doc.mguwp.net/en/>
- حزمة NuGet الرسمية: <https://www.nuget.org/packages/MiracleGames.Sdk.Uwp>
- مثال التكامل C#: <https://github.com/MiracleGames/MiracleGamesUWPSDK>
- PWABuilder — حزم Windows: <https://www.pwabuilder.com/>
- Microsoft Store Policies: <https://learn.microsoft.com/windows/apps/publish/store-policies>
- Microsoft Q&A — AdSense في تطبيقات Store/PWA: <https://learn.microsoft.com/en-us/answers/questions/5683810/>

> هذه الروابط للتوثيق والسياق. الشروط قد تتغير؛ لا تعتمد على هذه الصفحة كبديل عن قراءة الشروط
> الحالية والحصول على تأكيد كتابي.

</div>

## English key points

- **No ad network is enabled.** `public/windows/ads-config.json` ships `enabled: false`, `provider: none`,
  `allowInMsix: false`.
- **MG Ads cannot be used in this package**: MG publishes a UWP SDK, a native C++/Win32 SDK, and an H5 SDK
  for its own H5 Store channel. A PWABuilder MSIX is a Win32/WebView2 hosted PWA, not a UWP app, and this
  repository does not own the generated native host. A separate UWP/WinUI or Win32 host with WebView2 is
  technically possible, but it is a different package and requires real MG credentials; it does not need
  the retired EdgeHTML/WWAHost path.
- **AdMob does not support Windows desktop.** Its Android production IDs are not reused.
- **AdSense stays on the public website.** Its policies prohibit desktop application wrappers and WebView
  technologies. The installed Windows app is excluded by configuration **and** rejected in code for
  `windows-pwa`/`windows-msix`, so editing JSON alone cannot enable it there.
- **Monetag/Adsterra are not verified** for this package type and are not integrated.
- A responsive slot is reserved in the layout, a consent dialog exists, and the code fails closed. Real
  impressions/clicks are measured only by an approved provider — never simulated locally.
- **Do not change** the recorded Partner Center identity or publish a Store link before certification.
- Enabling any provider requires written verification, a privacy update, package-level testing on Windows
  10/11, and explicit configuration. Until then, advertising must be described as **not operational**.
