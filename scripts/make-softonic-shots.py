#!/usr/bin/env python3
"""
NEXORA AI — مولّد صور متجر Softonic (1080×1920، PNG أصلية).

الهوية مأخوذة حرفيًا من التطبيق (src/styles.css):
  #0c1014 خلفية الوضع الداكن · #1c2126 الأسطح · #363a3f الحدود
  #f5f5f5 النص · #0095f6 الأزرق · #85c6ff الروابط

النصوص العربية: arabic_reshaper + bidi ثم الرسم بخط Noto Sans Arabic
  (الخط الوحيد المتاح الذي يغطي كل أشكال العرض العربية: 1561 محرفًا، 0 مفقود.
   Tajawal كان ناقصًا 10 محارف ⟹ مربعات فارغة. Amiri كامل لكنه نسخي لا يناسب واجهة حديثة.)

لماذا ليست لقطات شاشة حقيقية؟
  لا متصفح في البيئة: chromium يحتاج libnss3/libgbm/libpango غير المثبتة،
  ومستودع Debian محجوب (apt يفشل بالاتصال). لذلك تُرسم الواجهات برمجيًا
  بالقياسات والألوان الحقيقية بدل تصوير التطبيق.
"""
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display
import os

W, H = 1080, 1920
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'store', 'softonic')
FONTS = '/tmp/fonts'
ARABIC = 'NotoSansArabic.ttf'

# ألوان التطبيق الحقيقية
BG      = (12, 16, 20)
SURFACE = (28, 33, 38)
BORDER  = (54, 58, 63)
TEXT    = (245, 245, 245)
MUTED   = (168, 168, 168)
BLUE    = (0, 149, 246)
LINK    = (133, 198, 255)
GREEN   = (76, 195, 120)


def font(size, weight=400):
    f = ImageFont.truetype(os.path.join(FONTS, ARABIC), size)
    try:
        f.set_variation_by_axes([weight, 100])   # [wght, wdth] — الترتيب حسب fvar
    except Exception:
        pass
    return f


def bold(size):
    return font(size, 700)


def regular(size):
    return font(size, 400)


def ar(s):
    # base_dir='R' ضروري: الجمل التي تبدأ بكلمة لاتينية (PDF, Google) تنقلب رأسًا على عقب
    return get_display(arabic_reshaper.reshape(s), base_dir='R')


def text(d, xy, s, f, fill, anchor='mm', rtl=True):
    d.text(xy, ar(s) if rtl else s, font=f, fill=fill, anchor=anchor)


def check(d, cx, cy, r=20, col=None):
    """دائرة زرقاء بعلامة صح بدل النقطة المجرّدة."""
    col = col or BLUE
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    w = max(3, r // 4)
    d.line([cx - r * 0.42, cy, cx - r * 0.08, cy + r * 0.36], fill=BG, width=w)
    d.line([cx - r * 0.08, cy + r * 0.36, cx + r * 0.44, cy - r * 0.34], fill=BG, width=w)


def background():
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(12 - 6 * t), int(16 - 7 * t), int(20 - 7 * t)))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(640, 0, -14):
        a = int(14 * (1 - i / 640) ** 2)
        gd.ellipse([W // 2 - i, 300 - i * .7, W // 2 + i, 300 + i * .7], fill=(0, 149, 246, a))
    return Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB')


def box(d, xy, r, fill=None, outline=None, w=2):
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=w)


def logo(img, size=280, cy=440):
    src = Image.open(os.path.join(ROOT, 'public', 'mascot.png')).convert('RGBA')
    src = src.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
    img.paste(src, (W // 2 - size // 2, cy - size // 2), mask)


# ------------------------------------------------------------------ 1
def shot_1():
    img = background()
    d = ImageDraw.Draw(img)
    logo(img, 300, 430)

    text(d, (W // 2, 690), 'NEXORA AI', bold(120), TEXT, rtl=False)
    text(d, (W // 2, 800), 'مساحتك للإبداع والمعرفة', regular(58), LINK)

    y0 = 1010
    box(d, [80, y0, W - 80, y0 + 620], 40, fill=SURFACE, outline=BORDER)
    rows = [
        ('محادثة ذكية متعددة اللغات', 'نصًا وصوتًا'),
        ('توليد الصور بالذكاء الاصطناعي', 'من وصف بسيط'),
        ('ترجمة وتلخيص وتحليل الملفات', 'عربي · إنجليزي · فرنسي'),
    ]
    yy = y0 + 130
    for title, sub in rows:
        check(d, 172, yy, 24)
        text(d, (W - 200, yy - 22), title, bold(44), TEXT, anchor='rm')
        text(d, (W - 200, yy + 40), sub, regular(34), MUTED, anchor='rm')
        yy += 180

    text(d, (W // 2, 1790), 'مجاني · بلا اشتراك', regular(44), MUTED)
    return img


# ------------------------------------------------------------------ 2
def shot_2():
    img = background()
    d = ImageDraw.Draw(img)

    text(d, (W // 2, 130), 'محادثة ذكية تفهمك', bold(76), TEXT)
    text(d, (W // 2, 225), 'اسأل بأي لغة · ردّ فوري · صوت ونص', regular(42), LINK)

    px, py, pw, ph = 80, 320, W - 160, 1400
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # ترويسة
    d.ellipse([px + 40, py + 40, px + 112, py + 112], fill=SURFACE, outline=BORDER)
    text(d, (px + 136, py + 58), 'NEXORA AI', bold(40), TEXT, anchor='lm', rtl=False)
    text(d, (px + 136, py + 104), 'متصل الآن', regular(28), GREEN, anchor='lm')
    d.line([px + 40, py + 140, px + pw - 40, py + 140], fill=BORDER, width=2)

    # فقاعات
    msgs = [
        ('ما فكرة مشروع ناشئ في التعليم؟', False),
        ('ثلاث أفكار قابلة للتنفيذ:\n١. مساعد مراجعة صوتي للطلاب\n٢. منصة تدريب على المقابلات\n٣. تلخيص محاضرات تلقائي', True),
        ('اشرح الفكرة الثانية باختصار', False),
    ]
    by = py + 190
    for body, mine in msgs:
        lines = body.split('\n')
        bh = 56 + 52 * len(lines)
        if mine:
            b = [px + 140, by, px + pw - 40, by + bh]
            fill, col, tx, anc = SURFACE, TEXT, px + pw - 76, 'rm'
        else:
            b = [px + 40, by, px + pw - 170, by + bh]
            fill, col, tx, anc = BLUE, (255, 255, 255), px + 76, 'lm'
        box(d, b, 26, fill=fill)
        ly = by + 34
        for ln in lines:
            text(d, (tx, ly), ln, regular(35), col, anchor=anc)
            ly += 52
        by += bh + 36

    # اقتراحات جاهزة تملأ المساحة (كما في التطبيق)
    chips = ['اكتب لي بريدًا رسميًا', 'لخّص هذا النص', 'صحّح لغتي الإنجليزية', 'فكرة اسم لمشروع']
    cy = by + 30
    for i, c in enumerate(chips):
        col_x = px + pw - 40 if i % 2 == 0 else px + 40
        wide = 470
        x0 = col_x - wide if i % 2 == 0 else col_x
        box(d, [x0, cy, x0 + wide, cy + 88], 44, fill=(20, 26, 32), outline=BORDER)
        text(d, (x0 + wide - 34, cy + 44), c, regular(32), TEXT, anchor='rm')
        if i % 2 == 1:
            cy += 110

    # حقل الإدخال
    iy = py + ph - 150
    box(d, [px + 40, iy, px + pw - 40, iy + 96], 48, fill=SURFACE, outline=BORDER)
    text(d, (px + pw - 90, iy + 48), 'اكتب رسالتك…', regular(34), MUTED, anchor='rm')
    d.ellipse([px + 58, iy + 18, px + 118, iy + 78], fill=BLUE)

    text(d, (W // 2, 1800), 'ردود بالعربية والإنجليزية والفرنسية', regular(40), MUTED)
    return img


# ------------------------------------------------------------------ 3
def icon(d, kind, cx, cy, r=46):
    """رسم أيقونات متمايزة بالمتجهات (لا صور خارجية)."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLUE)
    w = max(4, r // 8)
    if kind == 'image':
        d.rounded_rectangle([cx - 22, cy - 20, cx + 22, cy + 18], radius=5, fill=BG)
        d.ellipse([cx - 16, cy - 14, cx - 6, cy - 4], fill=BLUE)
        d.polygon([(cx - 18, cy + 14), (cx - 2, cy - 4), (cx + 10, cy + 8), (cx + 18, cy + 14)], fill=BLUE)
    elif kind == 'translate':
        text(d, (cx, cy - 10), 'أ', bold(38), BG)
        d.line([cx - 20, cy + 12, cx + 20, cy + 12], fill=BG, width=w)
    elif kind == 'file':
        d.rounded_rectangle([cx - 16, cy - 22, cx + 16, cy + 20], radius=4, fill=BG)
        for i in range(3):
            d.line([cx - 9, cy - 10 + i * 10, cx + 9, cy - 10 + i * 10], fill=BLUE, width=3)
    elif kind == 'voice':
        heights = [10, 20, 30, 18, 8]
        for i, hgt in enumerate(heights):
            x = cx - 24 + i * 12
            d.line([x, cy - hgt, x, cy + hgt], fill=BG, width=6)


def shot_3():
    img = background()
    d = ImageDraw.Draw(img)

    text(d, (W // 2, 140), 'أدوات إبداعية في تطبيق واحد', bold(62), TEXT)
    text(d, (W // 2, 232), 'لا تحتاج تطبيقًا آخر بعد اليوم', regular(40), LINK)

    tw, th, gap = 460, 600, 44
    left = (W - (tw * 2 + gap)) // 2
    tiles = [
        ('image', 'توليد الصور', 'اكتب وصفًا واحصل على صورة', True, 340),
        ('translate', 'ترجمة فورية', 'عربي وإنجليزي وفرنسي', False, 340),
        ('file', 'تحليل الملفات', 'مستندات وصور و PDF', True, 1000),
        ('voice', 'محادثة صوتية', 'تحدّث ويجيبك بصوت', False, 1000),
    ]
    for kind, title, sub, is_left, y0 in tiles:
        x0 = left if is_left else left + tw + gap
        box(d, [x0, y0, x0 + tw, y0 + th], 36, fill=SURFACE, outline=BORDER)
        cx = x0 + tw // 2
        icon(d, kind, cx, y0 + 110)
        text(d, (cx, y0 + 250), title, bold(46), TEXT)
        text(d, (cx, y0 + 318), sub, regular(31), MUTED)
        # شريط معاينة داخل البطاقة يوحي بالواجهة
        pv = [x0 + 40, y0 + 400, x0 + tw - 40, y0 + th - 46]
        box(d, pv, 18, fill=(20, 26, 32), outline=(44, 49, 55))
        if kind == 'image':
            # مصغّرة صورة مولّدة: تدرّج غروب + قرص شمس + أرضية
            thumb = [pv[0] + 16, pv[1] + 14, pv[2] - 16, pv[3] - 14]
            for yy in range(thumb[1], thumb[3]):
                t = (yy - thumb[1]) / max(1, thumb[3] - thumb[1])
                d.line([(thumb[0], yy), (thumb[2], yy)],
                       fill=(int(30 + 130 * t), int(40 + 55 * t), int(90 - 30 * t)))
            cy_sun = thumb[1] + int((thumb[3] - thumb[1]) * 0.52)
            d.ellipse([(thumb[0] + thumb[2]) // 2 - 34, cy_sun - 34,
                       (thumb[0] + thumb[2]) // 2 + 34, cy_sun + 34], fill=(255, 214, 150))
            d.polygon([(thumb[0], thumb[3]), (thumb[0] + 90, thumb[3] - 70),
                       (thumb[0] + 170, thumb[3])], fill=(22, 30, 42))
            d.polygon([(thumb[0] + 110, thumb[3]), (thumb[0] + 200, thumb[3] - 96),
                       (thumb[2], thumb[3])], fill=(16, 22, 32))
        elif kind == 'translate':
            text(d, (pv[2] - 20, pv[1] + 28), 'أهلًا بك', regular(30), TEXT, anchor='rm')
            text(d, (pv[0] + 20, pv[3] - 28), 'Welcome', regular(30), LINK, anchor='lm', rtl=False)
        elif kind == 'file':
            for i in range(2):
                yy = pv[1] + 18 + i * 46
                d.rounded_rectangle([pv[0] + 16, yy, pv[0] + 52, yy + 34], radius=5, fill=BLUE)
                text(d, (pv[2] - 20, yy + 17), 'مستند ' + ('الأول' if i == 0 else 'الثاني'),
                     regular(26), MUTED, anchor='rm')
        elif kind == 'voice':
            mid = (pv[1] + pv[3]) // 2
            bars = [10, 22, 34, 20, 40, 24, 14]
            span = 44
            x_start = (pv[0] + pv[2]) // 2 - (len(bars) - 1) * span // 2
            for i, hgt in enumerate(bars):
                x = x_start + i * span
                d.line([x, mid - hgt, x, mid + hgt], fill=BLUE, width=9)

    text(d, (W // 2, 1790), 'كل أدواتك في مكان واحد', regular(42), MUTED)
    return img


# ------------------------------------------------------------------ 4
def shot_4():
    img = background()
    d = ImageDraw.Draw(img)
    logo(img, 230, 400)

    text(d, (W // 2, 600), 'حسابك محفوظ وآمن', bold(78), TEXT)
    text(d, (W // 2, 700), 'محادثاتك وملفاتك تبقى لك وحدك', regular(46), LINK)

    y0 = 840
    box(d, [100, y0, W - 100, y0 + 460], 40, fill=SURFACE, outline=BORDER)
    rows = [
        ('دخول بالبريد أو Google أو الهاتف', 'حسب جهازك'),
        ('قفل PIN للحساب', 'اختياري'),
        ('تبديل الحسابات بسهولة', 'بلا فقدان أي محادثة'),
    ]
    yy = y0 + 100
    for title, sub in rows:
        check(d, 187, yy + 4, 24)
        text(d, (W - 175, yy - 20), title, bold(42), TEXT, anchor='rm')
        text(d, (W - 175, yy + 38), sub, regular(32), MUTED, anchor='rm')
        yy += 140

    by = 1420
    box(d, [W // 2 - 320, by, W // 2 + 320, by + 126], 63, fill=BLUE)
    text(d, (W // 2, by + 63), 'حمّل التطبيق الآن', bold(54), (255, 255, 255))
    text(d, (W // 2, 1640), 'NEXORA AI for Android · v4.4', bold(46), TEXT, rtl=False)
    text(d, (W // 2, 1720), 'مجاني بالكامل · متوافق مع Fire OS', regular(36), MUTED)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, fn in enumerate([shot_1, shot_2, shot_3, shot_4], 1):
        img = fn()
        assert img.size == (W, H)
        p = os.path.join(OUT, f'nexora-softonic-{i}-{W}x{H}.png')
        img.save(p, 'PNG', optimize=True)
        print(f'{p}  {W}x{H}  {os.path.getsize(p) // 1024} KB')
        j = p.replace('.png', '.jpg')
        img.save(j, 'JPEG', quality=94, subsampling=0, optimize=True)
        print(f'{j}  {os.path.getsize(j) // 1024} KB')


if __name__ == '__main__':
    main()
