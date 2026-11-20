# Test report — NEXORA AI by BECETTI 4.4.1 Windows Edition

**Date:** 19 November 2026 (Store-name rebuild: 20 November 2026, UTC)
**Branch:** `arena/f406a053-nexora-social-2026` (base `8a04269`)
**App version:** 4.4.1 · **MSIX version:** 4.4.1.0
**Store display name:** `NEXORA AI by BECETTI` (reserved in Partner Center)
**Environment:** Linux workspace for source checks; GitHub Actions `windows-2025` runner with Windows SDK for the real package build. No interactive Windows host and no Partner Center submission.
An unsigned Store package and a self-signed sideload test package were built; nothing has been submitted to Microsoft.
Browser checks used `curl` and static analysis; **no headless browser is available in this sandbox**, so
real-window screenshots were not produced.

> This report separates **automated results** from **manual Windows verification**. The manual matrix below
> is **pending** and must be completed on Windows before relying on the package. A real unsigned `.msixupload`
> exists, but this file does not claim Store certification or an interactive install test.

## 1 · Automated results

| Command | Result | Notes |
|---|---|---|
| `npm ci` | ✅ | 439 packages, lockfile respected |
| `npm test` | ✅ **224/224** | 189 pre-existing + 35 Windows/PWA/privacy tests |
| `npm run build` | ✅ | Vite production build; `dist/` verified |
| `node windows/tools/sync-version.mjs --check` | ✅ | `package.json 4.4.1` → MSIX `4.4.1.0` |
| `npm run windows:check` | ✅ exit 0 | Partner Center identity verified; 1 warning: Store URL pending publication |
| Windows package build | ✅ | `Build-Msix.ps1` on Windows Server 2025: `makepri`, `makeappx pack/bundle`, `.msixupload` structure check, `Test-MsixPackage.ps1` |
| Store-name rebuild | ✅ | Run `44654597475`; `Test-MsixPackage.ps1` matched `DisplayName`/`VisualElements DisplayName` = `NEXORA AI by BECETTI` and unchanged Name/Publisher/version; release asset `c2adc350…a88d` |
| Dev server route check | ✅ 9/9 HTTP 200 | `/`, `/windows/`, `/windows/en.html`, `/windows/privacy.html`, `/windows/ads-config.json`, `/sw.js`, `/offline.html`, `/manifest.webmanifest`, `/version.json` |

### What the new tests cover (`tests/windows-*.test.mjs`)

- **PWA/platform:** surface detection (Android/MSIX/PWA/browser), service-worker decision matrix, manifest
  fields/icons/shortcuts, no API/authorization caching, offline page, WCO-only shell, shortcuts, offline
  and error states, no fake Store link.
- **Advertising:** shipped config disabled, `provider: none`, no MSIX/PWA surfaces, Google test ID
  rejection, unknown/unimplemented provider fails closed, consent gate, 30-min/3-per-day UX gate, no local
  impression tracking, config separate from code.
- **MSIX:** 4-part version derivation, exact Partner Center identity (`Ahmedbecetti.NEXORAAIbyBECETTI`,
  publisher CN, PFN, Product ID `9ND09PBRDPKZ`), rejection of malformed or mismatched identity, 53 assets,
  reference manifest rules, signing script checks, no certificate files in the repo.
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
- `windows/msix/AppxManifest.reference.xml` is the **actual Hosted App Model manifest** copied into the package. The built artifacts are attached to the [Windows release](https://github.com/Ahmedbecett/nexora-social-2026/releases/tag/windows-v4.4.1.0).

### Store-name rebuild (20 November 2026)

- Reserved Store name **`NEXORA AI by BECETTI`** is set in:
  - `Package/Properties/DisplayName`
  - `uap:VisualElements DisplayName`
  - `windows/package-identity.json` (`displayName`)
- **Unchanged:** `Package/Identity/Name` `Ahmedbecetti.NEXORAAIbyBECETTI`, `Publisher`
  `CN=A5D5DC31-4A15-4059-8030-D96C51054596`, Product ID `9ND09PBRDPKZ`, version `4.4.1.0`.
- The rebuilt `.msixupload` is 10,454,721 bytes, SHA-256
  `c2adc350fc21805e0d1a8892873e8b48ca5ad0ab57726630afac6fb58039a88d`.
- **Not verified:** interactive Windows install, the Store listing UI, and Partner Center acceptance.
  Those remain manual steps and must not be reported as done.

## 3 · Manual Windows test matrix (pending)

Complete on a real Windows machine with Edge and the test-signed `.msix` (or the installed PWA). The Store-upload package is unsigned by design.
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
| 17 | MSIX install | Trust the test certificate, then `Add-AppxPackage` test-signed `.msix` | Installs on Win10 2004+ and Win11 | Pending |
| 18 | MSIX surface | Launch MSIX | `nx_surface=msix` reflected; ads stay off | Pending |
| 19 | MSIX update | Higher version package | Updates in place, data intact | Pending |
| 20 | Uninstall | Uninstall app | No crash leftovers; server account intact | Pending |
| 21 | Accessibility | Keyboard-only, Narrator, 200% scale | Focus visible, labels announced, no traps | Pending |
| 22 | Security scan | `Test-MsixPackage.ps1`; Defender scan | No secrets; no malware flags | Pending |

## 4 · What is not verified (must not be claimed)

- Store submission, certification or publication.
- An interactive installation on a physical Windows machine (the package was structurally verified, not installed interactively).
- Production Store signing (Microsoft signs during certification; the test-signed copy is not for the Store).
- Real advertising (disabled by design; no provider verified for PWA/MSIX).
- Screenshots, promotional art, age rating, Store URL/publication.
- MG Ads is **not integrated**: its current UWP SDK cannot run in this package type, and its C++/Win32 and
  H5 SDKs have no verified WebView2 path; see `MG-ADS-FEASIBILITY.md`.
- Windows 10/11 behaviour beyond static checks. The matrix above is the evidence gate.

## 5 · Sign-off

Automated engineering checks pass and the unsigned Store package was built successfully. **Interactive
Windows verification and Store submission/certification are still required.** Advertising is **not operational**. A Store submission before completing
[`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) would be premature.
