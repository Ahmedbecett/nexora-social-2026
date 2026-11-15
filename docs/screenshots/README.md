# NEXORA Studio — responsive rework captures

Real browser captures (Puppeteer + Chromium, `@sparticuz/chromium`) taken against the running
Vite dev build, not mockups. Arabic font: Cairo; code font: JetBrains Mono; icons: Noto Color Emoji.
Backend calls are stubbed **only inside the capture harness** (see "Known limits").

## Mobile — 360 × 740 CSS px (Android-class viewport, DPR 2)

| File | What it shows |
| --- | --- |
| `mobile-360-code.png` | Tabbed mobile workspace: **Files / Code editor / Live preview**, one panel at a time. Compact chrome (mark only, one-row status strip, 3×2 pipeline, icon terminal bar). Editor with line numbers + syntax highlighting, code LTR, no wrap. |
| `mobile-360-long-line.png` | 1168-char single line: horizontal scroll, `white-space: pre`, gutter and textarea scroll in sync — no wrapping. |
| `mobile-360-preview.png` | Full-width live preview, sample-data banner (compact on phones), local preview label, refresh/open controls. |
| `mobile-360-code-after-preview.png` | Return to the Code tab after visiting Preview: typed edits and scroll state are preserved (preview blob is kept alive). |
| `mobile-360-files-drawer.png` | File explorer as a slide-in drawer over the workspace; file list, saved-projects list and the "sample template" warning all reachable. |
| `mobile-360-file-switch.png` | Switching files from the drawer lands in the editor with `styles.css`, CSS highlighting and 19 gutter lines. |
| `mobile-360-image-fallback.png` | Broken images: dead remote URL and missing local file both render the placeholder diagram (`data-nx-fallback`), never a broken-image icon. |
| `mobile-360-execution-validation-only.png` | Execution honesty: badge/hint read "⚠ check only — nothing executed" (no E2B key), terminal shows `Executed: NO (fallback validation only)`. |
| `mobile-360-deploy-not-configured.png` | Deploy honesty: "Deployment not performed: Vercel not connected (VERCEL_TOKEN). No deploy link was shown." — no fake URL. |

## Small phone — 320 × 640 CSS px

| File | What it shows |
| --- | --- |
| `mobile-320-code.png` | Narrowest supported width: no horizontal page overflow, tabs still fit, editor keeps ~6 readable lines. |
| `mobile-320-preview.png` | Preview at 320 px with the compact banner. |

## Desktop — three-panel layout preserved

| File | What it shows |
| --- | --- |
| `desktop-studio-ar.png` (1440 × 900, RTL) | Files (right) + editor (center) + live preview (left), expanded terminal, statusbar. |
| `desktop-studio-en.png` (1280 × 800, LTR) | Same layout mirrored for English: files left, editor center, preview right. |
| `desktop-editor-appjs.png` | Editing `app.js` on desktop: JS highlighting, line numbers, typed line at the buffer end, preview still renders the product grid, clean console. |

## Known limits (stated honestly)

- Everything was verified in headless Chromium at Android-class CSS widths with the real app code;
  **no physical Android device was used**. Touch-specific gestures (pinch zoom, momentum scrolling)
  were not exercised.
- `/api/workspace/*`, `/api/exec`, `/api/deploy` return 500 under a bare `vite dev`; the capture
  harness stubs them. Execution is "validation only" without an `E2B_API_KEY`, and deployment is
  refused without `VERCEL_TOKEN` — by design, never simulated.
- The only console errors in a capture run are the two `ERR_CONNECTION_CLOSED` requests from the
  deliberately dead image URLs in `mobile-360-image-fallback.png`.
