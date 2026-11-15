# GameVerse — حزمة إثبات الملكية لـ Amazon

> **الغرض:** الرد على طلب Amazon Developer Support لوثائق تُثبت حقوق الملكية الفكرية في تطبيق
> GameVerse (قضية مغلقة الحساب). المطلوب: خطاب تأكيد من مالك الحقوق بتوقيع رسمي، على ترويسة.
>
> **المفتاح:** أنت مالك الحقوق الوحيد. لا يوجد طرف ثالث يمنحك ترخيصًا، فلا وجود لاتفاقية ترخيص.
> الحزمة تُقدّم **إقرارًا وخطاب تأكيد صادرين عن مالك الحقوق نفسه** — وهو ما ينطبق على حالتك بالضبط.

---

## المحتويات

| # | الملف | الدور |
|---|---|---|
| 1 | `1-declaration-of-ownership.pdf` (3 صفحات) | الإقرار الموقّع — يحدد العمل والحقوق وأساسها، ويعالج مسألة الألعاب الخارجية |
| 2 | `2-confirmation-letter.pdf` (صفحتان) | الخطاب المطلوب حرفيًا — على ترويسة، بصيغة مراسلة |
| 3 | `3-annex-evidence-index.pdf` (صفحتان) | فهرس الأدلة + 13 رابطًا حيًا + أوامر تحقّق |
| 4 | `4-amazon-submission-a-to-z.pdf` (6 صفحات) | **النص الكامل** — 26 قسمًا (A–Z) يشرح كل شيء من الهوية إلى التوقيع |

**أرسل الأربعة معًا.** الـZIP يجمعها في ملف واحد.

---

## خطوات الإرسال

### 1) املأ رقم القضية
في أعلى `scripts/build-gameverse-ownership.py`:
```python
case = "___________",   # ← ضع رقم قضية Amazon هنا
```
ثم أعد التوليد: `python3 scripts/build-gameverse-ownership.py`

> بدون رقم القضية، الوثائق تعمل لكنها أقل احترافية. رقم القضية يظهر في ترويسة كل صفحة.

### 2) وقّع بالقلم الأزرق
اطبع `1` و`2` و`4`، ووقّع في خانة «Signed by the rights holder» في كل منها، ثم امسحها PDF.
أضف التاريخ بجانب التوقيع.

### 3) أرفق مع الوثائق
- **الـAPK** الذي رفعته إلى Amazon (`gameverse-2.8.0-release.apk`).
- **لقطات شاشة** للتطبيق والموقع.

### 4) أرسل الردّ الجاهز
انسخ النص من القسم أدناه في صفحة القضية.

---

## الردّ الجاهز

```
Dear Amazon Developer Support,

Thank you for your response. I understand the requirement: documentation demonstrating valid
intellectual property rights in the application — either a confirmation letter from the rights
holder bearing a formal signature, or a copy of the applicable licence agreement, on letterhead
or stamp paper.

In this case the intellectual property rights holder and the developer are the same person. I
am Ahmed Becetti, an individual developer resident in Chlef, Algeria, trading as GameVerse
Studio as a sole proprietor. I wrote the application and the platform behind it myself: the
source code, the interface, the catalogue, the seventeen original games and the brand. There
is no company, employer, contractor or co-owner, and no third party holds any licence, royalty
or other interest in the work.

Because the owner and the developer are the same individual, no licence agreement can exist:
a licence defines a relationship between two parties, and here there is only one. I am
therefore supplying the confirmation letter contemplated by your request, issued on the rights
holder's own letterhead and signed in ink by the rights holder:

  A1. Declaration of Intellectual Property Ownership — signed (3 pages)
  A2. Letter of confirmation on the rights holder's letterhead — signed (2 pages)
  A3. Annex — evidence index, live links and verification commands (2 pages)
  A4. Full submission document A-Z — 26 sections (6 pages)

The application's particulars:

  Application:            GameVerse
  Package:                com.gameverse.app
  Version:                2.8.0 (versionCode 2800)
  Platforms:              Android 7.0+, Amazon Fire OS, Fire TV
  Rights holder:          Ahmed Becetti — GameVerse Studio, Chlef, Algeria
  Official site:          https://gameverse-henna.vercel.app
  APK SHA-256:            6083de941f114e89e06b10aed4569c8f45ee67fcd4dcfc8716898da46901c82b
  Certificate SHA-256:    c14535373c95b51a188e4f885fdc755cad3212fb9ac1487de2d6eec5d48e0668
  AdMob publisher:        pub-6858364141205978 (authorised in app-ads.txt)

The following links are public and require no credentials, and they tie the submitted binary to
my identity independently of anything I assert:

  Who built it:           https://gameverse-henna.vercel.app/about
  App page:               https://gameverse-henna.vercel.app/app
  Download the APK:       https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk
  Published checksum:     https://gameverse-henna.vercel.app/dl/gameverse-2.8.0-release.apk.sha256
  app-ads.txt:            https://gameverse-henna.vercel.app/app-ads.txt
  Privacy policy:         https://gameverse-henna.vercel.app/privacy

Recomputing the SHA-256 of the APK you have and comparing it with the published checksum will
confirm the file is the one distributed from my own domain, under my own hosting account, whose
deployment history records me as the author of every build.

To be precise about third-party content: some games in the catalogue are open-source titles used
under licences that permit commercial redistribution, with attribution preserved and the licence
shown on each game page; other entries are pointers to developers' own official release pages,
which GameVerse does not re-host. Those third parties remain the owners of their own games, and
their rights do not overlap with mine over the application itself. No agreement with them could
evidence ownership of this application, which is entirely mine.

If Amazon requires a document in a different form — a notarised copy, an officially attested
declaration, or a sworn translation — please tell me which, and I will obtain it and supply it
promptly.

Kind regards,
Ahmed Becetti
GameVerse Studio · Chlef, Algeria
ahmedbecetti41@gmail.com · +213 784 302 071
```

---

## لماذا هذه الحزمة تعالج طلبهم حرفيًا

| ما طلبه Amazon | ما تقدّمه الحزمة |
|---|---|
| «confirmation letter from the IP rights holder» | الملف `2` — صادر عن مالك الحقوق نفسه |
| «with a formal signature» | توقيع بالقلم في خانة مخصّصة + خانة توثيق رسمي |
| «on letterhead or stamp paper» | ترويسة GameVerse في كل صفحة (شعار، اسم، جهة اتصال، رقم القضية) |
| «clearly define the relationship and presence of both the parties» | القسم L يشرح أن الطرفين شخص واحد ولماذا لا وجود لاتفاقية |
| «unable to accept informal claims» | أدلة تشفيرية + 13 رابطًا حيًا + أوامر تحقّق يشغّلها المراجع بنفسه |

**نقطة القوة:** بصمة الـAPK منشورة على نفس النطاق الذي يقدّم وصف التطبيق وسياسة الخصوصية
و`app-ads.txt`. أي مراجع يستطيع إعادة حساب البصمة ومطابقتها — وهذا لا يمكن تلفيقه.

---

## الأدلة المستخرجة (كلها متحقَّق منها)

```
المشروع       prj_7fJN5wSFW3IZmVy8FOK75hS0GuWb
النشر          dpl_451ViE6CPqmc12hixYFDV9RhiUQc  (READY, production)
الكوميت        30dc8fa40fc32df84bb40fd7d3539509718f48d2
APK SHA-256   6083de941f114e89e06b10aed4569c8f45ee67fcd4dcfc8716898da46901c82b
الشهادة       c14535373c95b51a188e4f885fdc755cad3212fb9ac1487de2d6eec5d48e0668
حجم الـAPK     ~5 MB · versionCode 2800
app-ads.txt   google.com, pub-6858364141205978, DIRECT, f08c47fec0942fa0
```

روابط مُختبرة وتعمل: `/` · `/about` · `/app` · `/privacy` · `/partners` · `/developers` ·
`/support` · `/games` · `/original-games` · `/app-ads.txt` · `.apk.sha256`

---

## ملاحظات مهمّة قبل الإرسال

1. **رقم القضية:** الوثائق فيها فراغ `___________`. املأه قبل الطباعة.
2. **المستودع خاص:** `Ahmedbecett/gameverse` مستودع خاص، لذا لم أستطع قراءة شيفرته. كل الحقائق
   أعلاه مأخوذة من الموقع الحيّ وبيانات Vercel — وهي كافية تمامًا، لكن لا تذكر في مراسلتك أن
   المستودع عام.
3. **`/apk` يرجع خطأ 500** حاليًا. لا تدرجه كدليل. استخدم الرابط الكامل `.../dl/gameverse-2.8.0-release.apk`.
4. **البريد:** GameVerse يستخدم `ahmedbecetti41@gmail.com` (وليس `35`). تأكد أنك تراسل Amazon من
   نفس البريد المسجّل في حساب المطوّر، وإلا ضعُف الربط.
5. **إن أصرّوا:** صدّق الوثيقة لدى البلدية ثم وزارة الخارجية (الخانة جاهزة)، أو وثّقها عند كاتب عدل.
   وإن تكرر الرفض فالمشكلة في صفة «فرد» لا في الوثيقة — الحل سجل تجاري/EURL.

---

## إعادة التوليد

```bash
python3 scripts/build-gameverse-ownership.py
```

المخرجات في `docs/gameverse/`. السكربت يقرأ الحقائق من قاموس `F` في أعلاه؛ حدّثه عند تغيير
الإصدار أو البصمة أو رقم القضية.
