# Test report — NEXORA AI by BECETTI 4.4.1 Windows Edition

**Date:** 20 November 2026 (UTC)
**Branch:** `arena/b2b93ebf-nexora-social-2026` (base `066e5f7`)
**App version:** 4.4.1 · **MSIX version:** 4.4.1.0
**Store display name:** `NEXORA AI by BECETTI` (reserved in Partner Center)
**Environment:** Linux workspace for source checks; GitHub Actions `windows-2025` runner with Windows SDK for the real package build and install test. No interactive Windows desktop and no Partner Center submission.

An unsigned Store package, an unsigned bundle/MSIX, and a self-signed sideload copy were built. **Nothing has been submitted to Microsoft.**

> This report separates **automated results** from **manual Windows verification**. The manual matrix is still **pending** and must be completed on a physical Windows machine. CI verifies install, identity, capabilities, Start registration and Edge-host process start; it does not replace a human UI session.

## 1 · Automated results

| Check | Result | Evidence |
|---|---|---|
| `npm ci` | ✅ | 439 packages, lockfile respected |
| `npm test` | ✅ **225/225** | Windows/PWA/privacy/SEO tests |
| `npm run build` | ✅ | Vite production build |
| `node windows/tools/sync-version.mjs --check` | ✅ | `package.json 4.4.1` → MSIX `4.4.1.0` |
| `node windows/tools/check-windows.mjs` | ✅ exit 0 | Identity integrated; only warning is Store URL pending |
| Hosted PWA smoke | ✅ | Run `44719494138`: fallback URL HTTP 200 + app shell, web manifest contains `name` |
| Windows package build | ✅ | `makepri`, `makeappx pack`, `makeappx bundle`, `.msixupload` structure check, `Test-MsixPackage.ps1` |
| Windows install | ✅ | `Add-AppxPackage` on `windows-2025` |
| Identity / Publisher / PFN | ✅ | Matched `package-identity.json` and Partner Center values |
| Capabilities | ✅ | Installed manifest contains `internetClient` + `runFullTrust` |
| Start registration | ✅ | `Get-StartApps` returned the package entry |
| Edge host activation | ✅ | `shell:AppsFolder\<PFN>!App` started `msedge` |
| Uninstall | ✅ | `Remove-AppxPackage` succeeded |
| Artifact | ✅ | `nexora-windows-4.4.1.0`, **41,828,972 bytes** |

Run: <https://github.com/Ahmedbecett/nexora-social-2026/actions/runs/44719494138>

## 2 · Release assets

Release: <https://github.com/Ahmedbecett/nexora-social-2026/releases/tag/windows-v4.4.1.0>

| Asset | Size | SHA-256 | Purpose |
|---|---:|---|---|
| `NEXORA-AI_4.4.1.0_neutral.msixupload` | 10,455,087 | `a55549b087e2f78eba0f0b2d40f4d5acddfed302e8ce8b013923493cdc50f540` | **Upload this to Partner Center** |
| `NEXORA-AI_4.4.1.0_neutral.msixbundle` | 10,553,694 | `e6b8c90aedb8b7c03c331416bed4030cac4ea05505e0876294d2a5ededc5727b` | Inspection / fallback |
| `NEXORA-AI_4.4.1.0_neutral.msix` | 10,551,911 | `197301e9e3db5bc71506c6db11e33bd5584ac9a7e725fb58a332e8ee9f6b85be` | Inspection / fallback |
| `NEXORA-AI_4.4.1.0_neutral.test-signed.msix` | 10,556,319 | `4f7b259120277a2733b80891f4a99d6a946ec6384d7fa631e488c5cc4edbcc86` | Local sideload test only |
| `NEXORA-AI-test-certificate.cer` | 818 | `00f9b0a8d3f404397a4d4b95e3a80d1a3369bf6c6e741d4e5d3b176abe4d553e` | Test certificate (no private key) |

The `.msixupload` is **unsigned by design**. Microsoft Store re-signs accepted packages during certification. A developer-signed Store upload is neither required nor accepted as a substitute for Microsoft's signature. The test-signed `.msix` is for local installation only and must **not** be uploaded to Partner Center.

## 3 · Identity preserved

| Field | Value | Status |
|---|---|---|
| `Package/Identity/Name` | `Ahmedbecetti.NEXORAAIbyBECETTI` | unchanged |
| `Publisher` | `CN=A5D5DC31-4A15-4059-8030-D96C51054596` | unchanged |
| `PublisherDisplayName` | `Ahmedbecetti` | unchanged |
| Package Family Name | `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm` | unchanged |
| Product ID | `9ND09PBRDPKZ` (Draft) | unchanged |
| Display name | `NEXORA AI by BECETTI` | already exact in manifest; verified again after install |
| Version | `4.4.1.0` | raised from `4.4.0.0` |

`Package/Properties/DisplayName` and `uap:VisualElements DisplayName` both equal `NEXORA AI by BECETTI`. No name edit was needed in this build; the existing source was already correct.

## 4 · `runFullTrust` still required

The capability is **not optional** for the Edge Stable Hosted App Model:

- Host runtime dependency: `Microsoft.MicrosoftEdge.Stable`.
- Edge declares `Windows.FullTrustApplication` / `packagedClassicApp` / `mediumIL` and `runFullTrust`.
- A package that resolves this full-trust host dependency must declare `runFullTrust`.
- Removing it produced `0x80073D2F` at install (Run `44674821589`); restoring it made install and launch pass.

The app itself has no `Executable`, `EntryPoint`, `TrustLevel` or `RuntimeBehavior`; those belong to Edge's `windows.hostRuntime` extension and are inherited via `uap10:HostId="PWA"`. Full audit: [`MANIFEST-AUDIT.md`](MANIFEST-AUDIT.md).

Partner Center justification: **`runFullTrust` is required by the Edge Stable host runtime dependency (Hosted App Model); the package contains no executable and does not read user files.**

## 5 · Manual Windows test matrix (pending)

Complete this on a physical Windows 10 2004+ / Windows 11 machine with Edge Stable. Use the test-signed `.msix` or the installed PWA. Statuses start as **Pending**; do not mark Pass without evidence.

| # | Test | Steps | Expected | Status |
|---|---|---|---|---|
| 1 | Install PWA | Edge → app URL → Install | Standalone window, icon in Start | Pending |
| 2 | Launch | Open installed app | Loads production UI, no console errors | Pending |
| 3 | Login | Sign in with existing account | Same account/data as Android/web | Pending |
| 4 | Logout / revoke | Settings → sign out; log out all devices | Session cleared, other sessions revoked | Pending |
| 5 | AI conversation | Send Arabic and English prompts | Streaming/answer or clear error; no mock text | Pending |
| 6 | History | Reopen conversation; new conversation (`Ctrl+N`) | Persisted server-side, correct account | Pending |
| 7 | File/image upload | Attach supported file; generate image | Works or honest limitation message | Pending |
| 8 | Studio | Create project, edit file, run command, preview | Real files, terminal output, live preview | Pending |
| 9 | Publish | GitHub/Vercel publish with test account | Real provider flow, no secrets exposed | Pending |
| 10 | Responsive | 1366×768, 1920×1080, narrow window | No clipped controls; RTL/LTR correct | Pending |
| 11 | Themes | Toggle light/dark | Readable contrast, title bar consistent | Pending |
| 12 | Windows shell | WCO title bar, ⋯ menu, keyboard | No overlap with caption buttons; Esc closes menu | Pending |
| 13 | Ad area | With shipped config | No ad, no empty gap, no request | Pending |
| 14 | Network failure | Disable network, open/reload | Offline page/banner, retry works | Pending |
| 15 | Slow network | Throttle to Slow 3G | Loading state, no duplicate submissions | Pending |
| 16 | Update PWA | Deploy new build, reopen | Update prompt once, reload applies build | Pending |
| 17 | MSIX install | Trust certificate, `Add-AppxPackage` test-signed `.msix` | Installs on Win10 2004+ and Win11 | Pending |
| 18 | MSIX surface | Launch MSIX | `nx_surface=msix` reflected; ads off | Pending |
| 19 | MSIX update | Higher version package | Updates in place, data intact | Pending |
| 20 | Uninstall | Uninstall app | No crash leftovers; server account intact | Pending |
| 21 | Accessibility | Keyboard-only, Narrator, 200% scale | Focus visible, labels announced | Pending |
| 22 | Security scan | `Test-MsixPackage.ps1`; Defender scan | No secrets; no malware flags | Pending |
| 23 | MSIX install | Clean Win10 2004 and Win11 | Installs without `0x80073D2F`; appears in Start | Pending |
| 24 | MSIX launch | Launch from Start; open a site link | Edge host activates under package identity | Pending |
| 25 | Installed capabilities | `Get-AppxPackageManifest` | `internetClient` + `runFullTrust` | Pending |

## 6 · Not verified (must not be claimed)

- Partner Center submission, certification or Store publication.
- Interactive installation on a physical Windows desktop (CI installed on a Windows runner, not a human session).
- Full interactive UI flows: sign-in, conversations, Studio, file upload, offline mode, updates.
- app URI handler on a physical machine.
- Store acceptance. Certification is Microsoft's decision.
- Advertising is intentionally disabled; no provider is verified for this package type.
- Screenshots, age rating, and the Store URL.

## 7 · Sign-off

Source tests, production build, Windows package build, install, identity/capability checks, Start registration, Edge-host launch, and uninstall all pass. The Store-ready `.msixupload` is published and ready to upload to Partner Center. **Store certification and the manual UI matrix remain outstanding.**
