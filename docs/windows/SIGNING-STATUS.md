# حالة بناء الحزمة والتوقيع — NEXORA AI by BECETTI · Windows Edition 4.4.0

**Display Name:** `NEXORA AI by BECETTI` (الاسم المحجوز في Partner Center)
**الهوية:** `Ahmedbecetti.NEXORAAIbyBECETTI` · `CN=A5D5DC31-4A15-4059-8030-D96C51054596`
**Publisher Display Name:** `Ahmedbecetti` · **Product ID:** `9ND09PBRDPKZ` (Draft)
**الإصدار:** `4.4.0.0` · **نوع الحزمة:** Hosted App Model (Edge Stable، `HostId=PWA`)

## الخلاصة: الحزمة موجودة وقابلة للتنزيل

تم بناء الحزمة فعليًا على **Windows Server 2025 + Windows SDK** داخل GitHub Actions،
وليست ملفًا وصفيًا ولا نموذجًا وهميًا. الناتج منشور كأصول Release عامة:

**صفحة التحميل:**
<https://github.com/Ahmedbecett/nexora-social-2026/releases/tag/windows-v4.4.0.0>

**الملف الذي ترفعه إلى Partner Center:**
<https://github.com/Ahmedbecett/nexora-social-2026/releases/download/windows-v4.4.0.0/NEXORA-AI_4.4.0.0_neutral.msixupload>

| الملف | الحجم | الاستخدام |
|---|---:|---|
| `NEXORA-AI_4.4.0.0_neutral.msixupload` | 10,454,721 بايت | **ارفعه إلى Partner Center** (غير موقّع عمدًا) |
| `NEXORA-AI_4.4.0.0_neutral.msixbundle` | 10,553,527 بايت | فحص/بديل إن طلب Partner Center صيغة الحزمة |
| `NEXORA-AI_4.4.0.0_neutral.msix` | 10,551,743 بايت | فحص/بديل لصيغة أحادية |
| `NEXORA-AI_4.4.0.0_neutral.test-signed.msix` | 10,556,153 بايت | **اختبار محلي فقط**، ليس للمتجر |
| `NEXORA-AI-test-certificate.cer` | 818 بايت | شهادة الاختبار العامة (بلا مفتاح خاص) |
| `SHA256SUMS.txt` / `BUILD-INFO.txt` | — | البصمات وتفاصيل البناء |

SHA-256 للحزمة المرفوعة في هذا البناء (من بيانات أصل Release على GitHub):

```text
c2adc350fc21805e0d1a8892873e8b48ca5ad0ab57726630afac6fb58039a88d  NEXORA-AI_4.4.0.0_neutral.msixupload
```

> هذا البناء أُعيد في Run `44654597475` بعد تغيير الاسم. نجح
> `Test-MsixPackage.ps1` الإلزامي داخل البناء، وهو يطابق
> `Package/Properties/DisplayName` و`uap:VisualElements DisplayName` مع
> `NEXORA AI by BECETTI`، ويطابق `Identity Name` و`Publisher` مع القيم الحالية.

## مهم: المتجر لا يحتاج توقيعك

Microsoft Store **يعيد توقيع حزم MSIX/AppX** أثناء الاعتماد. لذلك ملف
`.msixupload` أعلاه **غير موقّع**. لا ترفع `test-signed.msix` ولا الشهادة إلى
Partner Center؛ تلك النسخة للاختبار المحلي فقط.

التوقيع الذاتي الموجود في Release يثبت أن الحزمة يمكن توقيعها، لكن سلسلتها
غير موثوقة على أي جهاز آخر إلا بعد تثبيت `NEXORA-AI-test-certificate.cer`
في `Trusted People`. لا تستخدمها للنشر.

## ما تم التحقق منه فعليًا

- البناء نجح على Windows SDK: `makepri createconfig` + `makepri new` +
  `makeappx pack` + `makeappx bundle`.
- `Test-MsixPackage.ps1` قرأ الحزمة وطابق:
  - `Name = Ahmedbecetti.NEXORAAIbyBECETTI`
  - `Publisher = CN=A5D5DC31-4A15-4059-8030-D96C51054596`
  - `Version = 4.4.0.0` · `DisplayName = NEXORA AI by BECETTI` (Properties وVisualElements) · `PublisherDisplayName = Ahmedbecetti`
  - `HostId = PWA`، و`--app-id=pkojfojlpmhfnldcmaemlmpbkcdmihle`
  - `--app-fallback-url=https://nexora-social-2026.vercel.app/?nx_surface=msix`
  - الأصول الـ53 و`resources.pri` موجودة، والإعلانات ما زالت معطّلة.
- فُكّ `.msixupload` وتحقّق التسلسل: يحتوي `.msixbundle` → بداخله `.msix` →
  بداخله `AppxManifest.xml` و`AppxBlockMap.xml` و`[Content_Types].xml` و`resources.pri`،
  وبلا `AppxSignature.p7x` (نسخة المتجر غير موقّعة).
- `signtool` وقّع نسخة الاختبار وطابق Publisher. `signtool verify` أبلغ أن
  السلسلة الذاتية غير موثوقة — متوقع، ولهذا لا تُرفع نسخة الاختبار للمتجر.

**ما لم يتم:** لم نثبّت الحزمة على جهاز Windows فعلي، ولم نرسلها إلى Partner Center،
ولم تُنشر في المتجر. هذه خطوات تحتاج جهازك/حسابك، ولا يمكن ادّعاء نجاحها من هنا.
الحزمة بنيوية وصالحة للرفع، لكن اعتماد المتجر يبقى قرار Microsoft.

## طريقة الرفع إلى Partner Center

1. نزّل `NEXORA-AI_4.4.0.0_neutral.msixupload` من الرابط أعلاه.
2. افتح Partner Center → تطبيق **NEXORA AI by BECETTI** (Product ID `9ND09PBRDPKZ`) →
   **Submissions → New submission**.
3. في **Packages** ارفع ملف `.msixupload`. لا تغيّر امتداده ولا تفتحه/تعيد ضغطه.
4. أكمل **Store listing** و**Properties** و**Privacy** و**Support** من
   [`STORE-LISTING.md`](STORE-LISTING.md)، ثم أرسل للاعتماد.
5. إذا طلب المُراجع توضيحًا لصلاحية `runFullTrust`: الحزمة hosted PWA تعتمد على
   Edge Stable كمضيف (وفق Hosted App Model من Microsoft)، والتطبيق لا يثبّت
   برامج أخرى ولا يقرأ ملفات المستخدم.
6. `storeUrl` في `windows/package-identity.json` يبقى فارغًا حتى ظهور صفحة المتجر.
   لا تضع رابطًا قبل النشر.

## الاختبار المحلي (اختياري)

```powershell
# 1) ثق بشهادة الاختبار العامة (مرة واحدة، على جهاز اختبار فقط)
#    الشهادة ذاتية التوقيع، فهي جذر نفسها: TrustedPeople وحدها لا تكفي.
Import-Certificate -FilePath .\NEXORA-AI-test-certificate.cer `
  -CertStoreLocation Cert:\CurrentUser\TrustedPeople
Import-Certificate -FilePath .\NEXORA-AI-test-certificate.cer `
  -CertStoreLocation Cert:\CurrentUser\Root

# 2) ثبّت نسخة الاختبار الموقّعة
Add-AppxPackage -Path .\NEXORA-AI_4.4.0.0_neutral.test-signed.msix
```

إذا رفض Windows بسبب `0x800B0109`، فالجذر لم يُثبّت في `CurrentUser\Root`؛ أعد الخطوة 1.
وإذا رفض الحزمة بسبب عدم وجود Edge Stable، ثبّت Edge ثم أعد المحاولة.

## إعادة البناء

- سكربت البناء: `windows/scripts/Build-Msix.ps1`
- سير العمل: `.github/workflows/windows-store-package.yml`
  (يعمل عند تغيير ملفات `windows/**` أو مانيفست الموقع، ويمكن تشغيله يدويًا من Actions).
- الهوية والنسخة: `windows/package-identity.json` + `windows/msix/AppxManifest.reference.xml`.
- لا تُضف `.pfx` أو كلمة مرور إلى المستودع؛ الشهادة المؤقتة تُنشأ وتُحذف داخل runner.

## لماذا لا نستخدم PWABuilder الآن

محاولات PWABuilder السابقة فشلت من جهتهم: خدمة الصور أعادت `503` ومانيفست
finder أعاد `500`. لم نعد نعتمد عليها في البناء؛ الحزمة تُبنى محليًا على Windows
باستخدام Windows SDK، والمسار موثق في `Build-Msix.ps1`.
