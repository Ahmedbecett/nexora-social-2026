#!/usr/bin/env python3
"""
NEXORA AI — English store screenshots (8 images, 1080×1920).

Identity is taken verbatim from the shipped app:
  src/styles.css      -> dark theme tokens (--bg #0c1014, --surface #1c2126, --blue #0095f6, ...)
  src/ai/AIPlatform.jsx -> the six real AI tools, welcome prompts, quick actions
  src/i18n.js         -> English UI strings ("Message...", "Suggested for you", ...)
  src/version.js      -> v4.4 (matching the live deploy)
  public/mascot.png   -> the real app icon

Why rendered and not captured: Chromium cannot run in this build environment
(libnss3/libgbm/libpango missing, no root, Debian mirrors unreachable), so the
screens are drawn with the app's real colors, copy and metrics instead.

Fonts: Inter (UI/Latin) + Noto Sans Arabic (Arabic strings), both variable.
"""
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display
import os

W, H = 1080, 1920
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'store', 'softonic-en')
FONTS = '/tmp/fonts'
LATIN = 'Inter.ttf'
ARABIC = 'NotoSansArabic.ttf'

# Real dark-theme tokens from src/styles.css
BG      = (12, 16, 20)
SURFACE = (28, 33, 38)
RAISED  = (20, 26, 32)
BORDER  = (54, 58, 63)
SEP     = (37, 41, 46)
TEXT    = (245, 245, 245)
TEXT2   = (212, 214, 217)
MUTED   = (168, 168, 168)
BLUE    = (0, 149, 246)
LINK    = (133, 198, 255)
GREEN   = (76, 195, 120)


def f_latin(size, weight=400):
    f = ImageFont.truetype(os.path.join(FONTS, LATIN), size)
    try:
        f.set_variation_by_axes([size and 14 or 14, weight])   # [opsz, wght]
    except Exception:
        pass
    return f


def f_arabic(size, weight=400):
    f = ImageFont.truetype(os.path.join(FONTS, ARABIC), size)
    try:
        f.set_variation_by_axes([weight, 100])   # [wght, wdth]
    except Exception:
        pass
    return f


def L(size, weight=400):
    return f_latin(size, weight)


def rtl_text(s):
    return get_display(arabic_reshaper.reshape(s), base_dir='R')


def t(d, xy, s, font, fill, anchor='mm', rtl=False):
    d.text(xy, rtl_text(s) if rtl else s, font=font, fill=fill, anchor=anchor)


def background():
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    for y in range(H):
        k = y / H
        d.line([(0, y), (W, y)], fill=(int(12 - 6 * k), int(16 - 7 * k), int(20 - 7 * k)))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(640, 0, -14):
        a = int(13 * (1 - i / 640) ** 2)
        gd.ellipse([W // 2 - i, 250 - i * .7, W // 2 + i, 250 + i * .7], fill=(0, 149, 246, a))
    return Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB')


def box(d, xy, r, fill=None, outline=None, w=2, width=None):
    w = width or w
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=w)


def check(d, cx, cy, r=22, col=None):
    col = col or BLUE
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    w = max(4, r // 4)
    d.line([cx - r * .42, cy, cx - r * .08, cy + r * .36], fill=BG, width=w)
    d.line([cx - r * .08, cy + r * .36, cx + r * .44, cy - r * .34], fill=BG, width=w)


def logo(img, size=260, cy=400):
    src = Image.open(os.path.join(ROOT, 'public', 'mascot.png')).convert('RGBA')
    src = src.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
    img.paste(src, (W // 2 - size // 2, cy - size // 2), mask)


def nav_icons(d, y, width):
    """Bottom navigation matching the shipped tabs."""
    d.line([0, y, width, y], fill=SEP, width=2)
    labels = ['Home', 'Search', 'Create', 'Reels', 'Profile']
    step = width / (len(labels) + 1)
    for i, name in enumerate(labels):
        cx = step * (i + 1)
        if name == 'Create':
            box(d, [cx - 34, y + 28, cx + 34, y + 96], 18, outline=TEXT, width=3)
            d.line([cx - 14, y + 62, cx + 14, y + 62], fill=TEXT, width=3)
            d.line([cx, y + 48, cx, y + 76], fill=TEXT, width=3)
        elif name == 'Home':
            d.polygon([(cx, y + 30), (cx - 26, y + 58), (cx + 26, y + 58)], fill=TEXT)
            box(d, [cx - 20, y + 58, cx + 20, y + 92], 4, fill=TEXT)
        elif name == 'Search':
            d.ellipse([cx - 24, y + 30, cx + 12, y + 66], outline=TEXT, width=4)
            d.line([cx + 10, y + 64, cx + 28, y + 88], fill=TEXT, width=5)
        elif name == 'Reels':
            box(d, [cx - 26, y + 26, cx + 26, y + 92], 12, outline=TEXT, width=3)
            d.polygon([(cx - 6, y + 46), (cx + 16, y + 59), (cx - 6, y + 72)], fill=TEXT)
        else:
            d.ellipse([cx - 18, y + 30, cx + 18, y + 66], outline=TEXT, width=3)
            d.arc([cx - 30, y + 60, cx + 30, y + 112], 180, 360, fill=TEXT, width=4)


# ------------------------------------------------------------------ 1 Brand
def shot_1():
    img = background()
    d = ImageDraw.Draw(img)
    logo(img, 300, 430)
    t(d, (W // 2, 700), 'NEXORA AI', L(118, 800), TEXT)
    t(d, (W // 2, 800), 'Your space to create and know', L(50, 400), LINK)

    y0 = 1000
    box(d, [80, y0, W - 80, y0 + 640], 40, fill=SURFACE, outline=BORDER)
    rows = [
        ('Six AI tools, one app', 'Chat, images, writing, code'),
        ('Arabic, English and French', 'Replies in your language'),
        ('Free, no subscription', 'No credit card, no trial limits'),
    ]
    yy = y0 + 135
    for title, sub in rows:
        check(d, 168, yy, 26)                       # icon column, left
        t(d, (250, yy - 26), title, L(44, 700), TEXT, anchor='lm')
        t(d, (250, yy + 40), sub, L(32, 400), MUTED, anchor='lm')
        yy += 195

    t(d, (W // 2, 1790), 'Android · Fire OS · v4.4', L(44, 600), MUTED)
    return img


# ------------------------------------------------------------------ 2 Chat
def shot_2():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 130), 'An AI that gets you', L(80, 800), TEXT)
    t(d, (W // 2, 228), 'Ask anything · instant answers · voice and text', L(38, 400), LINK)

    px, py, pw, ph = 80, 320, W - 160, 1400
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # header
    d.ellipse([px + 40, py + 40, px + 112, py + 112], fill=SURFACE, outline=BORDER, width=2)
    t(d, (px + 136, py + 58), 'NEXORA AI', L(40, 700), TEXT, anchor='lm')
    t(d, (px + 136, py + 104), 'On Nexora', L(28, 500), GREEN, anchor='lm')
    d.line([px + 40, py + 142, px + pw - 40, py + 142], fill=SEP, width=2)

    # LTR chat: assistant on the left, the user on the right
    msgs = [
        ('Startup ideas for education?', 'user'),
        ('Three you can ship:\n1. Voice revision coach\n2. Interview practice app\n3. Auto lecture summaries', 'ai'),
        ('Explain the second one briefly', 'user'),
        ('A mock-interview trainer: it asks\nrole questions and scores answers.', 'ai'),
    ]
    by = py + 190
    for body, who in msgs:
        lines = body.split('\n')
        bh = 58 + 54 * len(lines)
        if who == 'user':
            b = [px + pw - 60 - 620, by, px + pw - 60, by + bh]
            fill, col, tx, anc = BLUE, (255, 255, 255), b[0] + 30, 'lm'
        else:
            b = [px + 60, by, px + 60 + 620, by + bh]
            fill, col, tx, anc = SURFACE, TEXT, b[0] + 30, 'lm'
        box(d, b, 26, fill=fill)
        ly = by + 38
        for ln in lines:
            t(d, (tx, ly), ln, L(31, 400), col, anchor='lm')
            ly += 54
        by += bh + 34

    # welcome prompts — two columns, no overlap
    chips = ['Write a catchy post', 'Help me with code', 'Translate a text', 'Create an image']
    gap = 24
    cw = (pw - 80 - gap) // 2
    cy = by + 24
    for i, c in enumerate(chips):
        x0 = px + 40 + (cw + gap) * (i % 2)
        box(d, [x0, cy, x0 + cw, cy + 88], 44, fill=RAISED, outline=BORDER)
        t(d, (x0 + 30, cy + 44), c, L(29, 500), TEXT2, anchor='lm')
        if i % 2 == 1:
            cy += 110

    # input row
    iy = py + ph - 150
    box(d, [px + 40, iy, px + pw - 40, iy + 96], 48, fill=SURFACE, outline=BORDER)
    t(d, (px + 96, iy + 48), 'Message...', L(34, 400), MUTED, anchor='lm')
    d.ellipse([px + pw - 118, iy + 18, px + pw - 58, iy + 78], fill=BLUE)
    t(d, (W // 2, 1800), 'Replies in Arabic, English and French', L(40, 400), MUTED)
    return img


# ------------------------------------------------------------------ 3 Tools
def tool_icon(d, kind, cx, cy, r=46):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLUE)
    w = max(4, r // 8)
    if kind == 'image':
        d.rounded_rectangle([cx - 22, cy - 20, cx + 22, cy + 18], radius=5, fill=BG)
        d.ellipse([cx - 16, cy - 14, cx - 6, cy - 4], fill=BLUE)
        d.polygon([(cx - 18, cy + 14), (cx - 2, cy - 4), (cx + 10, cy + 8), (cx + 18, cy + 14)], fill=BLUE)
    elif kind == 'write':
        d.line([cx - 16, cy + 16, cx + 12, cy - 12], fill=BG, width=w + 2)
        d.polygon([(cx + 16, cy - 16), (cx + 22, cy - 22), (cx + 20, cy - 10)], fill=BG)
        d.line([cx - 20, cy + 22, cx + 4, cy + 22], fill=BG, width=w)
    elif kind == 'code':
        t(d, (cx, cy), '</>', L(34, 700), BG)
    elif kind == 'translate':
        t(d, (cx, cy - 2), 'A', L(36, 700), BG)
        t(d, (cx, cy + 26), 'ب', f_arabic(26, 700), BG)
    elif kind == 'summarize':
        for i, ln in enumerate([28, 20, 28, 16]):
            y = cy - 18 + i * 12
            d.line([cx - 20, y, cx - 20 + ln, y], fill=BG, width=4)
    elif kind == 'chat':
        d.rounded_rectangle([cx - 24, cy - 20, cx + 24, cy + 12], radius=8, fill=BG)
        d.polygon([(cx - 8, cy + 12), (cx - 2, cy + 24), (cx + 4, cy + 12)], fill=BG)


def shot_3():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 132), 'Six AI tools. One app.', L(76, 800), TEXT)
    t(d, (W // 2, 224), 'Chat · Images · Writing · Code · Translate · Summaries', L(36, 400), LINK)

    # grid 2 x 3 — the real tools from AIPlatform.jsx
    tw, th, gap = 462, 400, 36
    left = (W - (tw * 2 + gap)) // 2
    tiles = [
        ('chat', 'Chat', 'Ask and explore ideas'),
        ('image', 'Images', 'Turn a description into art'),
        ('write', 'Writing', 'Posts, essays, captions'),
        ('code', 'Code', 'Write and improve code'),
        ('translate', 'Translate', 'Accurate, natural results'),
        ('summarize', 'Summaries', 'Pull out the key points'),
    ]
    for i, (kind, title, sub) in enumerate(tiles):
        col, row = i % 2, i // 2
        x0 = left + col * (tw + gap)
        y0 = 330 + row * (th + gap)
        box(d, [x0, y0, x0 + tw, y0 + th], 34, fill=SURFACE, outline=BORDER)
        tool_icon(d, kind, x0 + tw // 2, y0 + 110, 50)
        t(d, (x0 + tw // 2, y0 + 225), title, L(46, 700), TEXT)
        t(d, (x0 + tw // 2, y0 + 290), sub, L(29, 400), MUTED)

    t(d, (W // 2, 1790), 'No extra apps. No extra accounts.', L(40, 400), MUTED)
    return img


# ------------------------------------------------------------------ 4 Image generation
def shot_4():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 140), 'Create images\nwith a sentence', L(64, 800), TEXT, anchor='ma')
    t(d, (W // 2, 340), 'Describe it. Pick a style. Done.', L(38, 400), LINK)

    px, py, pw = 80, 420, W - 160
    box(d, [px, py, px + pw, py + 1240], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # prompt field
    box(d, [px + 40, py + 40, px + pw - 40, py + 152], 28, fill=SURFACE, outline=BORDER)
    t(d, (px + 70, py + 78), 'A futuristic city at night, purple', L(30, 400), TEXT2, anchor='lm')
    t(d, (px + 70, py + 120), 'and blue light, cinematic', L(30, 400), TEXT2, anchor='lm')
    box(d, [px + pw - 210, py + 68, px + pw - 66, py + 132], 32, fill=BLUE)
    t(d, (px + pw - 138, py + 100), 'Generate', L(28, 700), (255, 255, 255))

    # generated image preview (drawn, so it is original artwork)
    ix0, iy0, ix1, iy1 = px + 40, py + 190, px + pw - 40, py + 900
    for yy in range(iy0, iy1):
        k = (yy - iy0) / (iy1 - iy0)
        d.line([(ix0, yy), (ix1, yy)],
               fill=(int(18 + 40 * k), int(14 + 26 * k), int(46 + 70 * k)))
    # neon skyline
    bars = [(0.06, .28), (.14, .44), (.22, .20), (.30, .52), (.40, .34),
            (.49, .60), (.58, .38), (.67, .50), (.76, .26), (.85, .42)]
    for fx, fh in bars:
        bx = ix0 + int((ix1 - ix0) * fx)
        bw = 62
        top = iy0 + int((iy1 - iy0) * (1 - fh))
        d.rectangle([bx, top, bx + bw, iy1], fill=(12, 16, 26))
        for r in range(4):
            for c in range(3):
                wx = bx + 10 + c * 18
                wy = top + 18 + r * 26
                if wy < iy1 - 10:
                    d.rectangle([wx, wy, wx + 8, wy + 10], fill=(120, 200, 255))
    # moon / glow
    d.ellipse([ix1 - 190, iy0 + 70, ix1 - 60, iy0 + 200], fill=(210, 225, 255))
    # foreground reflection
    d.rectangle([ix0, iy1 - 60, ix1, iy1], fill=(6, 8, 14))
    t(d, (ix0 + 24, iy1 - 30), '1024 × 1024', L(24, 600), LINK, anchor='lm')

    # style / ratio / model chips (real labels from i18n)
    labels = ['Style', 'Ratio', 'Model', 'High quality']
    cx = px + 40
    for i, lb in enumerate(labels):
        wid = 190 if i < 3 else 250
        box(d, [cx, py + 950, cx + wid, py + 1030], 40, fill=RAISED, outline=BORDER)
        t(d, (cx + wid // 2, py + 990), lb, L(28, 500), TEXT2)
        cx += wid + 20

    t(d, (px + pw // 2, py + 1140), 'Fast model or high quality — your choice', L(30, 400), MUTED)
    t(d, (W // 2, 1760), 'Every image is generated for you', L(40, 400), MUTED)
    return img


# ------------------------------------------------------------------ 5 Translation
def shot_5():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 140), 'Translate without\nlosing meaning', L(64, 800), TEXT, anchor='ma')
    t(d, (W // 2, 340), 'Arabic, English and French — instantly', L(38, 400), LINK)

    px, py, pw = 80, 420, W - 160
    box(d, [px, py, px + pw, py + 1180], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # language pair header
    box(d, [px + 40, py + 40, px + pw - 40, py + 130], 26, fill=SURFACE, outline=BORDER)
    t(d, (px + 90, py + 85), 'Arabic', L(34, 700), TEXT, anchor='lm')
    t(d, (px + pw // 2, py + 85), '→', L(38, 700), BLUE)
    t(d, (px + pw - 90, py + 85), 'English', L(34, 700), TEXT, anchor='rm')

    # source card (Arabic — needs the shaper)
    box(d, [px + 40, py + 165, px + pw - 40, py + 480], 30, fill=RAISED, outline=BORDER)
    t(d, (px + pw - 80, py + 230), 'مساحتك للإبداع والمعرفة', f_arabic(46, 600), TEXT, anchor='rm', rtl=True)
    t(d, (px + pw - 80, py + 310), 'ست أدوات ذكاء اصطناعي في تطبيق واحد،', f_arabic(34, 400), TEXT2, anchor='rm', rtl=True)
    t(d, (px + pw - 80, py + 368), 'تكتب وتصمم وتترجم وتلخص.', f_arabic(34, 400), TEXT2, anchor='rm', rtl=True)

    # result card
    box(d, [px + 40, py + 510, px + pw - 40, py + 800], 30, fill=SURFACE, outline=BLUE)
    t(d, (px + 80, py + 575), 'Your space to create and know', L(42, 700), TEXT, anchor='lm')
    t(d, (px + 80, py + 645), 'Six AI tools in one app. Write, design,', L(32, 400), TEXT2, anchor='lm')
    t(d, (px + 80, py + 700), 'translate and summarise.', L(32, 400), TEXT2, anchor='lm')

    for i, lb in enumerate(['Copy', 'Share', 'Speak']):
        x0 = px + 40 + i * 250
        box(d, [x0, py + 850, x0 + 220, py + 930], 40, fill=RAISED, outline=BORDER)
        t(d, (x0 + 110, py + 890), lb, L(30, 500), TEXT2)

    t(d, (px + pw // 2, py + 1040), 'Works both directions, keeps the meaning', L(32, 400), MUTED)
    t(d, (W // 2, 1740), 'Natural translation, not word-for-word', L(40, 400), MUTED)
    return img


# ------------------------------------------------------------------ 6 Social feed
def shot_6():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 120), 'More than an AI chat', L(76, 800), TEXT)
    t(d, (W // 2, 212), 'A social space built in — posts, reels, stories', L(36, 400), LINK)

    px, py, pw, ph = 70, 300, W - 140, 1450
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # app bar
    t(d, (px + 40, py + 60), 'Nexora', L(46, 800), TEXT, anchor='lm')
    d.ellipse([px + pw - 120, py + 26, px + pw - 40, py + 106], fill=SURFACE, outline=BORDER, width=2)
    d.line([px + 40, py + 130, px + pw - 40, py + 130], fill=SEP, width=2)

    # stories row
    names = ['Your story', 'sara', 'omar', 'layla', 'zayn']
    sx = px + 60
    for i, nm in enumerate(names):
        d.ellipse([sx, py + 168, sx + 108, py + 276], outline=BLUE if i else SEP, width=4)
        d.ellipse([sx + 14, py + 182, sx + 94, py + 262], fill=(30, 36, 44))
        t(d, (sx + 54, py + 300), nm, L(22, 500), TEXT2)
        sx += 130

    # a post card
    post_y = py + 360
    d.ellipse([px + 44, post_y, px + 116, post_y + 72], fill=SURFACE, outline=BLUE, width=2)
    t(d, (px + 132, post_y + 22), 'nexora', L(30, 700), TEXT, anchor='lm')
    t(d, (px + 132, post_y + 58), 'Sponsored · AI', L(22, 400), MUTED, anchor='lm')
    t(d, (px + pw - 50, post_y + 34), '•••', L(30, 700), MUTED, anchor='rm')

    # post media (drawn gradient art)
    mx0, my0, mx1, my1 = px + 40, post_y + 100, px + pw - 40, post_y + 640
    for yy in range(my0, my1):
        k = (yy - my0) / (my1 - my0)
        d.line([(mx0, yy), (mx1, yy)],
               fill=(int(26 + 60 * k), int(30 + 20 * k), int(70 + 90 * k)))
    d.ellipse([mx0 + 120, my0 + 130, mx0 + 330, my0 + 340], fill=(255, 214, 150))
    d.polygon([(mx0, my1), (mx0 + 200, my0 + 300), (mx0 + 420, my1)], fill=(18, 24, 34))
    d.polygon([(mx0 + 260, my1), (mx0 + 470, my0 + 360), (mx1, my1)], fill=(12, 16, 26))
    t(d, (mx1 - 24, my1 - 30), 'Made with NEXORA AI', L(24, 600), (255, 255, 255), anchor='rm')

    # actions
    ay = post_y + 690
    d.ellipse([px + 44, ay, px + 96, ay + 52], outline=TEXT, width=3)   # heart
    d.ellipse([px + 120, ay, px + 172, ay + 52], outline=TEXT, width=3)  # comment
    d.polygon([(px + 200, ay + 34), (px + 232, ay), (px + 252, ay + 34)], outline=TEXT, width=3)
    t(d, (px + 44, ay + 100), '1,248 likes', L(28, 700), TEXT, anchor='lm')
    t(d, (px + 44, ay + 152), 'nexora  Six tools, one app. Link in bio.', L(27, 400), TEXT2, anchor='lm')

    nav_icons(d, py + ph - 118, px + pw)
    t(d, (W // 2, 1800), 'Feed, reels, stories and messages', L(40, 400), MUTED)
    return img


# ------------------------------------------------------------------ 7 Composer / ChatKit
def shot_7():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 130), 'Express yourself in chat', L(72, 800), TEXT)
    t(d, (W // 2, 226), 'Stickers, GIFs, cutouts and drawings', L(36, 400), LINK)

    px, py, pw, ph = 80, 320, W - 160, 1330
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    t(d, (px + pw // 2, py + 58), 'sara', L(36, 700), TEXT)
    d.line([px + 40, py + 104, px + pw - 40, py + 104], fill=SEP, width=2)

    # LTR: incoming left, outgoing right (no emoji — Inter has no emoji glyphs)
    msgs = [('Hey! Did you try the new AI tools?', False),
            ('Yes — the image one is wild', True),
            ('Send me a sticker!', False),
            ('Picking one now…', True)]
    by = py + 150
    for body, mine in msgs:
        bw = int(len(body) * 16.5) + 66
        if mine:
            b = [px + pw - 60 - bw, by, px + pw - 60, by + 86]
            fill, col = BLUE, (255, 255, 255)
        else:
            b = [px + 60, by, px + 60 + bw, by + 86]
            fill, col = SURFACE, TEXT
        box(d, b, 26, fill=fill)
        t(d, (b[0] + 30, by + 43), body, L(28, 400), col, anchor='lm')
        by += 106

    # sticker drawer — two clean rows
    drawer_y = py + 660
    d.line([px + 40, drawer_y, px + pw - 40, drawer_y], fill=SEP, width=2)
    t(d, (px + 60, drawer_y + 48), 'Stickers', L(28, 700), TEXT2, anchor='lm')
    box(d, [px + 230, drawer_y + 24, px + 382, drawer_y + 76], 26, fill=RAISED, outline=BORDER)
    t(d, (px + 306, drawer_y + 50), 'Cutouts', L(24, 600), LINK)
    box(d, [px + 402, drawer_y + 24, px + 540, drawer_y + 76], 26, fill=RAISED, outline=BORDER)
    t(d, (px + 471, drawer_y + 50), 'GIFs', L(24, 600), LINK)

    gy = drawer_y + 116
    for r in range(2):
        for c in range(4):
            x0 = px + 60 + c * 213
            y0 = gy + r * 132
            box(d, [x0, y0, x0 + 183, y0 + 110], 20, fill=RAISED, outline=BORDER)
            kind = (r + c) % 3
            if kind == 0:
                d.ellipse([x0 + 61, y0 + 25, x0 + 123, y0 + 87], fill=BLUE)
            elif kind == 1:
                d.polygon([(x0 + 92, y0 + 24), (x0 + 134, y0 + 84), (x0 + 50, y0 + 84)], fill=(255, 176, 88))
            else:
                d.rounded_rectangle([x0 + 54, y0 + 26, x0 + 128, y0 + 84], radius=14, fill=(160, 120, 255))

    # input row, clear of the grid
    iy = py + ph - 132
    box(d, [px + 40, iy, px + pw - 40, iy + 92], 46, fill=SURFACE, outline=BORDER)
    t(d, (px + 92, iy + 46), 'Message...', L(30, 400), MUTED, anchor='lm')
    t(d, (px + pw - 66, iy + 46), 'Send', L(30, 700), BLUE, anchor='rm')

    t(d, (W // 2, 1760), 'Make your chats yours', L(42, 400), MUTED)
    return img


# ------------------------------------------------------------------ 8 Download
def shot_8():
    img = background()
    d = ImageDraw.Draw(img)
    logo(img, 230, 380)
    t(d, (W // 2, 580), 'Free. Private. Yours.', L(76, 800), TEXT)
    t(d, (W // 2, 680), 'Your chats stay on your account — unlock with a PIN', L(38, 400), LINK)

    y0 = 810
    box(d, [100, y0, W - 100, y0 + 450], 40, fill=SURFACE, outline=BORDER)
    rows = [
        ('Log in with email or Google', 'Whichever works for you'),
        ('PIN lock on the account', 'Optional'),
        ('Switch accounts in a tap', 'Nothing is lost'),
    ]
    yy = y0 + 100
    for title, sub in rows:
        check(d, 172, yy + 4, 26)
        t(d, (W - 175, yy - 18), title, L(42, 700), TEXT, anchor='rm')
        t(d, (W - 175, yy + 42), sub, L(31, 400), MUTED, anchor='rm')
        yy += 140

    by = 1370
    box(d, [W // 2 - 330, by, W // 2 + 330, by + 130], 65, fill=BLUE)
    t(d, (W // 2, by + 65), 'Download for Android', L(50, 700), (255, 255, 255))
    t(d, (W // 2, 1600), 'NEXORA AI for Android · v4.4', L(46, 700), TEXT)
    t(d, (W // 2, 1690), 'APK · 13.8 MB · Android 6+ and Fire OS', L(34, 400), MUTED)
    t(d, (W // 2, 1770), 'nexora-social-2026.vercel.app', L(34, 600), LINK)
    return img



# ------------------------------------------------------------------ 9 Settings
def shot_9():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 130), 'Make it yours', L(80, 800), TEXT)
    t(d, (W // 2, 226), 'Language, theme, privacy and account — all in one place', L(34, 400), LINK)

    px, py, pw, ph = 70, 320, W - 140, 1330
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # header
    t(d, (px + 44, py + 62), 'Settings and activity', L(40, 700), TEXT, anchor='lm')
    d.line([px + 40, py + 110, px + pw - 40, py + 110], fill=SEP, width=2)

    # profile row
    d.ellipse([px + 44, py + 140, px + 156, py + 252], fill=SURFACE, outline=BLUE, width=3)
    t(d, (px + 180, py + 176), 'ahmed_becetti', L(34, 700), TEXT, anchor='lm')
    t(d, (px + 180, py + 224), 'View profile', L(26, 400), MUTED, anchor='lm')
    t(d, (px + pw - 50, py + 196), '>', L(34, 700), MUTED, anchor='rm')

    # grouped rows — real labels from Settings.jsx
    groups = [
        ('Preferences', [
            ('Language', 'English'),
            ('Theme', 'Dark'),
            ('Notifications', 'On'),
        ]),
        ('Privacy', [
            ('Private account', 'Off'),
            ('Privacy Center', ''),
        ]),
        ('Account', [
            ('Security', ''),
            ('Account Status', ''),
            ('Help', ''),
        ]),
    ]
    gy = py + 300
    for gi, (title, rows) in enumerate(groups):
        t(d, (px + 44, gy), title.upper(), L(22, 700), MUTED, anchor='lm')
        gy += 26
        box(d, [px + 40, gy, px + pw - 40, gy + len(rows) * 92 + 20], 24, fill=SURFACE, outline=BORDER)
        ry = gy + 56
        for label, value in rows:
            t(d, (px + 72, ry), label, L(29, 500), TEXT, anchor='lm')
            if value:
                t(d, (px + pw - 84, ry), value, L(26, 400), MUTED, anchor='rm')
            t(d, (px + pw - 60, ry), '>', L(26, 700), MUTED, anchor='rm')
            ry += 92
        gy += len(rows) * 92 + 40

    t(d, (W // 2, 1760), 'Nexora · Version 4.4.0', L(38, 400), MUTED)
    return img


# ------------------------------------------------------------------ 10 Personal AI
def shot_10():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 130), 'An AI with your context', L(74, 800), TEXT)
    t(d, (W // 2, 226), 'It remembers the conversation and keeps it saved', L(36, 400), LINK)

    px, py, pw, ph = 80, 330, W - 160, 1300
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # sidebar-style workspace label
    t(d, (px + 44, py + 56), 'WORKSPACE', L(20, 700), MUTED, anchor='lm')
    t(d, (px + 44, py + 116), '+  New chat', L(30, 700), BLUE, anchor='lm')
    d.line([px + 40, py + 160, px + pw - 40, py + 160], fill=SEP, width=2)

    items = [('Smart chat', True), ('Images', False), ('Writing', False),
             ('Code', False), ('Translation', False), ('Summaries', False)]
    iy = py + 205
    for label, active in items:
        if active:
            box(d, [px + 34, iy - 34, px + pw - 34, iy + 34], 18, fill=RAISED, outline=BORDER)
        t(d, (px + 60, iy), ('*  ' if active else '   ') + label, L(28, 700 if active else 400),
          TEXT if active else TEXT2, anchor='lm')
        iy += 84

    # saved-chat cards, with room above for the label
    d.line([px + 40, py + 742, px + pw - 40, py + 742], fill=SEP, width=2)
    t(d, (px + 44, py + 796), 'SAVED CHATS', L(20, 700), MUTED, anchor='lm')
    chats = [('Startup ideas list', '2h'), ('Trip plan — Lisbon', 'Yesterday'),
             ('Fix my CSS grid', '2 days'), ('Voice notes transcript', 'Last week')]
    cy = py + 872
    for title, when in chats:
        box(d, [px + 34, cy - 46, px + pw - 34, cy + 46], 20, fill=SURFACE, outline=BORDER)
        t(d, (px + 64, cy), title, L(27, 500), TEXT2, anchor='lm')
        t(d, (px + pw - 64, cy), when, L(23, 400), MUTED, anchor='rm')
        cy += 106

    t(d, (W // 2, 1760), 'Nothing is lost between sessions', L(40, 400), MUTED)
    return img


# ------------------------------------------------------------------ 11 Search
def shot_11():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 130), 'Find anything fast', L(78, 800), TEXT)
    t(d, (W // 2, 226), 'People, tags and posts — with AI search built in', L(34, 400), LINK)

    px, py, pw, ph = 70, 320, W - 140, 1330
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # search field
    box(d, [px + 40, py + 40, px + pw - 40, py + 132], 46, fill=SURFACE, outline=BORDER)
    d.ellipse([px + 66, py + 66, px + 108, py + 108], outline=MUTED, width=4)
    d.line([px + 104, py + 104, px + 122, py + 122], fill=MUTED, width=5)
    t(d, (px + 140, py + 86), 'ai tools', L(32, 400), TEXT, anchor='lm')

    # tabs
    tabs = ['For you', 'Accounts', 'Tags', 'Reels']
    tx = px + 44
    for i, tab in enumerate(tabs):
        active = i == 0
        tw = 150 if len(tab) < 8 else 170
        if active:
            box(d, [tx, py + 172, tx + tw, py + 236], 32, fill=BLUE)
            t(d, (tx + tw // 2, py + 204), tab, L(26, 700), (255, 255, 255))
        else:
            box(d, [tx, py + 172, tx + tw, py + 236], 32, fill=RAISED, outline=BORDER)
            t(d, (tx + tw // 2, py + 204), tab, L(26, 500), TEXT2)
        tx += tw + 20

    # result grid 3 x 2, sized to fit above the AI strip
    gx0, gy0 = px + 44, py + 280
    gap = 12
    cell = (pw - 88 - gap * 2) // 3
    for r in range(2):
        for c in range(3):
            x0 = gx0 + c * (cell + gap)
            y0 = gy0 + r * (cell + gap)
            k = (r * 3 + c) / 6
            d.rectangle([x0, y0, x0 + cell, y0 + cell],
                        fill=(int(24 + 60 * k), int(30 + 30 * k), int(70 + 80 * k)))
            if (r + c) % 3 == 0:
                d.ellipse([x0 + cell * .28, y0 + cell * .24, x0 + cell * .72, y0 + cell * .68],
                          fill=(255, 214, 150))
            elif (r + c) % 3 == 1:
                d.polygon([(x0, y0 + cell), (x0 + cell * .5, y0 + cell * .36), (x0 + cell, y0 + cell)],
                          fill=(16, 22, 32))

    # AI suggestion strip, below the grid
    strip_y = gy0 + 2 * (cell + gap) + 20
    box(d, [px + 40, strip_y, px + pw - 40, strip_y + 130], 26, fill=RAISED, outline=BLUE)
    t(d, (px + 76, strip_y + 44), 'Ask Nexora AI:', L(26, 700), LINK, anchor='lm')
    t(d, (px + 76, strip_y + 90), '"best free tools for photos"', L(26, 400), TEXT2, anchor='lm')

    # suggested accounts
    sug_y = strip_y + 180
    t(d, (px + 44, sug_y), 'Suggested for you', L(28, 700), TEXT, anchor='lm')
    ax = px + 60
    for nm in ['sara', 'omar', 'layla', 'zayn']:
        d.ellipse([ax, sug_y + 46, ax + 96, sug_y + 142], fill=SURFACE, outline=BLUE, width=2)
        t(d, (ax + 48, sug_y + 94), nm[0].upper(), L(34, 700), TEXT)
        t(d, (ax + 48, sug_y + 172), nm, L(20, 400), MUTED)
        ax += 218
    t(d, (W // 2, 1760), 'Search that understands what you mean', L(38, 400), MUTED)
    return img


# ------------------------------------------------------------------ 12 Profile
def shot_12():
    img = background()
    d = ImageDraw.Draw(img)
    t(d, (W // 2, 130), 'Share your world', L(80, 800), TEXT)
    t(d, (W // 2, 226), 'Profile, posts and reels — your space to be seen', L(34, 400), LINK)

    px, py, pw, ph = 70, 320, W - 140, 1330
    box(d, [px, py, px + pw, py + ph], 46, fill=(8, 10, 13), outline=(40, 45, 51), w=3)

    # profile header
    d.ellipse([px + 50, py + 50, px + 220, py + 220], fill=SURFACE, outline=BLUE, width=4)
    d.ellipse([px + 76, py + 76, px + 194, py + 194], fill=(30, 36, 44))
    t(d, (px + 135, py + 135), 'A', L(70, 800), TEXT)
    t(d, (px + 250, py + 86), 'ahmed_becetti', L(38, 700), TEXT, anchor='lm')
    t(d, (px + 250, py + 140), 'Building things with AI', L(26, 400), TEXT2, anchor='lm')
    t(d, (px + 250, py + 190), 'nexora-social-2026.vercel.app', L(24, 500), LINK, anchor='lm')

    # stats
    stats = [('128', 'Posts'), ('4,812', 'Followers'), ('216', 'Following')]
    sx = px + 60
    for val, label in stats:
        t(d, (sx + 100, py + 290), val, L(40, 800), TEXT)
        t(d, (sx + 100, py + 344), label, L(24, 400), MUTED)
        sx += 235

    # buttons
    box(d, [px + 50, py + 400, px + 470, py + 480], 40, fill=BLUE)
    t(d, (px + 260, py + 440), 'Edit Profile', L(28, 700), (255, 255, 255))
    box(d, [px + 490, py + 400, px + pw - 50, py + 480], 40, fill=RAISED, outline=BORDER)
    t(d, (px + 490 + (pw - 540) // 2, py + 440), 'Share Profile', L(28, 600), TEXT)

    # highlights
    hx = px + 70
    for nm in ['New', 'Travel', 'Code', 'Art']:
        d.ellipse([hx, py + 530, hx + 110, py + 640], outline=BORDER, width=3)
        t(d, (hx + 55, py + 585), nm[0], L(32, 700), TEXT2)
        t(d, (hx + 55, py + 676), nm, L(22, 400), MUTED)
        hx += 180
    d.line([px + 40, py + 740, px + pw - 40, py + 740], fill=SEP, width=3)

    # post grid 3 x 2 — sized to stay inside the frame
    gap = 10
    cell = 252
    grid_w = cell * 3 + gap * 2
    gx0 = px + (pw - grid_w) // 2
    for r in range(2):
        for c in range(3):
            x0 = gx0 + c * (cell + gap)
            y0 = py + 768 + r * (cell + gap)
            k = (r * 3 + c) / 6
            d.rectangle([x0, y0, x0 + cell, y0 + cell],
                        fill=(int(30 + 50 * k), int(28 + 26 * k), int(64 + 84 * k)))
            if (r + c) % 2 == 0:
                d.ellipse([x0 + cell * .3, y0 + cell * .26, x0 + cell * .7, y0 + cell * .66],
                          fill=(255, 214, 150))
            else:
                d.polygon([(x0, y0 + cell), (x0 + cell * .55, y0 + cell * .4), (x0 + cell, y0 + cell)],
                          fill=(14, 20, 30))

    t(d, (W // 2, 1760), 'Your profile, your posts, your rules', L(38, 400), MUTED)
    return img


SHOTS = [shot_1, shot_2, shot_3, shot_4, shot_5, shot_6, shot_7, shot_8,
         shot_9, shot_10, shot_11, shot_12]
NAMES = ['brand', 'ai-chat', 'ai-tools', 'image-generation', 'translation',
         'social-feed', 'chat-expression', 'download',
         'settings', 'personal-ai', 'search', 'profile']


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (fn, name) in enumerate(zip(SHOTS, NAMES), 1):
        img = fn()
        assert img.size == (W, H), img.size
        p = os.path.join(OUT, f'nexora-en-{i}-{name}-{W}x{H}.png')
        img.save(p, 'PNG', optimize=True)
        print(f'{os.path.basename(p)}  {W}x{H}  {os.path.getsize(p) // 1024} KB')
        j = p.replace('.png', '.jpg')
        img.save(j, 'JPEG', quality=94, subsampling=0, optimize=True)
        print(f'{os.path.basename(j)}  {os.path.getsize(j) // 1024} KB')


if __name__ == '__main__':
    main()
