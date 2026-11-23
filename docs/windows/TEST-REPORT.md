# NEXORA AI by BECETTI — Windows v4.5.0.0 Test & Verification Report

## Scope
Upgrade from Edge Hosted App Model PWA MSIX (`4.4.0.0` / `4.4.1.0`) to a **Native C# (.NET Framework 4.7.2, `x64`) + WebView2 + Official MG Ads C# SDK V1.2.1 Desktop Bridge MSIX (`4.5.0.0`)** preserving 100% of NEXORA AI features and existing Microsoft Store Package Identity.

## Automated Verification Matrix

| Check | Environment | Expected Outcome |
|---|---|---|
| Node unit & regression suite (`npm test`) | Linux sandbox & `windows-latest` CI | 100% pass (API, auth, studio, web ads, Windows ads, MSIX, privacy, native MG host) |
| Production web bundle build (`npm run build`) | Linux sandbox | Clean Vite bundle with `4.5.0` injected |
| Windows readiness & version sync (`sync-version --check`, `check-windows.mjs`) | Linux sandbox & `windows-latest` CI | Pass (0 errors, Partner Center identity + production MG IDs verified) |
| Official MG Ads C# SDK V1.2.1 restore & SHA-256 verification | `windows-latest` CI | Verified SHA-256 `dc04de9bec8e67aa5ebb424c8219a425c65fe5bdfd0df446c128e58ff1ba1e49` |
| Native C# compilation (`dotnet build -c Release -p:Platform=x64`) | `windows-latest` CI | `NexoraWindows.exe` + runtime DLLs built with 0 errors |
| Native host `--smoke-check` | `windows-latest` CI | Validates `mgads-config.json`, `MiracleGamesAd.dll`, WebView2 assembly loading, zero secrets leaked |
| MSIX pack, bundle, upload & `Test-MsixPackage.ps1` inspection | `windows-latest` CI | Unsigned `.msixupload` + `.msixbundle` + `.msix` + self-signed `.test-signed.msix` verified |
| Windows sideload install (`Add-AppxPackage` + installed `--smoke-check`) | `windows-latest` CI | Installs cleanly under `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm` |

## Pre-Submission Manual QA Checklist (Real Windows 10/11 Desktop)
Perform on a Windows 10/11 PC using `NEXORA-AI_4.5.0.0_x64.test-signed.msix` (with `MG_ADS_SECRET_KEY` configured in GitHub Actions Secret before final Store build, or locally via `NexoraWindows.exe --store-mgads-key`):

1. **App Launch & Identity**: Installs cleanly over prior version, opens NEXORA AI window with taskbar/titlebar icon and dark splash.
2. **Authentication**: Email/password login, Google Sign-In (`signInWithPopup`), and Studio GitHub/Vercel OAuth complete and persist across app restarts.
3. **Core NEXORA AI Features**: AI chat streaming, image generation, saved PostgreSQL conversations, NEXORA Studio builder, file attachments, and API calls work identically to web.
4. **Banner Ad (`d461565a9efe49f0ac63ae71048fb594`, 728×90)**: Appears cleanly in bottom bar only when inventory loads; collapses to 0 px on close/no-fill (zero empty ad space).
5. **Rewarded Ad (`48f66ca841444050a166841f331b6adb`)**: Appears in sidebar when SDK initialized; full video completion triggers `ReportAdRewardFulfillment` and grants 24h ad-free reward; early dismiss grants no reward.
6. **Couplet Ad (`168ce66592d743bea2c16cdf908165b3`, 300×600)**: Only appears on wide desktop (`>= 1560×760`) outside Studio; hides immediately on Studio or smaller window resize.
7. **Interstitial**: Disabled (`unitId: ""`) until official `1024×768` Unit ID is provided.
8. **Zero Web Ad Leakage**: Confirm AdSense, Adsterra, and Monetag never fire inside MSIX.
