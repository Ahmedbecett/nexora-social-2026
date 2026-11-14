# Real screenshots — NEXORA AI v4.4

20 screenshots captured from the **running app**, not drawn. Every file is a
**PNG at exactly 1080×1920** (plus a JPG copy), matching the Softonic requirement.

## How they were captured

`scripts/capture-store-shots.mjs` serves the production build with `vite preview`
and drives real Chromium at 540 CSS px × devicePixelRatio 2 → exactly 1080×1920.

- Every `/api/**` call is intercepted with fixed fixtures, so **nothing is written
  to the production database**, and no account is created.
- The app calls `https://nexora-social-2026.vercel.app/api/...` because
  `VITE_WEB_URL` is baked in at build time, so the interception is registered for
  any host rather than for localhost.
- The AI reply is served as a real SSE stream (`{type:'start'}` → `{type:'delta'}`
  → `{type:'done'}`), which is the shape `AIPlatform.jsx` parses.

## The 20 screens

| # | File | Screen |
|---|------|--------|
| 01 | `01-login` | Login: logo, APK banner, language, email/password, Google, phone |
| 02 | `02-login-language-list` | Language list (52 languages) |
| 03 | `03-create-account` | Sign-up form |
| 04 | `04-phone-signup` | Phone-number signup |
| 05 | `05-ai-workspace` | AI workspace home: six tool cards, prompts, composer |
| 06–11 | `06-tool-chat` … `11-tool-summaries` | Each of the six AI tools active |
| 12 | `12-conversation` | A real exchange with an AI reply and its action buttons |
| 13 | `13-suggestions` | "Start with an idea" prompt row |
| 14 | `14-workspace-arabic` | Workspace in Arabic (RTL) |
| 17 | `17-composer-focused` | Composer focused, with the attach/voice/send controls |
| 18 | `18-workspace-scrolled` | Workspace scrolled to the tool grid |
| 19 | `19-sidebar-open` | Sidebar: tools, saved conversations, account |
| 20 | `20-account-sheet` | Account and security sheet |
| 21 | `21-workspace-light` | Light theme |
| 22 | `22-login-arabic` | Login screen in Arabic |

## Regenerating

```bash
npm ci && npm run build
npx vite preview --port 4173 --host 127.0.0.1 &
npm i --no-save playwright-core@1.49.1
CHROME_PATH=/path/to/chromium node scripts/capture-store-shots.mjs
```

In CI use `.github/workflows/store-screenshots.yml`, which installs Chromium with
its system dependencies on the runner and verifies the size and format of every
file before uploading the artifact.

## Note on the app's scope

`App.jsx` mounts only `AIPlatform`. The former social screens (feed, reels,
messages) are still in the repository but are not part of the bundle, so no
screenshot of them can be taken from the running app.
