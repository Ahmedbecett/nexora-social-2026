# MSIX packaging and Microsoft Store submission — NEXORA AI by BECETTI

<div dir="rtl">

## ١) الطريقة المعتمدة

نسخة Windows تُبنى كـ **PWA داخل حزمة MSIX** بنموذج **Hosted App Model** الذي تدعمه Microsoft:
الحزمة لا تحتوي executable، بل تعتمد على Edge Stable كمضيف (`HostId=PWA`) وتستضيف الموقع
داخل نافذة أصلية. تُبنى الحزمة على Windows SDK عبر
[`Build-Msix.ps1`](../../windows/scripts/Build-Msix.ps1) في GitHub Actions، **دون** الاعتماد
على خدمة PWABuilder التي كانت تعيد 500/503.

> **لا تُعِد بناء المنصة كتطبيق UWP أصلي في هذه النسخة.** ذلك يكلّف إعادة كتابة كاملة ويغيّر نموذج
> الحزمة. صحيح أن UWP/WinUI يستطيع استضافة WebView2، لكن MG Ads UWP SDK لا يمكن ربطه بحزمة
> Win32/WebView2 الحالية، ونسختا C++/H5 تحتاجان مضيفًا أصليًا أو توثيقًا متحققًا منه (انظر
> [`MG-ADS-FEASIBILITY.md`](MG-ADS-FEASIBILITY.md)).

## ٢) هوية المنتج من Partner Center (مثبّتة)

المنتج محجوز في Partner Center كـ **Draft**، ولم يُنشر بعد. القيم التالية هي القيم الحقيقية
التي أدخلها المالك، وهي منسوخة في `windows/package-identity.json` و`AppxManifest.reference.xml`
وفي [`STORE-LISTING.md`](STORE-LISTING.md):

| الحقل | القيمة |
|---|---|
| Package/Properties/DisplayName | `NEXORA AI by BECETTI` (الاسم المحجوز حرفيًا) |
| Package/Identity/Name | `Ahmedbecetti.NEXORAAIbyBECETTI` |
| Package/Identity/Publisher | `CN=A5D5DC31-4A15-4059-8030-D96C51054596` |
| Publisher display name | `Ahmedbecetti` |
| Package family name | `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm` |
| Product ID | `9ND09PBRDPKZ` |
| Store listing status | **Draft — not published** |
| Store URL | يُضاف بعد الاعتماد والنشر |

> **لا تغيّر هذه القيم يدويًا.** أي تحديث يجب أن يُنسخ من Partner Center. وجود Product ID
> لا يعني أن المنتج منشور؛ صفحة المتجر قد لا تعمل قبل اجتياز الاعتماد.
> `Product ID` لا يوضع داخل `AppxManifest.xml` — هو معرّف المتجر لا معرّف الحزمة.

## ٣) التحقق من الهوية والإصدار

```bash
# 1) زامن إصدار MSIX الرباعي مع package.json
node windows/tools/sync-version.mjs        # 4.4.1 → 4.4.1.0
node windows/tools/sync-version.mjs --check
# 2) افحص الهوية والمانيفست والأصول والإعلانات وSW
node windows/tools/check-windows.mjs       # أو npm run windows:check
```

- إصدار الحزمة **أربعة أجزاء** وينتهي بـ `.0` عند البناء: `4.4.1.0`.
- `displayName` هو الاسم المحجوز في Partner Center: **`NEXORA AI by BECETTI`**. لا تغيّره إلا باسم جديد محجوز؛
  ويجب أن يطابق `Package/Properties/DisplayName` و`uap:VisualElements DisplayName` حرفيًا.
- الإصدار الحالي المخصص للنشر هو `4.4.1.0` (مشتق من `package.json 4.4.1`). لا تُعد استخدام رقم
  سبق أن قبله Partner Center: كل إرسال جديد يحتاج رقمًا أكبر (مثل `4.4.2.0`).
- الصلاحيات مثبّتة بسياسة مُتحقَّق منها: `internetClient` + `runFullTrust` فقط. `runFullTrust`
  مطلوبة فعليًا لنموذج Hosted App Model ومبرَّرة في [`RUNFULLTRUST-REVIEW.md`](RUNFULLTRUST-REVIEW.md)؛
  أي صلاحية مقيّدة أخرى تفشل البناء.
- `check-windows` يجب أن يخرج 0؛ التحذير الوحيد المسموح حاليًا هو أن **رابط المتجر بانتظار النشر**.

## ٤) بناء الحزمة على Windows أو في GitHub Actions

**المسار المعتمد:** شغّل سير العمل
[`windows-store-package.yml`](../../.github/workflows/windows-store-package.yml)
من تبويب Actions، أو على جهاز Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Build-Msix.ps1 `
  -OutputDirectory .\dist\windows
```

السكربت:

1. يتحقق من الهوية والإصدار و`--app-id` المشتق من Manifest ID؛
2. ينسخ `AppxManifest.reference.xml` والأصول الـ53؛
3. يولّد `resources.pri` بـ `makepri`؛
4. يحزم `.msix` ثم `.msixbundle` بـ `makeappx`؛
5. يلفّ الـbundle في `.msixupload` (ZIP عادي) **غير موقّع** للمتجر، ملفًا بملف عبر
   `System.IO.Compression.ZipArchive`، ثم **يعيد فتح الناتج ويتحقق**: bundle واحد في الجذر
   بالضبط، ولا `p7x`/`pdb`/`cer`/`zip`/`msixupload`، ولا مسارات متداخلة؛
6. ينشئ نسخة اختبار موقّعة ذاتيًا في ملف منفصل، ويحذف الشهادة الخاصة من runner.

الناتج المتوقع:

| الملف | المعنى |
|---|---|
| `NEXORA-AI_4.4.1.0_neutral.msixupload` | ارفعه إلى Partner Center (غير موقّع؛ المتجر يوقّعه) |
| `upload-verification.json` | تقرير فحص ملف الرفع (بنية + block map + هوية) |
| `NEXORA-AI_4.4.1.0_neutral.msixbundle` | فحص/بديل |
| `NEXORA-AI_4.4.1.0_neutral.msix` | فحص/بديل |
| `NEXORA-AI_4.4.1.0_neutral.test-signed.msix` | اختبار محلي فقط |
| `NEXORA-AI-test-certificate.cer` | شهادة الاختبار العامة |

> **مهم:** ملف المتجر غير موقّع عمدًا؛ Microsoft Store يعيد توقيعه. لا ترفع نسخة
> الاختبار ولا شهادتها. لا تعِد تسمية `.msix` إلى `.msixupload` أو العكس.

رابط الأصول الحالية:
<https://github.com/Ahmedbecett/nexora-social-2026/releases/tag/windows-v4.4.1.0>

`Update-MsixIdentity.ps1` يبقى أداة مساعدة لحزمة موجودة، ويدعم الآن الحزم
المضيفة عبر تعديل `--app-fallback-url` بدل إضافة `StartPage` غير صالح.

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

### قاعدة المتجر

لا توقّع `.msixupload` قبل الرفع. Microsoft Store يوقّع الحزمة أثناء الاعتماد.
التوقيع المحلي مطلوب فقط إذا أردت تثبيت الحزمة على جهازك خارج المتجر.

### شهادة اختبار (جهازك فقط)

> `Subject` هنا هو **نفس** `Package/Identity/Publisher` من Partner Center، وليس اسم العرض.
> شهادة `CN=Ahmedbecetti` لن تطابق الحزمة وستفشل في `Add-AppxPackage`.

```powershell
# 1) أنشئ شهادة اختبار ذاتيًا (مرة واحدة)
# يجب أن يطابق Subject قيمة Publisher الحقيقية، وإلا رفض Windows التثبيت.
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=A5D5DC31-4A15-4059-8030-D96C51054596" `
  -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 `
  -CertStoreLocation Cert:\CurrentUser\My
$pwd = ConvertTo-SecureString -String "CHOOSE-A-STRONG-PASSWORD" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath .\certs\nexora-test.pfx -Password $pwd
Export-Certificate -Cert $cert -FilePath .\certs\nexora-test.cer

# 2) ثق بالشهادة محليًا — لا تفعل هذا على جهاز إنتاج
#    الشهادة ذاتية التوقيع، فيجب تثبيت جذرها أيضًا وإلا فشل التثبيت بـ 0x800B0109.
Import-Certificate -FilePath .\certs\nexora-test.cer `
  -CertStoreLocation Cert:\CurrentUser\TrustedPeople
Import-Certificate -FilePath .\certs\nexora-test.cer `
  -CertStoreLocation Cert:\CurrentUser\Root

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

## ٦ب) اختبار التثبيت الحقيقي (Add-AppxPackage)

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Test-MsixInstall.ps1 `
  -MsixPath .\dist\windows\NEXORA-AI_4.4.1.0_neutral.test-signed.msix `
  -CertificatePath .\dist\windows\NEXORA-AI-test-certificate.cer `
  -OutputJson .\dist\windows\install-test.json
```

يفعل فعليًا: يثبّت الحزمة بـ `Add-AppxPackage`، يقرأ الحزمة المسجّلة (`Get-AppxPackage`) ويطابق
Name وPublisher والإصدار وPFN، يقرأ الصلاحيات من مانيفست الحزمة المثبّتة، يتحقق من ظهور التطبيق في
Start (`Get-StartApps`) ومن إدخال التشغيل `PFN!App`، يشغّل مضيف Edge عبر `explorer.exe shell:AppsFolder\…`،
يتحقق من وصول سطح الإنتاج، ثم يزيل الحزمة. الشهادة تُضاف إلى `TrustedPeople` فقط — إضافتها إلى
`Root` تفتح نافذة موافقة وتُعلّق أي runner بلا جلسة تفاعلية. إن ظهر `0x800B0109` أضف الشهادة إلى
«Trusted Root Certification Authorities» يدويًا على جهاز اختبار واحد. النتيجة JSON + جدول PASS/FAIL. بوابة CI:
`node windows/tools/assert-install-test.mjs <json> --allow-headless`.

## ٦ج) حزمة موقّعة للنشر المباشر (اختياري)

المتجر **لا** يحتاج توقيعك: يوقّع الحزمة أثناء الاعتماد، ولذلك يُرفع `.msixupload` غير الموقّع.
إن أردت توزيعًا مباشرًا أو مؤسسيًا (sideload/Intune)، وقّع الـbundle بشهادة كود حقيقية
موضوعها = `Package/Identity/Publisher`:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Sign-StorePackage.ps1 `
  -BundlePath .\dist\windows\NEXORA-AI_4.4.1.0_neutral.msixbundle `
  -CertificatePath .\certs\nexora-store.pfx -CertificatePassword (Read-Host -AsSecureString) `
  -OutputDirectory .\dist\windows\signed -WrapUpload
```

يرفض السكربت أي شهادة لا يطابق موضوعها Publisher، ويشترط سلسلة موثوقة (`-AllowUntrustedChain` للاختبار
المحلي فقط)، ويوقّع SHA-256 مع timestamp ويوثّق البصمة في `SIGNATURE-INFO.txt`.

## ٧) فحص الحزمة قبل الرفع

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Test-MsixPackage.ps1 `
  -MsixPath .\dist\NEXORA-AI-Windows.msix
```

يتحقق من:

- وجود `AppxManifest.xml` والهوية والإصدار الرباعي.
- أن `DisplayName = NEXORA AI by BECETTI` (في Properties وفي VisualElements) و`PublisherDisplayName = Ahmedbecetti`،
  وأن `Identity Name` و`Publisher` يطابقان Partner Center.
- أن الحزمة Hosted App Model: `HostId=PWA` و`Microsoft.MicrosoftEdge.Stable`،
  وأن `--app-fallback-url` يبدأ بـ HTTPS ويحتوي `?nx_surface=msix`،
  وأن `--app-id` مكوّن من 32 حرفًا بين a وp ومطابق للمشتق من Manifest ID.
- تطابق مجموعة الصلاحيات حرفيًا مع `package-identity.json` (`internetClient` + `runFullTrust`
  المبرَّرة)، ورفض أي صلاحية مقيّدة إضافية، وأصول الشعارات و`resources.pri`.
- أن `.msixupload` يحتوي bundle ثم msix ثم `AppxBlockMap.xml` و`[Content_Types].xml`،
  وأن نسخة المتجر بلا `AppxSignature.p7x`.
- `node windows/tools/verify-msix-upload.mjs <upload>`: قارئ ZIP/ZIP64 مستقل يتحقق من CRC32
  لكل عنصر، ومن شمول `AppxBlockMap.xml` لكل الملفات، ومن بصمات SHA-256 لكل كتلة (195 كتلة)،
  ومن تطابق الهوية والصلاحيات مع `package-identity.json`؛ يُشغَّل كبوابة في سير العمل.
- أدوات SDK على **ملف الرفع نفسه**: `makeappx unpack` للحزمة المستخرجة، `makepri dump` على
  `resources.pri` المستخرج، ثم `makeappx pack` لإعادة التحقق من المخطّط.
- `.appxsym` **غير مطلوب** لهذه الحزمة (Hosted App Model بلا كود مُصرَّف)؛ غيابه مسجّل كتحذير
  مبرَّر لا كخطأ، ولا يُصنَّع ملف رموز وهمي. التفصيل:
  [`PARTNER-CENTER-REVIEW.md`](PARTNER-CENTER-REVIEW.md).
- عدم وجود أي أثر لمفاتيح/أسرار خادم في ملفات الحزمة.

## ٨) الرفع إلى Microsoft Store

1. نزّل `NEXORA-AI_4.4.1.0_neutral.msixupload` من
   [Release Windows](https://github.com/Ahmedbecett/nexora-social-2026/releases/tag/windows-v4.4.1.0).
2. في Partner Center: **Submissions → New submission**.
3. **Packages**: ارفع `.msixupload` كما هو. إن رفض Partner Center سببًا، اقرأ الرسالة حرفيًا
   ولا تغيّر الامتداد يدويًا؛ يمكنك تجربة `.msixbundle` كبديل إن طُلب.
   ملف `.appxsym` **ليس مطلوبًا** ولا يُصنَّع: Microsoft تصرّح بأنه اختياري («You can omit this
   file…»)، وغيابه يعني فقط عدم توفّر تحليلات الأعطال.
4. **Store listing**: استخدم النصوص من [`STORE-LISTING.md`](STORE-LISTING.md)، ولقطات شاشة حقيقية من [`SCREENSHOTS.md`](SCREENSHOTS.md).
5. **Properties**: الفئة Productivity، متطلبات Windows 10 2004+، الإعلان عن استخدام الذكاء الاصطناعي عند ظهور الخيار.
6. **Privacy**: `https://nexora-social-2026.vercel.app/windows/privacy.html`
7. **Support**: `https://nexora-social-2026.vercel.app/windows/#support` + `ahmedbecetti35@gmail.com`
8. **Notes for certification**: اذكر أن التطبيق يحتاج حسابًا، وأنه يستخدم خادمًا إنتاجيًا، وأن الإعلانات معطّلة، وأن تاريخ الاختبار غير مطلوب.
9. **Product ID / Package family name**: مسجّلان بالفعل في `windows/package-identity.json`. أضف `storeUrl` فقط بعد نشر المنتج وظهور صفحته.
10. أرسل. مدة الاعتماد عادة أيام قليلة، وقد يطلب المُراجع معلومات إضافية.

## ٩) أخطاء شائعة وحلولها

| الخطأ | السبب | الحل |
|---|---|---|
| `0x800B0109` | الشهادة غير موثوقة | ثبّت شهادة الاختبار في `TrustedPeople` و`Root` (للاختبار)، أو استخدم حزمة المتجر غير الموقّعة |
| `0x80073CF3` / `0x80073CFB` | عدم تطابق الهوية أو حزمة موجودة | أزل الحزمة القديمة، وتأكد من Identity/Publisher مطابقين |
| `0x80073CF9` | تثبيت فاشل/مساحة/صلاحيات | راجع الأحداث، وأعد تثبيت WebView2 Runtime |
| اسم التطبيق قديم بعد التغيير | `resources.pri` لم يُحدَّث | أعد البناء بـ `Build-Msix.ps1` بدل ترقيع المانيفست |
| صفحة بيضاء | فشل تحميل الموقع/شبكة | تحقق من الاتصال، واختبر الرابط في Edge |
| الإعلانات لا تظهر | متوقّع | الإعدادات معطّلة افتراضيًا حتى التحقق — راجع `ADS-INTEGRATION.md` |

## ١٠) التحديث وإزالة التثبيت

- **التحديث:** كل نشر جديد للموقع يصل تلقائيًا لأن الحزمة تستضيف الموقع. لا حاجة لإصدار MSIX جديد إلا لتغيير الهوية/الأيقونة/الصلاحيات/الإصدار في المتجر.
- التحديثات الأمامية تُدار عبر `version.json` + خدمة العمل (شريط «تحديث جاهز»).
- **إزالة التثبيت:** Settings → Apps → NEXORA AI → Uninstall. تبقى بيانات الحساب على الخادم؛ حذفها يتم من داخل التطبيق.
- **PWA:** إزالة التطبيق من Edge لا تمسح بالضرورة بيانات الموقع؛ امسح بيانات الموقع من إعدادات Edge إن أردت.

</div>

## English checklist

1. Partner Center product **NEXORA AI by BECETTI** is a **draft** with the real identity recorded in `package-identity.json`.
2. Verify with `node windows/tools/sync-version.mjs --check` and `node windows/tools/check-windows.mjs`.
3. Build the Hosted App Model package with `windows/scripts/Build-Msix.ps1` (Windows SDK) or the GitHub Actions workflow.
4. Upload the **unsigned** `.msixupload`; Microsoft Store re-signs it. Use the test-signed `.msix` only for local sideload.
5. Run `Test-MsixPackage.ps1`; install the test-signed copy on a clean Windows 10/11 VM and complete the manual test report.
6. Submit with the listing copy, real screenshots, privacy URL, support URL and certification notes.
7. Add `storeUrl` only after publication; the Product ID and package family name are already recorded.
