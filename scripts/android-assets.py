"""Generate Android launcher icons + splash screens from resources/*.png"""
from PIL import Image, ImageDraw
import os, glob
R = 'android/app/src/main/res'
icon = Image.open('resources/icon-square.png').convert('RGBA')
fg = Image.open('resources/icon-foreground.png').convert('RGBA')
bg = Image.open('resources/icon-background.png').convert('RGBA')
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
for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    open(f'{R}/mipmap-anydpi-v26/{name}', 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>''')
src = Image.open('resources/icon.png').convert('RGBA')
for f in glob.glob(f'{R}/drawable*/splash.png'):
    w, h = Image.open(f).size
    sp = Image.new('RGB', (w, h), (255, 255, 255))
    s = int(min(w, h) * 0.28); ic = src.resize((s, s), Image.LANCZOS)
    sp.paste(ic, ((w - s) // 2, (h - s) // 2), ic); sp.save(f)
print('android assets ok')
