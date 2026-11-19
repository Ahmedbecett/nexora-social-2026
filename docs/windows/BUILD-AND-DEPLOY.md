# Build and deploy — NEXORA AI Windows Edition

<div dir="rtl">

## ١) المتطلبات

- Node.js 20 أو أحدث (المشروع مختبر على Node 22).
- npm 10+.
- للتحقق من Windows: جهاز Windows 10 (2004/19041+) أو Windows 11، وMicrosoft Edge.
- لبناء MSIX: Windows 10/11 + Windows SDK (يوفر `makeappx.exe` و`signtool.exe`) + شهادة توقيع من Partner Center.
- لا تحتاج تغيير أي متغير بيئة خادم. الواجهة تستخدم القيم الإنتاجية:
  `VITE_API_BASE=https://nexora-social-2026.vercel.app` و`VITE_WEB_URL` نفس النطاق (في `.env.production`).

## ٢) تشغيل محلي

```bash
npm ci
npm run dev            # http://localhost:5173
npm run check:login    # فحص إعدادات الدخول
npm run windows:check  # فحص جاهزية Windows (لا يحتاج Windows)
```

ملاحظة: خدمة العمل لا تُسجَّل في التطوير افتراضيًا (حتى لا تتعارض مع HMR). لتجربتها محليًا:

```js
localStorage.setItem('nx_sw_dev', '1'); location.reload();
```

## ٣) بناء الإنتاج

```bash
npm run build
```

يُنتج `dist/` ويشمل:

- `dist/sw.js` و`dist/offline.html`
- `dist/windows/` (صفحة Windows + سياسة الخصوصية + `ads-config.json`)
- `dist/manifest.webmanifest` مع `display_override: window-controls-overlay`
- `dist/version.json` لبصمة البناء

تحقق سريع:

```bash
ls dist/sw.js dist/offline.html dist/windows/ads-config.json
node --check dist/sw.js
npm run windows:check
```

## ٤) النشر على Vercel

المشروع مربوط بمشروع Vercel باسم `nexora-social-2026`. بعد دمج التغييرات في `main` يُنشر تلقائيًا، أو:

```bash
npx vercel --prod
```

### ترويسات يجب أن تبقى صحيحة (مضافة في `vercel.json`)

| المسار | الترويسة | السبب |
|---|---|---|
| `/sw.js` | `Cache-Control: no-cache` + `Service-Worker-Allowed: /` | تحديث فوري لخدمة العمل ونطاق كامل |
| `/offline.html` | `no-store` + `X-Robots-Tag: noindex` | صفحة خدمة لا تُفهرس |
| `/windows/ads-config.json` | `application/json` + `no-store` | تغيير مزوّد الإعلان دون إعادة بناء |
| `/manifest.webmanifest` | `no-cache` | تحديث بيانات التثبيت فورًا |
| `/assets/*` | `immutable` | أصول مُبصّمة |

لا تضف `Cache-Control` شاملًا على `/(.*)`؛ اختبار `tests/update-cache.test.mjs` يمنعه لأنه يلوّث الأصول ويسبب «الصفحة القديمة».

### التحقق بعد النشر

1. افتح `https://nexora-social-2026.vercel.app/` وتحقق من `data-build` في `<html>` مقابل `/version.json`.
2. افتح DevTools → Application → Service Workers: يجب أن يظهر `/sw.js` بحالة activated.
3. Application → Manifest: يجب أن يظهر NEXORA AI مع أيقونات 192/512/1024 و`window-controls-overlay`.
4. جرّب الانقطاع: DevTools → Network → Offline، ثم أعد التحميل؛ يجب أن تظهر صفحة/واجهة عدم الاتصال.
5. ثبّت التطبيق من أيقونة التثبيت في Edge. يجب أن تُفتح نافذة مستقلة بشريط عنوان NEXORA.
6. لا تختبر الدفع أو الحذف بحساب إنتاج حقيقي دون سبب؛ استخدم حساب اختبار.

## ٥) الحفاظ على تطبيق أندرويد

- خدمة العمل **لا تُسجَّل** داخل Capacitor: القرار في `src/pwaCore.js` (`nativeShell ⟹ منع`).
- لم يُعدَّل `capacitor.config.json` ولا `android/`.
- `src/WindowsShell.jsx` لا يرسم شيئًا إلا داخل تطبيق Windows مثبّت يدعم WCO.
- `src/ads/windowsAds.js` لا يعمل على `android` (السطح `android` غير مسموح).
- بعد أي تعديل، شغّل `npm test` و`npm run build`، وتأكد من نجاح `npm run android:sync` قبل إصدار APK.

## ٦) التراجع (Rollback)

- إن ظهرت مشكلة في خدمة العمل، أعد نشر commit سابق من Vercel أو غيّر `CACHE` في `public/sw.js` لإجبار التحديث.
- لا تحذف `/sw.js` من النشر دون خطة: المتصفحات المثبّتة ستحاول تحديثه وقد تبقى على نسخة قديمة حتى إعادة التثبيت.
- لحذف كاش العميل فورًا أضف رسالة `NX_SKIP_WAITING` (موجودة) أو ارفع اسم `CACHE` في `public/sw.js`.

## ٧) الملفات التي لا تُرفع

- `dist/` (مُستبعد في `.gitignore`).
- شهادات `*.pfx` / `*.p12` / `*.cer` ومفاتيحها — لا تُرفع أبدًا. مرّر الشهادة عبر مسار محلي أو سر CI.
- أي `node_modules` أو ملفات بناء.

</div>

## English quick reference

```bash
npm ci
npm run windows:check        # identity, version, assets, manifest, ads, SW
npm test                     # full suite
npm run build                # dist/ with sw.js, offline.html, /windows/
npx vercel --prod            # deploy (or merge to main)
```

Then on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Update-MsixIdentity.ps1 `
  -SourceMsix .\NEXORA.msix -OutputMsix .\dist\NEXORA-AI-Windows.msix `
  -CertificatePath .\nexora.pfx -RequireSignature
powershell -ExecutionPolicy Bypass -File .\windows\scripts\Test-MsixPackage.ps1 `
  -MsixPath .\dist\NEXORA-AI-Windows.msix
```

Never commit the certificate. Never deploy an unsigned package to the Store. Never add a fake Product ID.
