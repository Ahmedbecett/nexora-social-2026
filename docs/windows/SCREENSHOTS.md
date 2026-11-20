# Store screenshots — capture real Windows screens

Microsoft Store requires screenshots that show the actual app. **No screenshots are committed** in this
repository, because producing genuine Windows screenshots requires running the app on Windows and signing
in with a real account. Fabricated screenshots would misrepresent the product and violate Store policy.

## Required / recommended

| Asset | Requirement | Recommended |
|---|---|---|
| Desktop screenshots | At least 1 | 4–6 images, 1366×768 or 1920×1080 PNG |
| Format | PNG or JPG | PNG, no transparency |
| Content | Actual app UI | Conversation, Studio, settings, Windows title bar |
| Text | Legible | Use 100% scale; no tiny UI |
| Account | Any real account | Use a neutral test account; no personal data |

## What to capture

1. **AI home / conversation** — signed in, a short harmless conversation visible, Windows title bar and
   app menu in view.
2. **NEXORA Studio** — project view with the editor or live preview, no secrets.
3. **Account & settings** — theme and language controls (no tokens, no email if you prefer).
4. **Windows title bar menu** — the ⋯ menu open, showing New conversation / Settings / Updates.
5. **Offline state** — network disabled, offline notice visible (optional but honest).
6. **Store listing hero** — optional branded art, clearly not labelled as a screenshot.

Avoid personal data, real email addresses, API keys, project secrets or another person's content. Do not
fake usage counters, testimonials or ratings in the image.

## Method A — Playwright capture (recommended)

On Windows with Node.js:

```powershell
npm ci
npx playwright install chromium
node .\windows\tools\capture-screenshots.mjs --url https://nexora-social-2026.vercel.app/ `
  --out .\windows\store\screenshots --width 1366 --height 768
```

The script opens a visible Chromium window. Sign in manually, navigate to the screen you want, return to
the terminal and press **Enter** to capture each shot. It saves numbered PNGs and prints their dimensions.
Use `--width 1920 --height 1080` for Full HD. Use a second run with a different output folder to capture
both sizes.

## Method B — Windows Snipping Tool / Xbox Game Bar

1. Set display scaling to 100% (Settings → Display → Scale).
2. Resize the NEXORA window to the target size (use a screenshot tool that reports the exact size).
3. Capture the window (not the desktop) with `Alt` + `Print Screen` or Game Bar (`Win` + `G`).
4. Crop to exactly 1366×768 or 1920×1080 in Paint/Photos.
5. Save as PNG with a descriptive name.

## Method C — Edge DevTools

1. Open the PWA in Edge, press `F12`.
2. DevTools → device toolbar → set a custom size of 1366×768.
3. Capture a full-size screenshot; this captures the web content without the Windows frame, which is
   acceptable for Store listing but does not show the native title bar.

## Before uploading

- Open the PNG and confirm there is no secret, token, email or personal conversation.
- Confirm the version shown matches `4.4.1` and the Windows title bar is present where relevant.
- Keep the filenames neutral: `01-ai-home-1366x768.png`, `02-studio-1366x768.png`, etc.
- Add them to the Partner Center listing yourself; do not put them in the MSIX package.

## When screenshots are ready

Update the PWA manifest with real screenshot entries only if the images are genuine and hosted publicly:

```json
"screenshots": [
  { "src": "/screenshots/01-ai-home-1366x768.png", "sizes": "1366x768", "type": "image/png", "form_factor": "wide" }
]
```

If you add them, also add the files under `public/screenshots/` and re-run `npm test` (manifest icons test
does not cover screenshots, but the PWA should not reference missing files).
