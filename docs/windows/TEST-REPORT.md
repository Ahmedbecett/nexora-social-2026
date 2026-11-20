# Test report — NEXORA AI by BECETTI · Windows Edition 4.4.1.0

**Date:** 20 November 2026 (UTC)
**Branch:** `arena/cf85f57a-nexora-social-2026`
**App version:** 4.4.1 · **MSIX version:** 4.4.1.0
**Store display name:** `NEXORA AI by BECETTI` (reserved in Partner Center)
**Build + install test:** GitHub Actions run [`44732511763`](https://github.com/Ahmedbecett/nexora-social-2026/actions/runs/44732511763)
on `windows-latest` (`Windows NT 10.0.26100.0`, x64)
**Source checks:** this Linux workspace

> This report only lists measurements that were actually produced by these commands.
> Store certification, Partner Center submission and interactive visual checks are **not**
> done and are not claimed. Those need the owner's account and a real desktop session.

## 1 · Automated results

| Command / step | Result | Evidence |
|---|---|---|
| `npm ci` | ✅ | 439 packages, lockfile respected |
| `npm test` | ✅ **226 / 226** | includes `windows-msix`, `windows-pwa`, `windows-privacy`, `windows-ads`, `version-consistency` |
| `npm run build` | ✅ | Vite build; `dist/index.html` carries `"softwareVersion":"4.4.1"` |
| `node windows/tools/sync-version.mjs --check` | ✅ | `MSIX version OK: 4.4.1.0` |
| `node windows/tools/check-windows.mjs` | ✅ exit 0 | identity complete, capabilities `internetClient, runFullTrust` (justified), 1 warning: Store URL pending publication |
| `Build-Msix.ps1` (Windows SDK, real build) | ✅ | `makepri createconfig` → `makepri new` → `makeappx pack` → `makeappx bundle` → `.msixupload` structure verification |
| `Test-MsixPackage.ps1` (inside the build) | ✅ | identity, `HostId=PWA`, `--app-id`, fallback URL, exact capability set, assets, no secrets |
| `Test-MsixInstall.ps1` (`Add-AppxPackage`) | ✅ **18 passed / 0 failed** | `windows/release/4.4.1.0/install-test.json` |
| `assert-install-test.mjs` (CI gate) | ✅ | all critical checks PASS, no headless exemptions needed |
| runFullTrust removal experiment | ⛔ **rejected by Windows: `0x80073D2F`** | proves the capability is mandatory — see [`RUNFULLTRUST-REVIEW.md`](RUNFULLTRUST-REVIEW.md) |
| `node windows/tools/verify-msix-upload.mjs <upload>` | ✅ exit 0 | upload → bundle → msix re-verified: 1 entry, 57 parts, 53 PNG, **195 SHA-256 blocks** over 56 files, identity/capabilities match; sole warning = no `.appxsym` (optional, see [`PARTNER-CENTER-REVIEW.md`](PARTNER-CENTER-REVIEW.md)) |
| `makeappx unpack` (upload → bundle → msix) | ✅ exit 0 | unpacked from the **uploaded artefact**, not from the source layout |
| `makepri dump` on the extracted `resources.pri` | ✅ exit 0 | non-trivial dump produced (PRI header `mrm_pri2`) |
| `makeappx pack` re-validation of the extracted layout | ✅ exit 0 | the shipped manifest is accepted against the schema |
| Package inspection (Linux, byte level) | ✅ | 57 entries, 53 assets, `resources.pri`, `AppxBlockMap.xml`, `[Content_Types].xml`, **no** `AppxSignature.p7x` |

### 1.1 Install test — every check (run 44732511763, 12:03:43Z)

| # | Check | Status | Detail |
|---|---|---|---|
| 1 | trust-test-certificate | INFO | test cert added to `CurrentUser\TrustedPeople`, `LocalMachine\TrustedPeople`, `LocalMachine\Root` |
| 2 | certificate-subject | PASS | subject equals `CN=A5D5DC31-4A15-4059-8030-D96C51054596` |
| 3 | add-appxpackage | PASS | install completed in **1.1 s** |
| 4 | package-registered | PASS | `Ahmedbecetti.NEXORAAIbyBECETTI_4.4.1.0_neutral__y0zvy3a8v70hm` |
| 5 | identity-name | PASS | `Ahmedbecetti.NEXORAAIbyBECETTI` |
| 6 | identity-publisher | PASS | `CN=A5D5DC31-4A15-4059-8030-D96C51054596` |
| 7 | identity-version | PASS | `4.4.1.0` |
| 8 | package-family-name | PASS | `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm` |
| 9 | package-status | PASS | `Ok` |
| 10 | declared-capabilities (from the installed manifest) | PASS | `internetClient, runFullTrust` — exactly the agreed set |
| 11 | run-full-trust-justification | PASS | declared + justified (Partner Center text present) |
| 12 | application-entry | PASS | `Id=App` |
| 13 | edge-pwa-host | PASS | `HostId=PWA` |
| 14 | start-menu-entry | PASS | `NEXORA AI by BECETTI → …!App` |
| 15 | launch-edge-host | PASS | 11 new `msedge` processes; window title `NEXORA Studio \| ابنِ تطبيقًا كاملًا بالوصف …` |
| 16 | activation-event-log | PASS | no activation errors in the last 2 minutes |
| 17 | production-surface | PASS | HTTP 200, 12,157 bytes for `https://nexora-social-2026.vercel.app/?nx_surface=msix` |
| 18 | uninstall | PASS | package removed cleanly (no leftover registration) |

Non-blocking observation: signature kind of the sideloaded test copy is `Developer`
(that is what a self-signed test certificate produces). The Store package is unsigned by
design and Microsoft applies its own signature during certification.

## 2 · Artefacts (final, 4.4.1.0)

Download page: <https://github.com/Ahmedbecett/nexora-social-2026/releases/tag/windows-v4.4.1.0>

| File | Size (bytes) | SHA-256 | Purpose |
|---|---:|---|---|
| `NEXORA-AI_4.4.1.0_neutral.msixupload` | 10,455,133 | `b060d1dfc15c4f973e82241c2a7f8fc5e3e8a00b7db45bfead58fdad38f5f0a8` | **upload this to Partner Center** (unsigned; Store re-signs) |
| `NEXORA-AI_4.4.1.0_neutral.msixbundle` | 10,553,808 | `1a12d68e55bb8abf59b76dfa6f0c84187e1b3a836ddbd8202f1aa2822a6fca51` | bundle / alternate upload form |
| `NEXORA-AI_4.4.1.0_neutral.msix` | 10,552,023 | `273f62a6ad52e90470c704751fef228658c8c37a5390069b8483740405cf806d` | single package / inspection |
| `NEXORA-AI_4.4.1.0_neutral.test-signed.msix` | 10,556,435 | `9b3ae3801ef4536ef3bc79a323504df9df92dcb44fcbbac1648c69d4a7d5336a` | local sideload test only |
| `NEXORA-AI-test-certificate.cer` | 818 | `c0a1fa01ce6bbe513c8680f62fc6b15f3a9a451a7709da33579024c5400b47c7` | public test certificate, no private key |
| `install-test.json` | — | — | the measurements in §1.1 |
| `upload-verification.json` | — | — | machine-readable upload audit (structure, block map, identity) |
| `SHA256SUMS.txt` / `BUILD-INFO.txt` | — | — | build record |

Text files are CRLF in the release and LF-normalised in this repository, so their byte size
differs by one byte per line; only the four binaries carry hashes that matter here. The release
asset sizes for `NEXORA-AI_4.4.1.0_neutral.msixupload` (10,455,133) and the other binaries match
the committed copies byte for byte (binaries are never normalised).

The same packages are committed under `windows/release/4.4.1.0/` and attached to the release
above, together with the runFullTrust experiment output. `sha256sum -c SHA256SUMS.txt` passes for
the four package files; the `.cer` line is only attached to the release (certificates are never
committed — `.gitignore` blocks `*.cer`).

## 3 · Package content (verified byte level)

- `NEXORA-AI_4.4.1.0_neutral.msixupload` = ZIP → one `.msixbundle`, no directory entries,
  no archive comment, **no `.appxsym`** (optional for a Hosted App Model app that ships no
  compiled code — see [`PARTNER-CENTER-REVIEW.md`](PARTNER-CENTER-REVIEW.md) §2).
- `.msixbundle` → `NEXORA-AI_4.4.1.0_neutral.msix`, `AppxMetadata/AppxBundleManifest.xml`,
  `AppxBlockMap.xml`, `[Content_Types].xml`.
- Bundle identity: `Name=Ahmedbecetti.NEXORAAIbyBECETTI`, `Publisher=CN=A5D5DC31-…`,
  `Version=4.4.1.0` — identical to `windows/package-identity.json`.
- Inside the `.msix`: 57 entries, 53 PNG assets, `resources.pri`, `AppxBlockMap.xml`,
  `[Content_Types].xml`, **no** `AppxSignature.p7x` (Store upload must stay unsigned).
- Block map integrity re-checked independently: `AppxBlockMap.xml` covers 56 files and all
  **195** uncompressed SHA-256 block hashes match the bytes (3 blocks are stored compressed and
  are covered by their size + the zip CRC32 of the part). Every ZIP entry's CRC32 verified.
- Manifest values: `DisplayName=NEXORA AI by BECETTI`, `PublisherDisplayName=Ahmedbecetti`,
  `uap10:HostId="PWA"`, `Microsoft.MicrosoftEdge.Stable`, `--app-id=pkojfojlpmhfnldcmaemlmpbkcdmihle`,
  `--app-fallback-url=https://nexora-social-2026.vercel.app/?nx_surface=msix`, `--windows-store-app`,
  capabilities `internetClient` + `runFullTrust` only.

## 4 · runFullTrust review outcome

The shipping package declares `runFullTrust`; the experiment built the same package **without**
it and Windows refused to deploy it:

```text
0x80073D2F — A host runtime dependency resolving to a package with full trust content
requires the main package to have the runFullTrust capability.
```

Full analysis, Microsoft evidence and the Partner Center text: [`RUNFULLTRUST-REVIEW.md`](RUNFULLTRUST-REVIEW.md).

## 5 · What this report does NOT cover

| Item | Why | Who |
|---|---|---|
| Partner Center submission and certification | needs the owner's account | owner |
| Store listing, screenshots, age rating | needs an interactive desktop session and the owner's decisions | owner |
| Visual/interactive checks on a personal PC (theme, RTL, resizing, Studio publish) | the runner is headless; the app did open a real Edge window but nobody could look at it | owner |
| Store URL | only exists after publication | owner |

Everything above is a deliberate list, not an omission: the package is built, installed,
launched, permission-checked and identity-checked for real, and nothing is claimed beyond that.
