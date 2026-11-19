# حالة بناء الحزمة والتوقيع — Windows Edition 4.4.0

**التاريخ:** 19 نوفمبر 2026
**الهوية:** `Ahmedbecetti.NEXORAAIbyBECETTI` · `CN=A5D5DC31-4A15-4059-8030-D96C51054596`
**Publisher Display Name:** `Ahmedbecetti` · **Product ID:** `9ND09PBRDPKZ` (Draft)

## الخلاصة

لا توجد حاليًا **حزمة MSIX موقّعة قابلة للرفع**، ولم يتم إنشاء رابط تحميل لحزمة غير موجودة.
بيئة العمل الحالية Linux، ولا تحتوي:

- Windows SDK (`makeappx.exe` / `signtool.exe`)؛
- شهادة توقيع (`.pfx`) أو كلمة مرورها؛
- أداة PWABuilder التي تولّد مضيف WebView2 (`pwa_builder.exe`).

هذه ليست مشكلة في الهوية: قيم Partner Center مثبّتة ومتحققة في
`windows/package-identity.json` و`AppxManifest.reference.xml` و`pwabuilder-options.json`،
و`npm run windows:check` يخرج 0 مع تحذير واحد فقط: رابط المتجر بانتظار النشر.

## مهم: المتجر لا يحتاج توقيعك

Microsoft Store **يعيد توقيع حزم MSIX/AppX** بعد اجتياز الاعتماد. لا تحتاج شهادة CA ولا
`.pfx` لرفع الحزمة إلى Partner Center. توقيع الحزمة محليًا مطلوب فقط للتثبيت الجانبي
(sideload) على جهاز Windows للاختبار. لذلك «التوقيع قبل الرفع» ليس خطوة مطلوبة للمتجر،
وتوقيع الحزمة بشهادة اختبار ذاتية قد يسبب تعارض Publisher.

## محاولة التوليد عبر PWABuilder

تم إرسال طلب رسمي إلى خدمة PWABuilder لتوليد حزمة Windows بالهوية الحقيقية ومانيفست الموقع.
الطلب وصل إلى الخدمة، لكنها أعادت `500` لأن خدمة توليد صور Windows التابعة لها أعادت
`503 Service Unavailable`:

```text
System.Net.Http.HttpRequestException: Response status code does not indicate success: 503 (Service Unavailable).
   at PWABuilder.MicrosoftStore.ImageGenerator.CreateWindows11ImagesZip(...)
```

لم تُنشأ حزمة، ولم يتم استخدام أي حزمة بديلة أو ملف مزيّف. يمكن إعادة المحاولة لاحقًا عندما
تعود خدمة PWABuilder، أو توليد الحزمة من واجهة PWABuilder على Windows.

## ما المطلوب للحصول على حزمة حقيقية

### المسار الموصى به — PWABuilder ثم الرفع

1. افتح `https://www.pwabuilder.com/` على جهاز Windows وأدخل:
   `https://nexora-social-2026.vercel.app/`
2. اختر **Package for stores → Windows**، وأدخل:
   - Package ID: `Ahmedbecetti.NEXORAAIbyBECETTI`
   - Publisher ID: `CN=A5D5DC31-4A15-4059-8030-D96C51054596`
   - Publisher display name: `Ahmedbecetti`
   - App name: `NEXORA AI`
   - Version: `4.4.0.0`
3. نزّل الحزمة. ستحتوي عادة على `.msixbundle` و`.sideload.msix` و`install.ps1`.
4. ارفع `.msixbundle` (أو `.msixupload` إن أنتجته الأداة) إلى Partner Center.
   **لا توقّع نسخة المتجر محليًا**؛ Microsoft سيعيد توقيعها.

### للاختبار المحلي فقط — شهادة اختبار

يجب أن يكون `Subject` للشهادة مطابقًا لقيمة `Publisher` من Partner Center:

```powershell
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=A5D5DC31-4A15-4059-8030-D96C51054596" `
  -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 `
  -CertStoreLocation Cert:\CurrentUser\My
```

ثم وقّع الحزمة للاختبار:

```powershell
signtool sign /fd SHA256 /f .\certs\nexora-test.pfx /p "<PASSWORD>" `
  /tr http://timestamp.digicert.com /td SHA256 .\NEXORA.msixbundle
```

لا ترفع الحزمة الموقّعة بشهادة الاختبار إلى المتجر. استخدم نسخة غير موقّعة أو النسخة التي
يولّدها PWABuilder للمتجر.

## ما يمكنني فعله عند توفير الحزمة

إذا رفعت الحزمة الناتجة (`.msixbundle` أو `.msixupload`) إلى مساحة العمل، يمكنني:

- فحص `AppxManifest.xml` ومطابقة الهوية والأصول و`StartPage`؛
- كشف أي Product ID أو رابط متجر مخترع؛
- التحقق من أن الإعلانات ما زالت معطّلة؛
- إعداد خطوات الرفع والمراجعة.

أما التوقيع نفسه فيحتاج Windows وشهادة، ولا يمكن تنفيذه في هذه البيئة.
