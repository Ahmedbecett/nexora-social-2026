# تدقيق مانيفست حزمة Windows — `runFullTrust` و`RuntimeBehavior` و`TrustLevel`

<div dir="rtl">

**الحزمة:** `NEXORA AI by BECETTI` — `4.4.0.0`
**المانيفست:** [`windows/msix/AppxManifest.reference.xml`](../../windows/msix/AppxManifest.reference.xml)
**تاريخ التدقيق:** 20 نوفمبر 2026

## الخلاصة

1. حزمتنا **Hosted App Model** حقيقية: لا تحتوي `Executable` ولا `EntryPoint` ولا `StartPage`.
2. `Executable` و`EntryPoint` و`RuntimeBehavior` و`TrustLevel` الخاصة بالتشغيل يعلنها **مضيف Edge**
   في امتداد `windows.hostRuntime`، وتُورَّث لحزمتنا عبر `uap10:HostId="PWA"`.
3. `runFullTrust` **مطلوبة فعليًا** لحل تبعية هذا المضيف، وليست زينة. إزالتها تُفشل التثبيت
   بالخطأ `0x80073D2F`، وقد أُثبت ذلك في CI ثم أُعيدت ونجح التثبيت.
4. PWABuilder يضيف `runFullTrust` تلقائيًا في حزم Edge PWA. في مستودعنا لا يوجد أي كود يضيفها
   وقت البناء؛ هي مكتوبة صراحةً في المانيفست، والمُدقّقات تفشل إذا غابت أو إذا أُضيفت حقول المضيف.

---

## ١) ما الذي يُشحن فعلاً؟

`Build-Msix.ps1` ينسخ `AppxManifest.reference.xml` **حرفيًا** إلى `AppxManifest.xml` داخل الحزمة
(ثم يضيف `AppxBlockMap.xml` و`resources.pri` والتوقيع فقط). لذلك ما في المستودع هو ما يُثبَّت،
وليس نموذجًا وصفيًا.

| العنصر / الحقل | القيمة في حزمتنا | الملاحظة |
|---|---|---|
| `Identity/Name` | `Ahmedbecetti.NEXORAAIbyBECETTI` | من Partner Center، لم يتغيّر |
| `Identity/Publisher` | `CN=A5D5DC31-4A15-4059-8030-D96C51054596` | لم يتغيّر |
| `Identity/Version` | `4.4.0.0` | لم يتغيّر |
| `Identity/ProcessorArchitecture` | `neutral` | حزمة واحدة |
| `TargetDeviceFamily` | `Windows.Desktop`, `MinVersion=10.0.19041.0` | الحد الأدنى لـ Hosted App Model |
| `Dependencies/uap10:HostRuntimeDependency` | `Microsoft.MicrosoftEdge.Stable` | تبعية مضيف Edge Stable |
| `Application/@Id` | `App` | |
| `Application/@uap10:HostId` | `PWA` | يطابق `HostRuntime Id="PWA"` عند Edge |
| `Application/@uap10:Parameters` | `--app-id=… --ip-edge-aumid=… --app-fallback-url=… --windows-store-app` | عقد التشغيل مع Edge |
| `Application/@Executable` | **غائب** | صحيح للنموذج المستضاف |
| `Application/@EntryPoint` | **غائب** | صحيح للنموذج المستضاف |
| `Application/@StartPage` | **غائب** | الرابط داخل `--app-fallback-url` |
| `Application/@uap10:TrustLevel` | **غائب** | يُورَّث من المضيف |
| `Application/@uap10:RuntimeBehavior` | **غائب** | يُورَّث من المضيف |
| `Capabilities` | `internetClient` + `rescap:Capability Name="runFullTrust"` | `runFullTrust` إلزامية كما هو موضح أدناه |

---

## ٢) من يعلن `RuntimeBehavior` و`TrustLevel`؟

توثيق Microsoft لنموذج Hosted App Model يقول إن **المضيف** هو من يعلنها:

> The `Executable`, `uap10:RuntimeBehavior`, and `uap10:TrustLevel` attributes specify
> the name of the host process binary in the package and how the hosted apps will run.

وإن التطبيق المستضاف:

> The hosted app package must declare this attribute [**HostId**] instead of the usual
> **Executable** and **EntryPoint** attributes … As a result, the hosted app inherits the
> **Executable**, **EntryPoint** and runtime attributes from the host with the corresponding
> **HostId** value.

مانيفست Edge Stable نفسه (نسخة 117 موثقة علنًا) يعلن المضيف هكذا:

```xml
<uap10:Extension Category="windows.hostRuntime"
    EntryPoint="Windows.FullTrustApplication"
    Executable="pwahelper.exe"
    uap10:RuntimeBehavior="packagedClassicApp"
    uap10:TrustLevel="mediumIL">
  <uap10:HostRuntime Id="PWA" />
</uap10:Extension>
```

وتطبيق Edge الرئيسي في الحزمة نفسها:

```xml
<Application EntryPoint="Windows.FullTrustApplication"
    Executable="msedge.exe" Id="MSEDGE"
    uap10:RuntimeBehavior="packagedClassicApp"
    uap10:TrustLevel="mediumIL">
```

لذلك عند تشغيل تطبيقنا:

- Windows يقرأ `HostId="PWA"` من حزمتنا.
- يجد `HostRuntime Id="PWA"` في حزمة Edge.
- يشغّل `pwahelper.exe` **بهوية حزمتنا**، بسلوك `packagedClassicApp` ومستوى ثقة `mediumIL`.
- محتوى PWA يُحمَّل داخل Edge، وليس كعملية Win32 خاصة بنا.

**النتيجة:** إضافة `uap10:TrustLevel` أو `uap10:RuntimeBehavior` إلى `Application` في حزمتنا
غير صحيحة؛ فهي ليست حقول التطبيق المستضاف، وقد تتعارض مع قيم المضيف. لهذا يرفضها المدقق
`validateManifestXml` والاختبارات، ويرفضها `Test-MsixPackage.ps1` أيضًا.

---

## ٣) لماذا `runFullTrust` مطلوبة إذًا؟

لأن المضيف نفسه **full-trust host runtime**: يعلن `Windows.FullTrustApplication` و
`packagedClassicApp` و`mediumIL`، ويحمل `runFullTrust` في قدراته. والتطبيق المستضاف يحصل على
**تقاطع** القدرات بينه وبين المضيف، ولا يستطيع طلب قدرة لا يملكها المضيف. عند حل
`HostRuntimeDependency` إلى محتوى full trust، يشترط Windows أن تعلن الحزمة الرئيسية
`runFullTrust`، وإلا يفشل التسجيل/التثبيت:

```text
0x80073D2F — A host runtime dependency resolving to a package with full trust
content requires the main package to have the runFullTrust capability.
```

هذا ليس استنتاجًا نظريًا؛ هذه تسلسل الأدلة الفعلي:

| الخطوة | النتيجة |
|---|---|
| بناء حزمة **بدون** `runFullTrust` | نجح `makeappx` — أي أن فحص المخطط وحده لا يكشف المشكلة |
| تثبيتها بـ `Add-AppxPackage` (Run `44674821589`) | فشل: `0x80073D2F` |
| إعادة الصلاحية وبناء جديد (Run `44675317746`) | نجح التثبيت، وأكد الفحص `internetClient` + `runFullTrust`، وظهر التطبيق في Start، وبدأ مضيف Edge، ثم أُزيلت الحزمة بنجاح |
| بناء لاحق مع فحص البنية الصارم (Run `44716168241`) | نجح أيضًا: لا `Executable`/`EntryPoint`/`TrustLevel`/`RuntimeBehavior`، و`HostRuntimeDependency` واحدة لـ Edge، ثم تثبيت وتفعيل وإزالة |

### ماذا تعني أمنيًا وماذا لا تعني؟

- الحزمة **لا تحتوي أي ملف PE** (`.exe`/`.dll`)؛ محتواها PNG + مانيفست + `resources.pri` +
  block map + توقيع. لا يوجد كود أصلي لنا يعمل بصلاحية full trust.
- الصلاحية لا تمنح JavaScript داخل صفحة الويب صلاحيات Win32 إضافية؛ محتوى الويب يظل داخل
  عزل Edge. الصلاحية شرط **لحل مضيف التشغيل**، وليست مسارًا نستخدمه نحن.
- Edge نفسه مثبّت ويعمل بهذه الثقة أصلًا؛ حزمتنا تعلن قدرة يستخدمها المضيف عند تفعيلها.

### جواب Partner Center

عند ظهور تحذير القدرة المقيّدة، هذا هو النص الموصى به من PWABuilder نفسه:

> Needed for PWA Hosted App model, created by pwabuilder.com

لا تكتب أن التطبيق يحتاج الوصول إلى كل الملفات أو أجهزة النظام؛ هذا غير صحيح. راجع أيضًا
[`SIGNING-STATUS.md`](SIGNING-STATUS.md) البند 5.

---

## ٤) هل أضافها PWABuilder تلقائيًا؟

**نعم، في حزم PWABuilder الخاصة بـ Edge PWA.** القالب يضيف `runFullTrust` افتراضيًا، وتوثيق
PWABuilder يشرح أن تحذير Partner Center «يمكن تجاهله بأمان» وأن يكتب المطوّر جملة التبرير أعلاه.
كما أن مانيفست تطبيق WhatsApp المولّد بنموذج Edge المستضاف يحتوي `runFullTrust` و
`packageManagement`، ولا يحتوي `Executable` أو `TrustLevel` أو `RuntimeBehavior`.

أما في **هذا المستودع**:

- لا يوجد أي كود بناء يضيف القدرات تلقائيًا؛ `Build-Msix.ps1` ينسخ المانيفست كما هو.
- `runFullTrust` مكتوبة صراحةً مع تعليق يشرح سببها.
- `validateManifestXml` و`Test-MsixPackage.ps1` واختبارات `npm test` تفشل إذا غابت.
- لذلك «أُضيفت تلقائيًا» تصف أصلها في قالب PWABuilder، لكنها الآن **ثابت مقصود ومُختبر**،
  وليست أثرًا عابرًا يمكن حذفه.

---

## ٥) التحقق الحالي

| الفحص | النتيجة |
|---|---|
| `npm test` | **225/225** |
| مدقق المانيفست (`validateManifestXml`) | ✅ لا أخطاء |
| بنية Hosted App Model (لا `Executable`/`EntryPoint`/`TrustLevel`/`RuntimeBehavior`) | ✅ مُختبرة |
| تثبيت Windows فعلي | ✅ Run `44716168241` (وأول نجاح في `44675317746`) |
| ظهور التطبيق في Start | ✅ |
| بدء مضيف Edge | ✅ |
| إزالة الحزمة | ✅ |
| هوية الحزمة والإصدار | لم تتغيّر: `4.4.0.0` |
| أصول Release العامة | لم تُستبدل |

**لم يُتحقق بعد:** التشغيل التفاعلي الكامل على جهاز المستخدم، app URI handler، تسجيل الدخول،
العمل offline، ومسار التحديث، ثم قبول المتجر.

---

## ٦) التباس في توثيق أحدث

صفحة «Hosted apps in Windows App SDK» تقول في جملة واحدة إن التطبيق المستضاف «يحدد
`TrustLevel` و`RuntimeBehavior`»، لكن **مثالها وجدولها لا يحتويان هذين الحقلين**، ويكتفيان بـ
`HostRuntimeDependency` و`HostId` و`Parameters`. بالنسبة لنموذج Edge PWA، القيم يعلنها المضيف
وتُورَّث، كما أثبت مانيفست Edge الفعلي وتثبيت حزمتنا الناجح. لا تُضِف هذين الحقلين إلى
`Application` في حزمتنا.

---

## ٧) المراجع

- [Create hosted apps — Microsoft Learn](https://learn.microsoft.com/en-us/windows/uwp/launch-resume/hosted-apps)
- [Hosted apps in Windows App SDK — Microsoft Learn](https://learn.microsoft.com/en-us/windows/apps/develop/launch/hosted-apps)
- [مانيفست Edge الفعلي (نسخة 117) — Microsoft Community Hub](https://techcommunity.microsoft.com/discussions/microsoftlearn/hi-new-to-tc-uwp-access-concerns-modding-os-apps--need-edge-scripts-chkd/3992371)
- [PWABuilder issue #2151 — تحذير runFullTrust لا يؤدي للرفض](https://github.com/pwa-builder/PWABuilder/issues/2151)
- [PWABuilder — Publish a new app (نص التبرير)](https://github.com/pwa-builder/pwabuilder-windows-chromium-docs/blob/master/publish-new-app.md)
- [MSIX-Hero issue #115 — مانيفست Edge PWA حقيقي](https://github.com/marcinotorowski/MSIX-Hero/issues/115)
- [Run 44674821589 — فشل 0x80073D2F](https://github.com/Ahmedbecett/nexora-social-2026/actions/runs/44674821589)
- [Run 44675317746 — نجاح التثبيت والتفعيل](https://github.com/Ahmedbecett/nexora-social-2026/actions/runs/44675317746)
- [Run 44716168241 — إعادة التحقق مع فحص بنية Hosted App Model](https://github.com/Ahmedbecett/nexora-social-2026/actions/runs/44716168241)

</div>
