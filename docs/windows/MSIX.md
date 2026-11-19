# MSIX packaging and Microsoft Store submission — NEXORA AI

<div dir="rtl">

## ١) الطريقة المعتمدة

نسخة Windows تُبنى كـ **PWA داخل حزمة MSIX** باستخدام [PWABuilder](https://www.pwabuilder.com/).
هذا هو المسار الذي تدعمه Microsoft لتطبيقات الويب: الحزمة تستضيف التطبيق عبر Edge WebView2 (Hosted App Model)
وتحتفظ بالحساب والخدمات الإنتاجية كما هي.

> **لا تُعِد بناء المنصة كتطبيق UWP أصلي.** ذلك يكلّف إعادة كتابة كاملة، ويستخدم نموذج EdgeHTML/WWAHost
> الذي أوقفت Microsoft تطويره. كما أن MG Ads SDK مخصّص لـ UWP ولا يمكن ربطه بحزمة Win32/WebView2 (انظر
> [`ADS-INTEGRATION.md`](ADS-INTEGRATION.md)).

## ٢) إنشاء المنتج في Partner Center (مرة واحدة)

1. ادخل إلى [Partner Center](https://partner.microsoft.com/dashboard) بحساب المطوّر.
2. **Apps and games → New product → MSIX or PWA app**، واحجز الاسم **NEXORA AI**.
3. من صفحة **Product identity** انسخ:
   - **Package/Identity/Name** (مثال الشكل: `Publisher.AppName`).
   - **Package/Identity/Publisher** (يبدأ بـ `CN=`).
   - **Publisher display name** — يجب أن يكون **BECETTI**.
   - **Package family name** يظهر بعد أول رفع/تثبيت؛ **لا تخترعه**.
4. **Product ID** (مثل `9N…`) يُنشأ للمنتج في Partner Center. اتركه فارغًا في المستودع حتى تحصل عليه.
   السكربتات تقبل المعرّف الحقيقي بعد إضافته، وترفض أي قيمة لا تطابق صيغة Store.

> القيم الحالية في `windows/package-identity.json` و`windows/msix/AppxManifest.reference.xml` هي
> **Placeholders صريحة** (`REPLACE-WITH-PARTNER-CENTER-…`) وليست هوية صالحة. هذا مقصود.

## ٣) تحديث الهوية والإصدار

بعد الحصول على القيم:

```bash
# 1) املأ windows/package-identity.json بالقيم الحقيقية
#    identityName, publisher, productId (بعد إنشائه), packageFamilyName (بعد ظهوره)
# 2) زامن إصدار MSIX الرباعي مع package.json
node windows/tools/sync-version.mjs        # 4.4.0 → 4.4.0.0
node windows/tools/sync-version.mjs --check
# 3) افحص
node windows/tools/check-windows.mjs
```

- إصدار الحزمة **أربعة أجزاء** وينتهي بـ `.0` عند البناء: `4.4.0.0`.
- كل إرسال جديد إلى المتجر يتطلب رقمًا أكبر من السابق. لا تعد استخدام نفس الرقم.
- غيّر `displayName` فقط إذا وافقت Microsoft على تغيير اسم المنتج.

## ٤) بناء حزمة PWA في PWABuilder

1. افتح `https://www.pwabuilder.com/` وأدخل:
   `https://nexora-social-2026.vercel.app/`
2. تحقق من تقرير الجاهزية: Manifest ✅ · Service Worker ✅ · HTTPS ✅.
3. **Package for stores → Windows**، ثم املأ:
   | الحقل | القيمة |
   |---|---|
   | Package ID | من Partner Center |
   | Publisher ID | `CN=…` من Partner Center |
   | Publisher display name | `BECETTI` |
   | App name | `NEXORA AI` |
   | Version | `4.4.0.0` |
   | Display mode | `Standalone` (وWindow Controls Overlay يبقى من المانيفست) |
   | Capabilities | `internetClient` فقط إن سُئلت |
   | Architectures | x64 + arm64 (حزمة Store) |
   | Signing | حزمة اختبار بلا توقيع/شهادة اختبار، ثم وقّع للاختبار المحلي |
4. نزّل الحزمة. الناتج عادة `.msix` للاختبار و`.msixbundle` للمتجر.
5. إن كان الناتج `.msix` وتريد تطبيق الهوية بنفسك:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Update-MsixIdentity.ps1 `
  -SourceMsix .\NEXORA.msix `
  -OutputMsix .\dist\NEXORA-AI-Windows.msix `
  -CertificatePath .\certs\nexora-store.pfx `
  -RequireSignature
```

> **مهم:** لا تعِد تسمية `.msix` إلى `.msixupload` أو العكس. ارفع النوع الذي يطلبه Partner Center.
> لو أنتج PWABuilder حزمة `.msixbundle`، أدخل الهوية داخل PWABuilder قبل التوليد بدل ترقيع الحزمة.

## ٥) الأصول

كل أصول MSIX موجودة في `windows/msix/Assets` (53 ملفًا)، وتشمل:

- `StoreLogo.png` (50×50)
- `Square44x44Logo.png` + مقاييس 100/125/150/200/400 + targetsize 16/24/32/48/256
- `Square44x44Logo.altform-unplated_*` و`altform-lightunplated_*` (شعار دائري شفاف لشريط المهام)
- `Square71x71Logo` · `Square150x150Logo` · `Square310x310Logo` بمقاييسها
- `Wide310x150Logo` بمقاييسه
- `SplashScreen.png` (620×300) + مقاييس 100/125/150/200/400
- `LockScreenLogo.scale-200.png`

لتوليدها من جديد بعد تغيير الأيقونة الرسمية:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\New-MsixAssets.ps1 `
  -Source .\public\icon-1024.png -OutDir .\windows\msix\Assets
```

أو على Linux/macOS باستخدام ImageMagick:

```bash
bash windows/tools/generate-assets.sh
```

## ٦) التوقيع والاختبار المحلي

### شهادة اختبار (جهازك فقط)

```powershell
# 1) أنشئ شهادة اختبار ذاتيًا (مرة واحدة)
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=BECETTI" `
  -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 `
  -CertStoreLocation Cert:\CurrentUser\My
$pwd = ConvertTo-SecureString -String "CHOOSE-A-STRONG-PASSWORD" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath .\certs\nexora-test.pfx -Password $pwd
Export-Certificate -Cert $cert -FilePath .\certs\nexora-test.cer

# 2) ثق بالشهادة محليًا (Trusted People) — لا تفعل هذا على جهاز إنتاج
Import-Certificate -FilePath .\certs\nexora-test.cer `
  -CertStoreLocation Cert:\LocalMachine\TrustedPeople

# 3) ثبّت الحزمة
Add-AppxPackage -Path .\dist\NEXORA-AI-Windows.msix
```

### شهادة الإنتاج

- تصدر من Partner Center ضمن **Package signing** أو من جهة إصدار معتمدة.
- ضعها خارج المستودع (`certs/` مستبعدة ضمنا لأن `*.pfx`/`*.p12` في `.gitignore`).
- مرّر كلمة المرور عبر `SecureString` أو متغير CI سري، لا في سطر أوامر مكشوف.

### توقيع يدوي

```powershell
& "$env:ProgramFiles(x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign `
  /fd SHA256 /f .\certs\nexora-store.pfx /tr http://timestamp.digicert.com /td SHA256 `
  .\dist\NEXORA-AI-Windows.msix
```

## ٧) فحص الحزمة قبل الرفع

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Test-MsixPackage.ps1 `
  -MsixPath .\dist\NEXORA-AI-Windows.msix
```

يتحقق من:

- وجود `AppxManifest.xml` والهوية والإصدار الرباعي.
- أن `DisplayName = NEXORA AI` و`PublisherDisplayName = BECETTI`.
- أن `StartPage` يبدأ بـ HTTPS ويحتوي `?nx_surface=msix` (ضروري لتطبيق قواعد الإعلانات الخاصة بالحزمة).
- وجود `internetClient` وأصول الشعارات.
- عدم وجود أي أثر لمفاتيح/أسرار خادم في ملفات الحزمة.

## ٨) الرفع إلى Microsoft Store

1. في Partner Center: **Submissions → New submission**.
2. **Packages**: ارفع النوع المطلوب. إن رفض Partner Center سببًا، اقرأ الرسالة حرفيًا ولا تغيّر الامتداد يدويًا.
3. **Store listing**: استخدم النصوص من [`STORE-LISTING.md`](STORE-LISTING.md)، ولقطات شاشة حقيقية من [`SCREENSHOTS.md`](SCREENSHOTS.md).
4. **Properties**: الفئة Productivity، متطلبات Windows 10 2004+، الإعلان عن استخدام الذكاء الاصطناعي عند ظهور الخيار.
5. **Privacy**: `https://nexora-social-2026.vercel.app/windows/privacy.html`
6. **Support**: `https://nexora-social-2026.vercel.app/windows/#support` + `ahmedbecetti35@gmail.com`
7. **Notes for certification**: اذكر أن التطبيق يحتاج حسابًا، وأنه يستخدم خادمًا إنتاجيًا، وأن الإعلانات معطّلة، وأن تاريخ الاختبار غير مطلوب.
8. **Product ID / Package family name**: انسخهما بعد ظهورهما إلى `windows/package-identity.json` و`storeUrl` بعد النشر.
9. أرسل. مدة الاعتماد عادة أيام قليلة، وقد يطلب المُراجع معلومات إضافية.

## ٩) أخطاء شائعة وحلولها

| الخطأ | السبب | الحل |
|---|---|---|
| `0x800B0109` | الشهادة غير موثوقة | ثبّت الشهادة في Trusted People (للاختبار) أو استخدم شهادة الإنتاج |
| `0x80073CF3` / `0x80073CFB` | عدم تطابق الهوية أو حزمة موجودة | أزل الحزمة القديمة، وتأكد من Identity/Publisher مطابقين |
| `0x80073CF9` | تثبيت فاشل/مساحة/صلاحيات | راجع الأحداث، وأعد تثبيت WebView2 Runtime |
| اسم التطبيق قديم بعد التغيير | `resources.pri` لم يُحدَّث | أدخل الاسم في PWABuilder وأعد التوليد بدل ترقيع المانيفست |
| صفحة بيضاء | فشل تحميل الموقع/شبكة | تحقق من الاتصال، واختبر الرابط في Edge |
| الإعلانات لا تظهر | متوقّع | الإعدادات معطّلة افتراضيًا حتى التحقق — راجع `ADS-INTEGRATION.md` |

## ١٠) التحديث وإزالة التثبيت

- **التحديث:** كل نشر جديد للموقع يصل تلقائيًا لأن الحزمة تستضيف الموقع. لا حاجة لإصدار MSIX جديد إلا لتغيير الهوية/الأيقونة/الصلاحيات/الإصدار في المتجر.
- التحديثات الأمامية تُدار عبر `version.json` + خدمة العمل (شريط «تحديث جاهز»).
- **إزالة التثبيت:** Settings → Apps → NEXORA AI → Uninstall. تبقى بيانات الحساب على الخادم؛ حذفها يتم من داخل التطبيق.
- **PWA:** إزالة التطبيق من Edge لا تمسح بالضرورة بيانات الموقع؛ امسح بيانات الموقع من إعدادات Edge إن أردت.

</div>

## English checklist

1. Reserve **NEXORA AI** in Partner Center (MSIX or PWA app), copy Identity Name and Publisher `CN=…`.
2. Fill `windows/package-identity.json`; run `node windows/tools/sync-version.mjs`; run `check-windows.mjs`.
3. Generate the Windows package with PWABuilder using the exact identity, version `4.4.0.0`, x64 + arm64.
4. Sign a `.msix` for local testing; for Store upload follow Partner Center’s requested package type and signing flow.
5. Run `Test-MsixPackage.ps1`; install on a clean Windows 10/11 VM and complete the manual test report.
6. Submit with the listing copy, real screenshots, privacy URL, support URL and certification notes.
7. Copy the real Product ID and package family name back into `package-identity.json` after they exist.
