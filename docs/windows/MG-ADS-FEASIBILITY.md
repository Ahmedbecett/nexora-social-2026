# MG Ads Integration Architecture — NEXORA AI by BECETTI (Windows 4.5.0)

**Status:** Integrated natively via **MG Ads C# SDK V1.2.1** inside the upgraded native C# (.NET Framework 4.7.2, `x64`) + WebView2 MSIX host (`NexoraWindows.exe`).

## Why the Architecture Was Upgraded from PWA Hosted App Model

In v4.4.0, the Windows package used Microsoft Edge's Hosted App Model (`uap10:HostId="PWA"`). Pure browser-hosted PWAs cannot link native Win32/UWP binaries:
- `MiracleGamesAd.Sdk.Uwp` (UAP 10.0) only attaches to UWP XAML packages.
- MG Ads `h5adsdk.js` requires a native WebView2 host (`window.chrome.webview.hostObjects.MGADSDK`).

In **v4.5.0 / MSIX 4.5.0.0**, NEXORA AI by BECETTI upgrades to a **native C# + WebView2 Desktop Bridge MSIX (`x64`)** host (`windows/host/NexoraWindows/`) that loads the production NEXORA web application (`https://nexora-social-2026.vercel.app/?nx_surface=msix&nx_host=native-webview2`) and directly links the official **MG Ads C# SDK V1.2.1** (`MiracleGamesAd.dll` + `x64/MgAdSDKCSharpDLL.dll` + `WebView2 1.0.3967.48`).

## Official Production Identifiers

| Field | Value |
|---|---|
| Product Title | `NEXORA AI by BECETTI` |
| Microsoft Store Package Identity | `Ahmedbecetti.NEXORAAIbyBECETTI` |
| Publisher | `CN=A5D5DC31-4A15-4059-8030-D96C51054596` |
| Store Product ID | `9ND09PBRDPKZ` |
| Package Family Name | `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm` |
| MG Ads SDK | Official MG Ads C# SDK V1.2.1 (`MiracleGames/sdk/win32/1.2.1/C++SDK1.2.1.zip`, SHA-256 verified) |
| MG Ads Product ID (`AppId`) | `6b03f6af1f812ea86a26de4f` |
| Banner Unit ID (`728×90`, Show) | `d461565a9efe49f0ac63ae71048fb594` (Enabled) |
| Rewarded Unit ID (Rewarded) | `48f66ca841444050a166841f331b6adb` (Enabled) |
| Couplet Unit ID (`300×600`, Show) | `168ce66592d743bea2c16cdf908165b3` (Enabled; desktop viewport `>= 1560×760`, non-Studio) |
| Interstitial Unit ID (`1024×768`) | `""` — Disabled until an official `1024×768` Unit ID is issued (no fake ID or substitution) |

## Credential & Policy Safeguards

- **Private Key (`SecretKey`)**: Never stored in JavaScript, `mgads-config.json`, `ads-config.json`, HTML, Git, or public repositories. Resolved strictly on the native C# side via Windows DPAPI (`%LOCALAPPDATA%\NEXORA\mgads.cred.dat`), native environment variable, or an ephemeral CI-only AES-256-CBC native vault generated from `${{ secrets.MG_ADS_SECRET_KEY }}` and deleted immediately after compilation.
- **Zero Empty Ad Spaces**: The native bottom Banner container stays `Visible = false` (0 px) until a real creative loads, and collapses immediately on no-fill, failure, close, or active 24h Rewarded pass.
- **CMP Compliance**: Calls `ApplicationManager.SetAppId(appId, secretKey)` → `ApplicationManager.OpenCmp(...)` → `ApplicationManager.Initialize()` (with 3× retry) before any ad request.
- **Website Ad Exclusion**: Google AdSense, Adsterra, and Monetag are strictly disabled when `nx_surface=msix` so ONLY MG Ads runs in Microsoft Store MSIX.
