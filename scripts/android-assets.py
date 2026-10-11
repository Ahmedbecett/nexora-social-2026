"""Generate Android launcher icons + splash screens from resources/*.png"""
from PIL import Image, ImageDraw
import os, glob
R = 'android/app/src/main/res'
icon = Image.open('resources/icon-square.png').convert('RGBA')
fg = Image.open('resources/icon-foreground.png').convert('RGBA')
bg = Image.open('resources/icon-background.png').convert('RGBA')
glyph = Image.open('resources/splash-glyph.png').convert('RGBA')
brand = Image.open('resources/splash-brand.png').convert('RGBA')
dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def rounded(im, size, frac):
    im = im.resize((size, size), Image.LANCZOS)
    m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * frac), fill=255)
    im.putalpha(m.resize((size, size), Image.LANCZOS)); return im

for d, s in dens.items():
    p = f'{R}/mipmap-{d}'; os.makedirs(p, exist_ok=True)
    n = int(48 * s); a = int(108 * s)
    rounded(icon, n, 0.22).save(f'{p}/ic_launcher.png')
    rounded(icon, n, 0.5).save(f'{p}/ic_launcher_round.png')
    fg.resize((a, a), Image.LANCZOS).save(f'{p}/ic_launcher_foreground.png')
    bg.resize((a, a), Image.LANCZOS).save(f'{p}/ic_launcher_background.png')
    # Android 12+ splash icon: 288dp canvas, glyph inside the 192dp safe circle
    c = int(288 * s); g = int(118 * s)
    sp = Image.new('RGBA', (c, c), (0, 0, 0, 0))
    gi = glyph.resize((g, g), Image.LANCZOS); sp.paste(gi, ((c - g) // 2, (c - g) // 2), gi)
    os.makedirs(f'{R}/drawable-{d}', exist_ok=True)
    sp.save(f'{R}/drawable-{d}/splash_icon.png')
    bw, bh = int(200 * s), int(80 * s)
    brand.resize((bw, bh), Image.LANCZOS).save(f'{R}/drawable-{d}/splash_brand.png')

for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    open(f'{R}/mipmap-anydpi-v26/{name}', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>''')

# legacy (< Android 12) full-screen splash: white, centred glyph, "from Nexora" at the bottom
for f in glob.glob(f'{R}/drawable*/splash.png'):
    w, h = Image.open(f).size
    sp = Image.new('RGB', (w, h), (255, 255, 255))
    s = int(min(w, h) * 0.24); gi = glyph.resize((s, s), Image.LANCZOS)
    sp.paste(gi, ((w - s) // 2, (h - s) // 2), gi)
    bw = int(min(w, h) * 0.42); bh = int(bw * 0.4); bi = brand.resize((bw, bh), Image.LANCZOS)
    sp.paste(bi, ((w - bw) // 2, h - bh - int(h * 0.06)), bi)
    sp.save(f)

os.makedirs(f'{R}/values-v31', exist_ok=True)
open(f'{R}/values-v31/styles.xml', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">#FFFFFF</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowSplashScreenBrandingImage">@drawable/splash_brand</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>''')
print('android assets ok')
