# Test report — NEXORA AI 4.4.0 Windows Edition

**Date:** 19 November 2026
**Branch:** `arena/1ca98629-nexora-social-2026` (base `cfd80a8`)
**App version:** 4.4.0 · **MSIX version:** 4.4.0.0
**Environment:** Linux build sandbox, Node.js 22.22.3, npm 10.9.8, no Windows host, no certificate,
no Partner Center identity. Browser checks used `curl` and static analysis; **no headless browser is
available in this sandbox**, so real-window screenshots were not produced.

> This report separates **automated results** from **manual Windows verification**. The manual matrix below
> is **pending** and must be completed on Windows before any Store submission. Nothing in this file claims
> a signed MSIX or a Store listing exists.

## 1 · Automated results

| Command | Result | Notes |
|---|---|---|
| `npm ci` | ✅ | 439 packages, lockfile respected |
| `npm test` | ✅ **223/223** | 189 pre-existing + 34 Windows/PWA/privacy tests |
| `npm run build` | ✅ | Vite production build; `dist/` verified |
| `node windows/tools/sync-version.mjs --check` | ✅ | `package.json 4.4.0` → MSIX `4.4.0.0` |
| `npm run windows:check` | ✅ exit 0 | 2 expected placeholder warnings (`identityName`, `publisher`) |
| Dev server route check | ✅ 9/9 HTTP 200 | `/`, `/windows/`, `/windows/en.html`, `/windows/privacy.html`, `/windows/ads-config.json`, `/sw.js`, `/offline.html`, `/manifest.webmanifest`, `/version.json` |

### What the new tests cover (`tests/windows-*.test.mjs`)

- **PWA/platform:** surface detection (Android/MSIX/PWA/browser), service-worker decision matrix, manifest
  fields/icons/shortcuts, no API/authorization caching, offline page, WCO-only shell, shortcuts, offline
  and error states, no fake Store link.
- **Advertising:** shipped config disabled, `provider: none`, no MSIX/PWA surfaces, Google test ID
  rejection, unknown/unimplemented provider fails closed, consent gate, 30-min/3-per-day UX gate, no local
  impression tracking, config separate from code.
- **MSIX:** 4-part version derivation, official display names, placeholders rather than invented identity,
  rejection of invented Product ID/HTTP start page, 53 assets present, reference manifest rules, signing
  script checks, no certificate files in the repo.
- **Privacy/docs:** policy sections and local-storage keys, honest advertising wording, support/privacy
  links, no fake Store URL/product ID, advertising investigation references, required documents exist.

### Defect found and fixed during this test pass

While testing the frequency gate, `readFrequency` used `Number(raw.last) | 0`, which truncates millisecond
timestamps to 32 bits and reset the “last shown” value. The 30-minute gap therefore never applied. Fixed
with `Number(raw.last) || 0`, and the daily-limit test was corrected to assert within the same local day.
This is exactly the kind of bug a Store reviewer would hit by reopening the app immediately.

## 2 · Build artefacts verified

- `dist/sw.js`, `dist/offline.html`, `dist/manifest.webmanifest`.
- `dist/windows/index.html`, `dist/windows/en.html`, `dist/windows/privacy.html`, `dist/windows/ads-config.json`.
- Manifest `display_override` = `["window-controls-overlay","standalone","minimal-ui"]`.
- Production bundle contains **no** Google test ad units (`6300978111`, `1033173712`, `5224354917`,
  `3347511713` absent); test IDs are build-time dev-only now.
- `windows/msix/Assets/` contains 53 PNGs (icons, tiles, splash scales, unplated variants).
- `windows/msix/AppxManifest.reference.xml` is a **reference**, not a buildable package manifest.

## 3 · Manual Windows test matrix (pending)

Complete on a real Windows machine with Edge, the installed PWA, and (when available) a signed MSIX.
Statuses start as **Pending** — do not change to Pass without evidence.

| # | Test | Steps | Expected | Status |
|---|---|---|---|---|
| 1 | Install PWA | Edge → app URL → Install | Standalone window, icon in Start | Pending |
| 2 | Launch | Open installed app | Loads production UI, no console errors | Pending |
| 3 | Login | Sign in with existing account | Same account/data as Android/web | Pending |
| 4 | Logout / revoke | Settings → sign out; log out all devices | Session cleared, other sessions revoked | Pending |
| 5 | AI conversation | Send Arabic and English prompts | Streaming/answer or clear error; no mock text | Pending |
| 6 | History | Reopen conversation; new conversation (`Ctrl+N`) | Persisted server-side, correct account | Pending |
| 7 | File/image upload | Attach supported file; generate image | Works or honest limitation message; no fake result | Pending |
| 8 | Studio | Create project, edit file, run command, preview | Real files, terminal output, live preview | Pending |
| 9 | Publish | GitHub/Vercel publish with test account | Real provider flow, no secrets exposed | Pending |
| 10 | Responsive | 1366×768, 1920×1080, narrow window | No clipped controls; RTL/LTR correct | Pending |
| 11 | Themes | Toggle light/dark | Readable contrast, title bar consistent | Pending |
| 12 | Windows shell | Verify WCO title bar, ⋯ menu, keyboard | No overlap with caption buttons; menu closes on Esc | Pending |
| 13 | Ad area | With shipped config | No ad, no empty reserved gap, no request | Pending |
| 14 | Network failure | Disable network, open/reload | Offline page/banner, retry works, no white screen | Pending |
| 15 | Slow network | Throttle to Slow 3G | Loading state, no duplicate submissions | Pending |
| 16 | Update PWA | Deploy new build, reopen | Update prompt once, reload applies new build | Pending |
| 17 | MSIX install | `Add-AppxPackage` signed package | Installs on Win10 2004+ and Win11 | Pending |
| 18 | MSIX surface | Launch MSIX | `nx_surface=msix` reflected; ads stay off | Pending |
| 19 | MSIX update | Higher version package | Updates in place, data intact | Pending |
| 20 | Uninstall | Uninstall app | No crash leftovers; server account intact | Pending |
| 21 | Accessibility | Keyboard-only, Narrator, 200% scale | Focus visible, labels announced, no traps | Pending |
| 22 | Security scan | `Test-MsixPackage.ps1`; Defender scan | No secrets; no malware flags | Pending |

## 4 · What is not verified (must not be claimed)

- Store submission, certification or publication.
- A signed MSIX (no certificate, no Windows SDK in this environment).
- Real advertising (disabled by design; no provider verified for PWA/MSIX).
- Screenshots, promotional art, age rating, Product ID, package family name, Store URL.
- Windows 10/11 behaviour beyond static checks. The matrix above is the evidence gate.

## 5 · Sign-off

Automated engineering checks pass. **Manual Windows verification and Store identity/signing are still
required.** Advertising is **not operational**. A Store submission before completing
[`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) would be premature.
