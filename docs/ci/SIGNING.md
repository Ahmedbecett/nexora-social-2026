# توقيع الإنتاج (Production signing) — NEXORA AI

هذا الملف يوثّق كيفية توقيع APK النشر بمفتاح الإنتاج، وكيفية التحقق منه، وماذا يعني فقدان المفتاح.

## الأسرار (Repository secrets — لا تُقرأ إلا وقت البناء)

| الاسم | المحتوى |
|---|---|
| `NEXORA_KEYSTORE_BASE64` | ملف المخزن `nexora-release.p12` مشفّرًا بـ base64 (PKCS12) |
| `NEXORA_KEYSTORE_PASSWORD` | كلمة مرور المخزن |
| `NEXORA_KEY_ALIAS` | `nexora` |

الـ workflow (`.github/workflows/android-release.yml`) يقرأها وقت التشغيل:
يكتب الـ base64 إلى `$RUNNER_TEMP/nexora.jks`، ويصدّر `NEXORA_KEYSTORE`، ثم يستخدمها
`build.gradle` لبناء `assembleRelease` موقّع — وإن غابت الأسرار، يُوقّع بمفتاح debug (لا يُستحسن للنشر).

## بصمة المفتاح الحالي (للتحقق)

- الموضوع: `CN=NEXORA AI, OU=Mobile, O=Ahmed Becetti, L=Chlef, C=DZ`
- SHA-256: `24:0E:00:2F:A0:90:51:6D:EF:06:E8:92:61:4F:03:A3:79:17:A0:3B:30:04:BE:EC:F5:1B:1A:D3:0C:07:42:F6`
- الصلاحية: 2026-11-11 → 2054-03-29 · الاسم المستعار: `nexora`

لعرض توثيق APK المنشور:
`unzip -p Nexora.apk 'META-INF/*.RSA' > cert.der && openssl pkcs7 -inform DER -in cert.der -print_certs -noout -subject -fingerprint -sha256`

## قواعد لا بد منها

1. المفتاح هو **هوية التطبيق الدائمة**: من يفقده لا يستطيع نشر تحديثات للتطبيق. احفظ `nexora-release.p12` وكلمة المرور خارج Git في مدير كلمات مرور.
2. Commit أصلي للمخزن أو المفاتيح (`*.p12` / `*.jks` / `*.pem`) ممنوع قطعًا — لهذا وُلّد المفتاح خارج المستودع.
3. تغيير التوقيع بعد نشر أول APK موقّع = **لا يمكن التحديث فوق النسخة المثبتة**؛ يجب إلغاء التثبيت ثم التثبيت.
4. Secrets في GitHub للكتابة فقط — لا يمكن قراءتها لاحقًا؛ احفظها في `nexora-signing-info.txt` عند المالك.
5. أي token/PAT وُلِّد لمهمة التوقيع يجب إلغاؤه بعد انتهاء العمل.

## نشر نسخة موقّعة جديدة

أي push/merge إلى `main` (أو Run workflow → main) يعيد البناء والنشر تلقائيًا:
المخرجات تتضمن APK موقّعًا على Release باسم `latest` + تحديث `public/download/Nexora.apk` على الموقع.
للتحقق بعد البناء: نزّل الأصل وقارن SHA-256/البصمة أعلاه، أو افحص `META-INF` كما في الأمر.
