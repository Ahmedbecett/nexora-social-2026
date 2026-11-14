# صور متجر Softonic — NEXORA AI 4.4.0

أربع صور أصلية بمقاس **1080×1920** (النسبة 9:16، الحد الأدنى المطلوب) — كل صورة بصيغتي PNG وJPG.

| # | الملف | الموضوع |
|---|-------|---------|
| 1 | `nexora-softonic-1-1080x1920.png` | الشاشة الأولى: الشعار + الوعد + ثلاث مزايا |
| 2 | `nexora-softonic-2-1080x1920.png` | واجهة المحادثة الذكية (فقاعات عربية + اقتراحات + حقل إدخال) |
| 3 | `nexora-softonic-3-1080x1920.png` | الأدوات: توليد صور، ترجمة، تحليل ملفات، محادثة صوتية |
| 4 | `nexora-softonic-4-1080x1920.png` | الخصوصية والحساب + زر التحميل + `v4.4` |

## الهوية

مأخوذة حرفيًا من التطبيق، لا ألوان مُختارة عشوائيًا:

| العنصر | القيمة | المصدر |
|--------|--------|--------|
| الخلفية | `#0c1014` | `src/styles.css` → `html[data-theme='dark'] --bg` |
| الأسطح | `#1c2126` | `--surface` |
| الحدود | `#363a3f` | `--border` |
| النص | `#f5f5f5` | `--text` |
| الأزرق | `#0095f6` | `--blue` |
| الروابط | `#85c6ff` | `--link` |
| الشعار | `public/mascot.png` | أيقونة التطبيق الرسمية |

## إعادة التوليد

```bash
python3 scripts/make-softonic-shots.py
```

### المتطلبات

```bash
pip install --break-system-packages pillow arabic-reshaper python-bidi fonttools
```

الخط: **Noto Sans Arabic** (متغيّر، محاور `wght 100–900`) يُنزَّل إلى `/tmp/fonts/`:

```bash
gh api "repos/google/fonts/contents/ofl/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf" \
  -H "Accept: application/vnd.github.raw" > /tmp/fonts/NotoSansArabic.ttf
```

## ملاحظات تقنية

- **لماذا ليست لقطات شاشة حقيقية؟** لا يوجد متصفح في بيئة البناء: Chromium يحتاج `libnss3`, `libgbm1`, `libpango` وهي غير مثبتة، ومستودعات Debian محجوبة (`apt` يفشل بالاتصال، لا صلاحيات root). لذلك تُرسم الواجهات برمجيًا بقياسات وألوان التطبيق الحقيقية بدل تصويره.
- **تشكيل العربية:** Pillow مبني بلا `raqm` (لا HarfBuzz)، لذا يُشكَّل النص مسبقًا بـ `arabic_reshaper` + `python-bidi` ثم يُرسم.
- **لماذا Noto Sans Arabic؟** خط **Tajawal** الذي جُرّب أولًا ينقصه 10 أشكال عرض عربية (مثل `ﺀ ﺩ ﺍ ﻭ ﺓ ﻙ`) فظهرت مربّعات فارغة؛ **Amiri** كامل التغطية لكنه نسخي لا يناسب واجهة حديثة؛ Noto يغطي 1561 محرفًا بمظهر حديث و0 محرف مفقود.
- **اتجاه النص:** يُمرَّر `base_dir='R'` إلى `get_display` وإلا انقلبت الجمل التي تبدأ بكلمة لاتينية مثل «PDF وصور ومستندات» أو «دخول بالبريد أو Google».
- **الوزن العريض:** يُضبط عبر `set_variation_by_axes([wght, wdth])` — الترتيب حسب `fvar` (ليس العرض أولًا).
