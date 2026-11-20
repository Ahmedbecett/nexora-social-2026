# حالة بناء الحزمة والتوقيع — NEXORA AI by BECETTI · Windows Edition 4.4.1.0

**Display Name:** `NEXORA AI by BECETTI` (الاسم المحجوز في Partner Center)
**الهوية:** `Ahmedbecetti.NEXORAAIbyBECETTI` · `CN=A5D5DC31-4A15-4059-8030-D96C51054596`
**Publisher Display Name:** `Ahmedbecetti` · **Product ID:** `9ND09PBRDPKZ` (Draft)
**Package Family Name:** `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm`
**الإصدار:** `4.4.1.0` · **نوع الحزمة:** Hosted App Model (Edge Stable، `HostId=PWA`)

## الخلاصة

الحزمة مبنية فعليًا على Windows SDK داخل GitHub Actions، وتم **تثبيتها فعليًا** على Windows
عبر `Add-AppxPackage` وتشغيلها (Edge PWA Host) والتحقق من صلاحياتها وهُويتها ثم إزالتها.
البناء النهائي: Run [`44732511763`](https://github.com/Ahmedbecett/nexora-social-2026/actions/runs/44732511763)
— `18/18` فحص تثبيت ناجح، `0` فشل، مع تحقّق مستقل من ملف الرفع (`195` كتلة SHA-256) وأدوات SDK.

**صفحة التحميل:**
<https://github.com/Ahmedbecett/nexora-social-2026/releases/tag/windows-v4.4.1.0>

**الملف الذي ترفعه إلى Partner Center:**
<https://github.com/Ahmedbecett/nexora-social-2026/releases/download/windows-v4.4.1.0/NEXORA-AI_4.4.1.0_neutral.msixupload>

| الملف | الحجم | SHA-256 | الاستخدام |
|---|---:|---|---|
| `NEXORA-AI_4.4.1.0_neutral.msixupload` | 10,455,133 | `b060d1df…5f0a8` | **ارفعه إلى Partner Center** (غير موقّع عمدًا) |
| `NEXORA-AI_4.4.1.0_neutral.msixbundle` | 10,553,808 | `1a12d68e…2a6fca51` | bundle بديل/فحص |
| `NEXORA-AI_4.4.1.0_neutral.msix` | 10,552,023 | `273f62a6…405cf806d` | حزمة أحادية/فحص |
| `NEXORA-AI_4.4.1.0_neutral.test-signed.msix` | 10,556,435 | `9b3ae380…d7d5336a` | **اختبار محلي فقط** |
| `NEXORA-AI-test-certificate.cer` | 818 | `c0a1fa01…5400b47c7` | شهادة الاختبار العامة (بلا مفتاح خاص) |
| `install-test.json` | — | — | نتيجة اختبار التثبيت الفعلي |
| `upload-verification.json` | — | — | تقرير فحص ملف الرفع (بنية + block map + هوية) |
| `SHA256SUMS.txt` / `BUILD-INFO.txt` | — | — | البصمات وتفاصيل البناء |

> الحزم نفسها محفوظة أيضًا داخل المستودع في `windows/release/4.4.1.0/`، و
> `sha256sum -c SHA256SUMS.txt` ينجح على الملفات الأربعة؛ سطر الشهادة `.cer` يخصّ صفحة Release فقط
> (الشهادات لا تُرفع إلى المستودع — `.gitignore` يمنع `*.cer`).

## مهم: المتجر لا يحتاج توقيعك

Microsoft Store **يعيد توقيع** حزم MSIX أثناء الاعتماد، ولهذا ملف `.msixupload` أعلاه
**غير موقّع**. لا ترفع `test-signed.msix` ولا شهادة الاختبار إلى Partner Center.

إن احتجت توزيعًا **موقّعًا** خارج المتجر (sideload / Intune / تثبيت مباشر)، استخدم
[`Sign-StorePackage.ps1`](../../windows/scripts/Sign-StorePackage.ps1): يرفض أي شهادة لا يطابق
موضوعها `Package/Identity/Publisher`، ويشترط سلسلة موثوقة، ويوقّع SHA-256 مع timestamp،
ويكتب `SIGNATURE-INFO.txt`. لا تُرفع الشهادات إلى المستودع أبدًا.

## ما تم التحقق منه فعليًا (Run 44732511763)

- `Add-AppxPackage` نجح في **1.2 ثانية**، والحزمة ظهرت مسجّلة:
  `Ahmedbecetti.NEXORAAIbyBECETTI_4.4.1.0_neutral__y0zvy3a8v70hm` بحالة `Ok`.
- `Get-AppxPackage` أعاد Name وPublisher وVersion وPFN مطابقة تمامًا لـ
  `windows/package-identity.json`.
- الصلاحيات المعلنة في **مانيفست الحزمة المثبّتة**: `internetClient` و`runFullTrust` فقط.
- المدخل `Id=App` مع `HostId=PWA`، والتطبيق ظهر في Start:
  `NEXORA AI by BECETTI → …!App`.
- التشغيل عبر `explorer.exe shell:AppsFolder\…` أنشأ **11 عملية msedge** بعنوان نافذة حقيقي:
  «NEXORA Studio | ابنِ تطبيقًا كاملًا بالوصف — محرر وطرفية ومعاينة ونشر»، وبلا أخطاء تنشيط.
- سطح الإنتاج استجاب `HTTP 200` (12,157 بايت) لـ `?nx_surface=msix`.
- الإزالة (`Remove-AppxPackage`) نظفت التسجيل بلا بقايا.
- `Test-MsixPackage.ps1` أكّد أن الحزمة بلا `AppxSignature.p7x` وأنها تحتوي
  `resources.pri` و`AppxBlockMap.xml` و`[Content_Types].xml` و53 أصلًا.

## لماذا `runFullTrust` موجودة ولا تُزال

الحزمة Hosted App Model: لا executable ولا خدمة، والمضيف هو Edge Stable. جرّبنا بناء نسخة
**بدون** `runFullTrust` ورفضها نظام Windows نفسه:

```text
0x80073D2F — A host runtime dependency resolving to a package with full trust content
requires the main package to have the runFullTrust capability.
```

لذلك تبقى الصلاحية، مع تبرير جاهز للصق في Partner Center في
[`RUNFULLTRUST-REVIEW.md`](RUNFULLTRUST-REVIEW.md) (ونصه محفوظ أيضًا في
`windows/package-identity.json → capabilities.restricted.runFullTrust.partnerCenterJustification`).

## ما لم يتم

- لم تُرسل الحزمة إلى Partner Center (يحتاج حسابك)، ولم يعتمدها Microsoft Store.
- لم تُلتقط لقطات شاشة المتجر من جلسة سطح مكتب تفاعلية.
- لا يوجد رابط متجر قبل النشر؛ `storeUrl` يبقى فارغًا و`Product ID` يبقى مسودة.

## طريقة الرفع

1. نزّل `NEXORA-AI_4.4.1.0_neutral.msixupload` من الرابط أعلاه.
2. Partner Center → تطبيق **NEXORA AI by BECETTI** (`9ND09PBRDPKZ`) → **New submission**.
3. **Packages**: ارفع `.msixupload` كما هو.
4. **Submission options → restricted capabilities**: الصق نص `runFullTrust` من
   `RUNFULLTRUST-REVIEW.md §4`.
5. أكمل Store listing وProperties وPrivacy وSupport من [`STORE-LISTING.md`](STORE-LISTING.md).

## الاختبار المحلي (اختياري)

```powershell
# شهادة الاختبار العامة من صفحة Release، ثم:
Import-Certificate -FilePath .\NEXORA-AI-test-certificate.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople
Import-Certificate -FilePath .\NEXORA-AI-test-certificate.cer -CertStoreLocation Cert:\LocalMachine\Root
Add-AppxPackage -Path .\NEXORA-AI_4.4.1.0_neutral.test-signed.msix
```

إن رفض Windows بسبب `0x800B0109` فالجذر غير موثوق: أعد استيراد الشهادة إلى
`LocalMachine\Root` (يحتاج صلاحيات مدير)، ثم أعد المحاولة.

## إعادة البناء

- سكربت البناء: `windows/scripts/Build-Msix.ps1`
- اختبار التثبيت: `windows/scripts/Test-MsixInstall.ps1` + بوابة `windows/tools/assert-install-test.mjs`
- سير العمل: `.github/workflows/windows-store-package.yml` (ينشر Release تلقائيًا)
- الهوية والصلاحيات: `windows/package-identity.json` + `windows/msix/AppxManifest.reference.xml`

## ملف الرموز `.appxsym` — غير مطلوب

ملف `.msixupload` لا يحتوي `.appxsym`، وهذا **صحيح ومقصود**: Microsoft تنصّ في توثيقها على أن
الملف اختياري — «You can omit this file, but if you do, no crash analytic or debugging information
will be available»
(<https://learn.microsoft.com/en-us/windows/msix/package/packaging-uwp-apps>).
الحزمة Hosted App Model وتشغّل موقع الويب عبر Edge، فلا تحتوي أي كود مُصرَّف يمكن ترجمته إلى
رموز. التفصيل الكامل: [`PARTNER-CENTER-REVIEW.md`](PARTNER-CENTER-REVIEW.md).
