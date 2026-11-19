# MG Ads feasibility for the NEXORA AI Windows package

**Date:** 19 November 2026
**Product:** NEXORA AI 4.4.0, Partner Center identity
`Ahmedbecetti.NEXORAAIbyBECETTI` / Product ID `9ND09PBRDPKZ` (Draft, not published)
**Question:** can MG Ads (Miracle Games) be integrated and a Banner Ad added?
**Verdict:** **No for the current package type.** MG publishes a UWP SDK, a native C++ SDK and an H5
SDK for its own Microsoft Store H5 channel. None of them can be safely attached to this PWABuilder
Win32/WebView2 hosted PWA as it is built today. A banner is **not** enabled in this build.

<div dir="rtl">

## ١) الخلاصة

النسخة الحالية من NEXORA AI على Windows هي **PWA مُستضافة داخل MSIX** (Hosted App Model) ينتجها
PWABuilder، وتعمل عبر **WebView2/Win32** بصفحة بدء HTTPS. وهذا يختلف عن الأنواع الثلاثة التي يدعمها MG:

1. **MG Ads SDK for UWP** — حزمة NuGet `MiracleGames.Sdk.Uwp` تستهدف `UAP 10.0`، وواجهتها C#/XAML.
2. **C++ SDK (Win32)** — مكتبة أصلية لتطبيقات Win32، وآخر إصدار موثّق `V1.2.6.6` بتاريخ 2024-12-30.
3. **H5 SDK** — مخصّص لنسخ ألعاب **H5 Microsoft Store** التي يديرها MG، وليس SDK ويب عامًا.

لا توجد في الحزمة الحالية عملية أصلية (UWP أو C++/Win32) نستطيع تحميل SDK فيها، ولا مشروع مضيف
نملك مصدره لتعديله. كما لا يوجد `AppKey` أو `BannerAdUnitId` إنتاجي من MG. لذلك **لم تتم إضافة
Banner Ad ولم تُدخل مفاتيح MG Ads**. أي ادعاء بأن الإعلان يعمل سيكون غير صحيح، والمنتج ما زال Draft.

## ٢) الأدلة التي تم التحقق منها

| المصدر | ما يقوله | الأثر على هذا القرار |
|---|---|---|
| [صفحة MG Ads الرسمية](https://www.mguwp.com/MGAds) | المنتج الرئيسي: **MG Ads SDK for UWP**؛ يذكر Banner/Interstitial/Native/Video | لا يقدّم واجهة JS موثّقة يمكن تحميلها في PWA |
| [توثيق تحديثات UWP SDK](https://doc.mguwp.net/en/uwpsdkupdate.html) | **Miracle Games UWP SDK**؛ الإصدار 2.8.7.0 بتاريخ 2026-01-08؛ يتطلب Windows 10 SDK 14393+ وVisual Studio | حزمة UWP أصلية، وليست حزمة ويب |
| [NuGet: MiracleGames.Sdk.Uwp](https://www.nuget.org/packages/MiracleGames.Sdk.Uwp) | الأهداف المتوافقة: `UAP 10.0` فقط | لا يوجد target لـ Win32/.NET Desktop/WebView2 |
| [مستودع MiracleGamesUWPSDK](https://github.com/MiracleGames/MiracleGamesUWPSDK) | `ApplicationManager.SetupAsync("APPKEY")` و`AdvertisingManager.ShowAd(BannerAdUnitId, AdType.Banner, ...)` بلغة C# | الإعلان يُستدعى من عملية أصلية، لا من JavaScript |
| [صفحة تنزيل C++ SDK](https://doc.mguwp.net/c_sdk_update.html) | **Miracle Games C++ SDK**، `V1.2.6.6` (2024-12-30)، ويشمل واجهة إعلانات (Banner 728×90 وغيرها) | مسار Win32 ممكن **فقط** بمضيف C++ أصلي، وليس بحزمة PWABuilder الحالية |
| [صفحة Advertising SDK](https://www.mguwp.net/en/adcenter/receive.html) | تعرض Native SDK وWin32 SDK وH5 SDK؛ رابط H5 يشير إلى صفحة تحديث UWP، ورابط Win32 بلا وجهة | لا حزمة H5/Win32 قابلة للتنزيل والتحقق من هذه الصفحة |
| [فهرس توثيق MG](https://doc.mguwp.net/en/) | يدرج UWP SDK وWin32 SDK وHtml5 UWP SDK وHtml5 SDK | H5 SDK موجود لمتجر H5 الخاص بـ MG، لا كواجهة ويب عامة |
| [صفحة H5 SDK](https://doc.mguwp.net/en/h5init.html) | تُرجع خطأ ولا تعرض واجهة برمجية قابلة للقراءة | لا يمكن التحقق من تحميلها داخل WebView2 أو قياسها |
| إصدار 2.8.6.0 (2025-03-19) | ترقية المتصفح الداخلي إلى WebView2 لتسجيل الدخول والدفع والإعلانات | **WebView2 داخل SDK** لا يعني أن SDK يعمل داخل صفحة ويب أو حزمة Win32 |

> ملاحظة مهمة: استخدام MG لـ WebView2 داخليًا لعرض صفحات تسجيل الدخول/الدفع/الإعلان **لا يجعله**
> SDK ويب. الكود الذي يستدعي الإعلان يبقى C#/UWP (أو C++ في نسخة Win32)، ولا يُستدعى من DOM.

## ٣) لماذا لا يعمل داخل حزمة PWABuilder الحالية؟

حزمة PWABuilder لتطبيق PWA هي **Hosted Web App**:

- تحتوي `AppxManifest.xml` على `StartPage` يشير إلى الموقع، وليس على صفحة XAML أو `Executable` خاص
  بتطبيق UWP أو Win32 مملوك لنا.
- الصفحة تعمل داخل WebView2 بواجهة الويب فقط؛ لا توجد مساحة أسماء `MiracleGames.*` ولا تحميل
  لحزم NuGet الخاصة بـ UWP، ولا مشروع C++ نضيف إليه مكتبة Win32.
- إضافة ملفات SDK إلى مجلد الحزمة لا تكفي: يجب وجود عملية أصلية تستدعي الواجهة البرمجية. مشروع
  PWABuilder المضيف يُولَّد خارج المستودع، وليس لدينا مصدره هنا لتعديله أو لإضافة جسر أصلي.
- حتى لو أضفنا DLL إلى الحزمة، فلن تستطيع JavaScript استدعاء واجهات WinRT/UWP أو C++ الخاصة به
  دون جسر أصلي مُعرَّف في المضيف (وهو غير موجود في هذه الحزمة).
- نسخة H5 SDK مرتبطة بمنصة **H5 Microsoft Store** التابعة لـ MG؛ لا يوجد دليل عام على أنها تُحمَّل في
  WebView2 لتطبيق PWA مستقل، أو أن انطباعاتها تُحتسب لحساب Microsoft Store هذا.

## ٤) الخيارات الحقيقية

### الخيار A — الإبقاء على حزمة PWA/MSIX الحالية (الموصى به لهذا الإصدار)

- التطبيق متوافق مع Microsoft Store كما هو، والهوية الحقيقية مثبّتة.
- الإعلانات **معطّلة**: `enabled: false` و`provider: "none"` و`allowInMsix: false`.
- خانة الإعلان والموافقة موجودة في الكود لكنها لا ترسم شيئًا ولا تطلب إعلانًا.
- لا يوجد دخل إعلاني في هذا الإصدار، ولا ادعاء بوجوده.

### الخيار B — مضيف UWP/WinUI أو Win32 أصلي + WebView2 + MG Ads (مشروع منفصل)

من الممكن تقنيًا بناء تطبيق أصلي جديد يستضيف موقع NEXORA داخل `WebView2` ويستخدم MG Ads SDK
لرسم Banner أصلي فوق/أسفل المحتوى. هذا **لا يتطلب** تقنيات EdgeHTML/WWAHost المتوقفة؛ WebView2
مدعوم داخل UWP وWinUI وWin32. لكنه:

1. ليس الحزمة الحالية، بل تطبيق مختلف بنموذج نشر مختلف.
2. يحتاج Visual Studio + Windows SDK + مشروع UWP/WinUI أو C++ + حساب MG Developer + `AppKey`
   و`BannerAdUnitId` حقيقيين من لوحة MG.
3. يحتاج التحقق من أن MG يقبل ربط التطبيق بهوية Microsoft Store الحالية والمسودة، ومن سياسة المحتوى.
4. يحتاج إعادة اختبار كامل على Windows 10/11، وتحديث سياسة الخصوصية، ومراجعة المتجر.
5. لا يمكن بناؤه أو اختباره في هذه البيئة (لا Windows SDK/Visual Studio ولا شهادة).

هذا الخيار **ممكن كتجربة مستقبلية**، وليس شيئًا يمكن تسليمه الآن أو دمجه في الحزمة الحالية.
حتى في هذا المسار، لا يجوز استخدام معرّفات اختبارية في الإنتاج، ولا بد من موافقة المستخدم وقياس
الانطباعات لدى MG.

### الخيار C — تأكيد كتابي من MG بأن H5 SDK يعمل داخل WebView2/PWA

إذا قدّمت MG توثيقًا عامًا و`AppKey` و`BannerAdUnitId` إنتاجيين، وأكدت كتابيًا أن H5 SDK يعمل داخل
WebView2 لتطبيق PWA مستقل ويُحتسب لحساب المتجر، فيمكن حينها تقييم هذا المسار. لكن هذا **غير متحقق
حاليًا**: صفحة H5 SDK لا تُحمَّل، ورابط تنزيلها في صفحة Advertising SDK يشير إلى صفحة UWP. لا نبني
تكاملًا على افتراض أو معرّفات مؤقتة.

## ٥) ما هو المطلوب إذا اختير الخيار B أو C لاحقًا

- `AppKey` من MG Developer، و`BannerAdUnitId` إنتاجي (لا اختباري).
- تصميم موضع البانر بحيث لا يغطي المحتوى أو أزرار النظام.
- موافقة صريحة، وسياسة خصوصية تُحدَّث باسم MG ونوع البيانات.
- اختبار على Windows 10/11، وقياس الانطباعات/النقرات لدى MG فقط.
- مراجعة Microsoft Store للسياسات الإعلانية.
- توثيق النتائج في `TEST-REPORT.md` قبل أي ادعاء بأن الإعلان يعمل.
- إذا تغيّر نموذج الحزمة، تنسيق الهوية الجديدة مع Partner Center وعدم تغيير الهوية الحالية يدويًا.

## ٦) القرار التنفيذي

**لا يتم دمج MG Ads في هذه النسخة.** هذا قرار توافق تقني وسياسات، وليس نقصًا في الكود:

- المنتج الحالي **Win32/WebView2 hosted PWA**.
- MG Ads له **UWP SDK** (NuGet `UAP 10.0`، C#/XAML)، و**C++ SDK** يحتاج مضيف Win32، و**H5 SDK**
  مرتبط بمنصة H5 Store الخاصة به.
- لا يوجد في هذه الحزمة مضيف أصلي نملكه، ولا واجهة H5/JS موثّقة ومتحقق منها، ولا مفاتيح MG.
- لذلك لا يوجد Banner Ad، ولا معرّفات MG، ولا قياس محلي، ولا ادعاء تشغيل.

</div>

## English short version

MG Ads is a family, not a single API:

- **MG Ads SDK for UWP** — official current product, NuGet `MiracleGames.Sdk.Uwp` targeting `UAP 10.0`,
  C#/XAML API (`ApplicationManager.SetupAsync`, `AdvertisingManager.ShowAd(..., AdType.Banner, ...)`).
- **C++ SDK (Win32)** — documented at `V1.2.6.6` (2024-12-30) with banner/interstitial/etc. APIs; it needs a
  native C++/Win32 host process.
- **H5 SDK** — for MG's own "H5 Microsoft Store" channel; its documentation page currently fails to load,
  and the download link on MG's Advertising SDK page points back to the UWP SDK page.

NEXORA AI is a **PWABuilder hosted PWA MSIX** (Win32/WebView2, `StartPage`), not a UWP app, not a native
C++/Win32 app, and not an MG-hosted H5 Store game. This repository does not own the generated PWABuilder
host source, and there is no native bridge for `MiracleGames.*`. WebView2 inside the MG SDK is an internal
browser for MG's own login/payment/ad pages; it is not a JavaScript API for third-party web content.

Therefore an MG Ads banner **cannot** be integrated into the current package without a separate native host
(UWP/WinUI or Win32) and real MG credentials, or a written MG confirmation plus documentation that the H5
SDK works in a WebView2-hosted PWA. Both are separate projects that require Windows tooling, Windows 10/11
testing, privacy updates and Store revalidation. The shipped package keeps advertising disabled and makes
no claim that a banner works.

## Sources

- <https://www.mguwp.com/MGAds> — "MG Ads SDK for UWP", ad formats.
- <https://doc.mguwp.net/en/uwpsdkupdate.html> — "Miracle Games UWP SDK", 2.8.7.0 (2026-01-08), Windows SDK/VS requirements.
- <https://www.nuget.org/packages/MiracleGames.Sdk.Uwp> — target framework `UAP 10.0`.
- <https://github.com/MiracleGames/MiracleGamesUWPSDK> — C# initialization and banner API.
- <https://doc.mguwp.net/c_sdk_update.html> — "Miracle Games C++ SDK", V1.2.6.6 (2024-12-30), native ad APIs.
- <https://www.mguwp.net/en/adcenter/receive.html> — Native/Win32/H5 SDK entries; H5 link resolves to the UWP page.
- <https://doc.mguwp.net/en/> — SDK index listing UWP, Win32, Html5 UWP and Html5 SDK docs.
- <https://doc.mguwp.net/en/develop.html> — H5 SDK is described for "h5 Microsoft store" versions.
- <https://www.pwabuilder.com/> — PWABuilder Windows packaging for PWAs.
