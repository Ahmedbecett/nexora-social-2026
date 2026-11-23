# Windows Advertising Integration — NEXORA AI by BECETTI (v4.5.0)

**Status:** Integrated natively for Windows Store MSIX via **MG Ads C# SDK V1.2.1** (`windows/host/NexoraWindows/`).

## Provider Matrix

| Provider | Surface Policy | Status in v4.5.0 |
|---|---|---|
| **MG Ads (Miracle Games) C# SDK V1.2.1** | `windows-msix` native C# + WebView2 host ONLY | **Active (Production IDs)** |
| Google AdSense | Public website only (`web`) | Excluded from Windows MSIX & PWA |
| Google AdMob | Android Capacitor app only | Not supported on Windows desktop |
| Adsterra / Monetag | Public website only | Excluded from Windows MSIX (`nx_surface=msix` guard) |

## Ad Formats & Guardrails

1. **Banner (`d461565a9efe49f0ac63ae71048fb594`, 728×90)**
   - Hosted in a dedicated WinForms bottom panel (`MgBannerHostPanel`) docked below WebView2 so it never covers NEXORA AI chat input or Studio toolbars.
   - `Visible = false` by default; shown ONLY when MG Ads confirms a loaded creative (`PreloadAd` → `ShowPreloadAd`, fallback `ShowAd`), and hidden immediately on failure, no-fill, user close, or narrow viewport (`< 728px`).
2. **Rewarded (`48f66ca841444050a166841f331b6adb`)**
   - 100% user-initiated via the sidebar Rewarded button (only rendered when native host reports `initialized && rewardedConfigured`).
   - Grants a 24-hour ad-free pass ONLY after `AdvertManager.AdCloseEvent` confirms `completeStatus == 1` AND calls `AdvertManager.ReportAdRewardFulfillment(unitId, resourceId, materialId, rewardId)`.
3. **Couplet (`168ce66592d743bea2c16cdf908165b3`, 300×600)**
   - Automatically suppressed on smaller desktop viewports (`< 1560×760`) and suppressed whenever the user is inside full-width NEXORA Studio (`view === 'studio'`).
4. **Interstitial (1024×768 — Configurable, Currently Disabled)**
   - `unitId: ""` and `enabled: false` in both `windows/host/NexoraWindows/Config/mgads-config.json` and `public/windows/ads-config.json`.
   - Enforces strict anti-substitution validation: cannot reuse Banner, Rewarded, or Couplet Unit IDs, and rejects any demo or test IDs (including `3940256099942544` and official MG demo IDs).
   - Once an official `1024×768` Unit ID is issued by MG Ads, configure it in `mgads-config.json` (or via `MG_ADS_INTERSTITIAL_UNIT_ID`) with `enabled: true`.

## Configuration Separation & Security

- Native config: `windows/host/NexoraWindows/Config/mgads-config.json`
- Frontend bridge config: `public/windows/ads-config.json` (`allowInMsix: true` strictly for `mgads`)
- JS ↔ Native bridge: `src/ads/mgAdsBridge.js` ↔ `windows/host/NexoraWindows/Bridge/WebViewBridge.cs` (strict `https://nexora-social-2026.vercel.app` origin verification + action allowlist).
- **Private Key Handling**: Configure the GitHub Actions repository secret `MG_ADS_SECRET_KEY` before building a Store-ready package on `windows-latest`, or store it locally in Windows DPAPI using `NexoraWindows.exe --store-mgads-key`. Do NOT commit the Private Key into any file or repository.
- Official portal: `https://www.mg-ads.com/`
