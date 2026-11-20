#!/usr/bin/env bash
# NEXORA AI — regenerate MSIX assets from public/icon-1024.png with ImageMagick.
# The committed windows/msix/Assets files were generated with this script.
# Requires ImageMagick 6+ (`convert`). On Windows use windows/scripts/New-MsixAssets.ps1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/public/icon-1024.png"
OUT="$ROOT/windows/msix/Assets"
mkdir -p "$OUT"
cd "$OUT"

if [ ! -f "$SRC" ]; then echo "Missing $SRC" >&2; exit 1; fi
if ! command -v convert >/dev/null 2>&1; then echo "ImageMagick 'convert' is required" >&2; exit 1; fi

sq() { convert "$SRC" -resize "${1}x${1}^" -gravity center -extent "${1}x${1}" -strip "${2}"; }

sq 50 StoreLogo.png
sq 44 Square44x44Logo.png
sq 150 Square150x150Logo.png
sq 71 Square71x71Logo.png
sq 310 Square310x310Logo.png
sq 48 LockScreenLogo.scale-200.png

for pair in "100 44" "125 55" "150 66" "200 88" "400 176"; do set -- $pair; sq "$2" "Square44x44Logo.scale-$1.png"; done
for size in 16 24 32 48 256; do sq "$size" "Square44x44Logo.targetsize-$size.png"; done

# Circular transparent glyph for taskbar "unplated" variants
convert "$SRC" -resize 1024x1024 \
  \( -size 1024x1024 xc:black -fill white -draw "circle 512,512 512,0" \) \
  -alpha off -compose CopyOpacity -composite -strip /tmp/nx-glyph.png
for size in 16 24 32 48 256; do
  convert /tmp/nx-glyph.png -resize "${size}x${size}" -strip "Square44x44Logo.altform-unplated_targetsize-$size.png"
  convert /tmp/nx-glyph.png -resize "${size}x${size}" -strip "Square44x44Logo.altform-lightunplated_targetsize-$size.png"
done

for pair in "100 71" "125 89" "150 107" "200 142" "400 284"; do set -- $pair; sq "$2" "Square71x71Logo.scale-$1.png"; done
for pair in "100 150" "125 188" "150 225" "200 300" "400 600"; do set -- $pair; sq "$2" "Square150x150Logo.scale-$1.png"; done
for pair in "100 310" "125 388" "150 465" "200 620" "400 1240"; do set -- $pair; sq "$2" "Square310x310Logo.scale-$1.png"; done

mkw() {
  local W=$1 H=$2 OUT_NAME=$3
  local G=$((H*62/100)) P=$((H/8)) Q=$((H/14))
  convert -size "${W}x${H}" gradient:'#1b1140-#0b0918' \
    \( /tmp/nx-glyph.png -resize ${G}x${G} \) -gravity west -geometry +$((W*4/100))+0 -composite \
    -fill '#f7f3ff' -font DejaVu-Sans-Bold -pointsize $P -gravity east -annotate +14+$((H/12)) 'NEXORA AI' \
    -fill '#b7a0ff' -font DejaVu-Sans -pointsize $Q -gravity east -annotate +14-$((H/9)) 'WINDOWS EDITION' \
    -strip "$OUT_NAME"
}
mkw 310 150 Wide310x150Logo.png
for pair in "100 310 150" "125 388 188" "150 465 225" "200 620 300" "400 1240 600"; do set -- $pair; mkw "$2" "$3" "Wide310x150Logo.scale-$1.png"; done

mks() {
  local W=$1 H=$2 OUT_NAME=$3
  local G=$((H*64/100)) P=$((H/9)) Q=$((H/18)) X=$((W*18/100)) Y=$((H*4/100))
  convert -size "${W}x${H}" gradient:'#221452-#090713' \
    \( /tmp/nx-glyph.png -resize ${G}x${G} \) -gravity west -geometry +$((W*5/100))+0 -composite \
    -fill '#ffffff' -font DejaVu-Sans-Bold -pointsize $P -gravity center -annotate +${X}+${Y} 'NEXORA AI' \
    -fill '#c9b8ff' -font DejaVu-Sans -pointsize $Q -gravity center -annotate +${X}-$((H*13/100)) 'Windows Edition' \
    -strip "$OUT_NAME"
}
mks 620 300 SplashScreen.png
for pair in "100 620 300" "125 775 375" "150 930 450" "200 1240 600" "400 2480 1200"; do set -- $pair; mks "$2" "$3" "SplashScreen.scale-$1.png"; done

rm -f /tmp/nx-glyph.png
echo "Generated $(find . -name '*.png' | wc -l) assets in $OUT"
