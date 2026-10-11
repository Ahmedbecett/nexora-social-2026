<div align="center">

<img src="public/icon-192.png" width="110" alt="Nexora icon" />

# Nexora

**شبكة اجتماعية لمشاركة الصور ومقاطع الريلز والقصص — بالعربية والإنجليزية**

<a href="https://nexora-social-2026.vercel.app/download/Nexora.apk"><img src="https://img.shields.io/badge/تحميل_مباشر-Nexora.apk-1a8cff?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" height="44"/></a>

<a href="https://github.com/Ahmedbecett/nexora-social-2026/releases/latest/download/Nexora.apk"><img src="https://img.shields.io/badge/GitHub_Release-Nexora.apk-24292f?style=for-the-badge&logo=github" alt="GitHub Release" height="32"/></a>
<a href="https://nexora-social-2026.vercel.app"><img src="https://img.shields.io/badge/نسخة_الويب-افتح-d62976?style=for-the-badge&logo=vercel" alt="Web" height="32"/></a>

</div>

---

## ⬇️ التحميل

| | الرابط |
|---|---|
| **APK مباشر (Android 6.0+)** | https://nexora-social-2026.vercel.app/download/Nexora.apk |
| **آخر إصدار على GitHub** | https://github.com/Ahmedbecett/nexora-social-2026/releases/latest/download/Nexora.apk |
| **نسخة الويب** | https://nexora-social-2026.vercel.app |

> عند التثبيت لأول مرة فعّل «السماح بالتثبيت من مصادر غير معروفة». إذا كانت لديك نسخة قديمة من NEXORA (Kotlin/Firebase) احذفها أولاً لأن توقيع التطبيق تغيّر.

## ✨ المزايا

- **تسجيل الدخول وإنشاء حساب** بواجهة عربية (RTL) مطابقة للتصميم، مع تبديل فوري إلى الإنجليزية.
- **الصفحة الرئيسية (التغذية):** القصص، المنشورات (صور متعددة / فيديو)، إعجاب بالنقر المزدوج، تعليقات، حفظ، مشاركة إلى الرسائل، اقتراحات متابعة.
- **مقاطع الريلز:** تمرير عمودي بملء الشاشة، تشغيل تلقائي، كتم/تشغيل الصوت، إعجاب، تعليقات، متابعة.
- **القصص:** نشر صورة/فيديو لمدة 24 ساعة، شريط تقدّم، الرد برسالة، عدد المشاهدين، الأرشيف، **التمييزات (Highlights)**.
- **الملف الشخصي:** الإحصائيات، النبذة، تعديل الملف وصورة الحساب، مشاركة الملف، شبكة المنشورات/الريلز/المحفوظات، المتابِعون والمتابَعون.
- **البحث والاستكشاف:** شبكة استكشاف، بحث عن الحسابات، الوسوم #hashtags، الإشارات @mentions.
- **الإنشاء:** منشور (حتى 10 صور/فيديوهات) أو قصة أو ريل، مع الموقع والتعليق والنشر في القصة.
- **الإشعارات:** الإعجابات، التعليقات، الإشارات، المتابعات، طلبات المتابعة للحسابات الخاصة.
- **الرسائل الخاصة:** محادثات، صور، مشاركة منشورات.
- **الإعدادات:** حساب خاص، تغيير كلمة السر، اللغة، الأرشيف، حذف الحساب، تسجيل الخروج.

## 🏗️ البنية التقنية

| الطبقة | التقنية |
|---|---|
| واجهة التطبيق | React 18 + Vite (ملف `src/`) |
| تطبيق أندرويد | Capacitor 7 (`android/`) — APK موقّع |
| الخادم (API) | Vercel Serverless Function واحدة: `api/index.js` → `api/_lib/handlers.js` |
| قاعدة البيانات | Neon PostgreSQL — المخطط في `api/_lib/schema.sql` |
| تخزين الوسائط | Vercel Blob (رفع مباشر من الجهاز عبر رموز مؤقتة) |
| المصادقة | JWT + bcrypt |

### متغيرات البيئة على Vercel
`DATABASE_URL` · `JWT_SECRET` · `BLOB_READ_WRITE_TOKEN` (مضبوطة بالفعل على مشروع `nexora-social-2026`).

### التشغيل محلياً
```bash
npm install
DATABASE_URL=... JWT_SECRET=... BLOB_READ_WRITE_TOKEN=... npm run api:local   # API على :3001
npm run dev                                                                    # الواجهة على :5173
npm run db:migrate                                                             # إنشاء الجداول
```

### بناء APK
```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```
يبني GitHub Actions (`.github/workflows/android-release.yml`) ملف APK تلقائياً عند كل push إلى `main` وينشره في الإصدار `latest`.
لتوقيع البناء الآلي بنفس مفتاح الإصدار أضف الأسرار `NEXORA_KEYSTORE_BASE64` و `NEXORA_KEYSTORE_PASSWORD` في إعدادات المستودع.

> النسخة السابقة (Kotlin + Firebase) محفوظة في سجل git قبل هذا الالتزام.

---
© 2026 Ahmed Becetti
