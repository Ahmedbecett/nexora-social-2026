# NEXORA AI by BECETTI — Windows Store MSIX (4.5.0.0)

## Official Partner Center Identity (Preserved)

> **لا تغيّر هذه القيم يدويًا** — copied verbatim from Microsoft Partner Center so the upgraded MSIX updates the existing Microsoft Store listing instead of creating a new app.

| Field | Official Value |
|---|---|
| Display Name | `NEXORA AI by BECETTI` |
| Publisher Display Name | `Ahmedbecetti` |
| Package Identity Name | `Ahmedbecetti.NEXORAAIbyBECETTI` |
| Publisher | `CN=A5D5DC31-4A15-4059-8030-D96C51054596` |
| Store Product ID | `9ND09PBRDPKZ` |
| Package Family Name | `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm` |
| Version | `4.5.0.0` (derived from `package.json` `4.5.0`) |
| Architecture | `x64` (Desktop Bridge Native C# + WebView2 + MG Ads C# SDK V1.2.1) |
| Target Family | `Windows.Desktop` (`MinVersion="10.0.19041.0"`, `MaxVersionTested="10.0.26100.0"`) |
| Entry Point | `Executable="NexoraWindows.exe"` · `EntryPoint="Windows.FullTrustApplication"` |

## Build & Packaging (GitHub Actions `windows-latest` or Local Windows 10/11)

1. `windows/scripts/Restore-MgAdsSdk.ps1` downloads and SHA-256 verifies official **MG Ads C# SDK V1.2.1** (`MiracleGamesAd.dll`, `MgAdSDKCSharpDLL.dll`, `WebView2Loader.dll`).
2. `windows/scripts/Build-Msix.ps1`:
   - Compiles `windows/host/NexoraWindows/NexoraWindows.csproj` (`Release | x64`), optionally injecting `MG_ADS_SECRET_KEY` from GitHub Actions Secrets into an ephemeral AES-256-CBC native vault that is deleted immediately after compilation.
   - Executes `NexoraWindows.exe --smoke-check` and saves `smoke-check.json`.
   - Stages `NexoraWindows.exe`, runtime DLLs, `Config/mgads-config.json`, `AppxManifest.xml`, and all 53 PNG Store assets.
   - Generates `resources.pri` (`makepri.exe`), packs `NEXORA-AI_4.5.0.0_x64.msix` (`makeappx.exe`), inspects it with `Test-MsixPackage.ps1`, bundles `.msixbundle` and `.msixupload` (**UNSIGNED** — Microsoft Store re-signs on upload), and builds a self-signed `.test-signed.msix` (`signtool.exe`) for local QA sideloading.
3. GitHub Actions workflow `.github/workflows/windows-store-package.yml` runs on `windows-latest`, runs full Node regression tests, builds the MSIX, installs and smoke-checks the test-signed MSIX via `Add-AppxPackage`, and uploads artifacts **without publishing to Microsoft Store** until QA sign-off.
