# Partner Center pre-submission review — NEXORA AI by BECETTI 4.4.1.0

**Date:** 20 November 2026 (UTC)
**File under review:** `windows/release/4.4.1.0/NEXORA-AI_4.4.1.0_neutral.msixupload`
**Question answered here:** is this upload file complete and valid for Partner Center, and does it
need an `.appxsym` symbol file?

> Everything below is a measurement produced by a command that is in this repository
> (`windows/tools/verify-msix-upload.mjs`, `windows/scripts/Test-MsixPackage.ps1`, the
> `windows-latest` workflow) or by a Windows SDK tool (`makeappx`, `makepri`). Nothing is asserted
> from reading the code alone.

---

## 1 · What the upload actually contains

The `.msixupload` is a ZIP whose root must hold **exactly one** package/bundle. Verified layout:

| Layer | Entries | Notes |
|---|---|---|
| `.msixupload` | **1** — `NEXORA-AI_4.4.1.0_neutral.msixbundle` (deflate, no directory entries, no archive comment) | matches the documented "one bundle → rename `.zip` to `.msixupload`" recipe |
| `.msixbundle` | **4** — `NEXORA-AI_4.4.1.0_neutral.msix` (**stored**, `Offset="60"`), `AppxMetadata/AppxBundleManifest.xml`, `AppxBlockMap.xml`, `[Content_Types].xml` | ZIP64 end-of-central-directory, as produced by `makeappx bundle` |
| inner `.msix` | **57** entries — `AppxManifest.xml`, `AppxBlockMap.xml`, `[Content_Types].xml`, `resources.pri`, **53** PNG assets | **no** `AppxSignature.p7x` (the Store signs during certification) |

`AppxBundleManifest.xml` declares one application payload:

```
<Identity Name="Ahmedbecetti.NEXORAAIbyBECETTI" Publisher="CN=A5D5DC31-4A15-4059-8030-D96C51054596" Version="4.4.1.0"/>
<Package Type="application" Version="4.4.1.0" Architecture="neutral" FileName="NEXORA-AI_4.4.1.0_neutral.msix" Offset="60" Size="10552021">
  <Resources><Resource Language="en-us"/></Resources>
  <b4:Dependencies><b4:TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0"/></b4:Dependencies>
</Package>
```

## 2 · `.appxsym` — verdict: **not required, correctly omitted**

Microsoft documents the symbol file as optional in the very procedure that describes how an
`.msixupload` is assembled:

- <https://learn.microsoft.com/en-us/windows/msix/package/packaging-uwp-apps> — the upload folder may
  contain an app package (or bundle) *and* an `.appxsym`; quoting the page: “**You can omit this file**,
  but if you do, no crash analytic or debugging information will be available.”
- <https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-package-requirements>
  — the upload file “can contain an app bundle and a symbol file”; the symbol file is what supplies
  crash analytics, it is not a submission requirement.

The only thing lost by omitting it is Partner Center crash/health analytics. NEXORA AI is a
**Hosted App Model** package: the manifest launches `Microsoft.MicrosoftEdge.Stable` with
`--app-id=…` / `--app-fallback-url=…`, i.e. the app itself is the existing web build. The package
contains **no** managed or native binary, therefore no `.pdb` exists that could be converted into an
`.appxsym`. Producing one would mean shipping a fabricated symbol archive, which is both useless and
wrong. The verifier therefore reports the absence as a **warning with the reason**, never as an error.

If real symbols ever exist (a native companion would have to be added first), `Build-Msix.ps1` now
accepts `-SymbolsDirectory <dir>`; it packs genuine `.appxsym` files and **refuses** raw `.pdb`
files, which Partner Center does not accept at the upload root.

## 3 · What was actually wrong

The upload **structure** was already valid — no identity, publisher, version or layout defect was
found. The defects were in how the file was produced and proven:

| # | Problem found | Severity | Fix |
|---|---|---|---|
| 1 | `Build-Msix.ps1` assembled the `.msixupload` with `Compress-Archive`, which writes directory entries on some hosts and gave **no post-conditions**: a second bundle, a stray `.p7x`, a `.cer` or a `.pdb` could have slipped into the upload unnoticed. | real (silent-failure risk) | the archive is now written entry-by-entry with `System.IO.Compression.ZipArchive`, then re-opened and asserted: exactly one `.msixbundle`, no `p7x/pdb/cer/pfx/zip/msixupload` entries, no nested paths |
| 2 | There was no way to include genuine symbols, and no guard against someone dropping raw `.pdb` files into the folder. | real (documented acceptance rule) | new `-SymbolsDirectory` parameter; `.appxsym` accepted, `.pdb` rejected with an explicit error |
| 3 | No independent, reproducible check of the **upload** (only the inner `.msix` was tested). Block-map hashes, CRC32 of every entry, bundle↔payload consistency and the reserved identity were unverified. | real (evidence gap) | new `windows/tools/verify-msix-upload.mjs`: pure-Node ZIP/ZIP64 reader that verifies CRC32, block-map completeness and SHA-256 block hashes, and re-checks identity/capabilities against `windows/package-identity.json`; wired into the workflow as a gate |
| 4 | The SDK step validated the source manifest, not the artefact that is uploaded. | real (evidence gap) | new workflow step unpacks **the upload itself**: `makeappx unpack` (upload → bundle → msix), asserts identity/Publisher/DisplayName/capabilities from the extracted `AppxManifest.xml`, `makepri dump` on the extracted `resources.pri`, then `makeappx pack` to re-validate the manifest against the schema |
| 5 | `.appxsym` policy was undocumented, which invites someone to “fix” the warning by inventing a file. | process | this document + a `Symbols:` line in `BUILD-INFO.txt` + a warning string that carries the reason |

Nothing in the identity was touched: `Ahmedbecetti.NEXORAAIbyBECETTI`, `CN=A5D5DC31-4A15-4059-8030-D96C51054596`,
Product ID `9ND09PBRDPKZ`, PFN `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm`, display name
`NEXORA AI by BECETTI`, version `4.4.1.0`.

## 4 · Checks that were run, and their real results

### 4.1 `verify-msix-upload.mjs` on the final artefact

```
file:      NEXORA-AI_4.4.1.0_neutral.msixupload
identity:  Ahmedbecetti.NEXORAAIbyBECETTI
publisher: CN=A5D5DC31-4A15-4059-8030-D96C51054596
version:   4.4.1.0 · NEXORA AI by BECETTI (Ahmedbecetti)
caps:      internetClient, runFullTrust
structure: bundle · 1 entry · 57 parts · 53 PNG
block map: 56 files · 195 blocks hashed · 3 compressed blocks
WARN  msixupload: no .appxsym file — optional per Microsoft (crash analytics only);
      this Hosted App Model package ships no compiled code to symbolize
OK — the upload is structurally valid for Partner Center.
```

### 4.2 Negative controls (proving the verifier is not a rubber stamp)

| Injected defect | Detected |
|---|---|
| a second `.msixbundle` in the upload | `expected exactly one package/bundle, found 2` |
| `AppxSignature.p7x` at the upload root | `forbidden file in the upload: AppxSignature.p7x` |
| raw `Nexora.pdb` in the upload | `forbidden file in the upload: Nexora.pdb` |
| empty archive | `expected exactly one package/bundle, found 0` |
| one flipped byte inside the bundled payload | `msixbundle: … CRC32 mismatch` + `msix: block hash mismatch in Assets\Square150x150Logo.scale-400.png at offset 65536` |
| plain text file renamed to `.msixupload` | `not a ZIP archive (EOCD not found)` |

These cases are permanent tests in `tests/windows-store-upload.test.mjs`.

### 4.3 Windows SDK tools (Windows runner, inside the workflow)

| Tool | Command | Result |
|---|---|---|
| `makeappx` | `unpack /p <upload>\…msixbundle /d bundle` | exit 0 |
| `makeappx` | `unpack /p …msix /d msix` | exit 0 |
| — | extracted `AppxManifest.xml` vs `package-identity.json` | Name/Publisher/Version/DisplayName/PublisherDisplayName/capabilities match |
| `makepri` | `dump /if resources.pri /of pri.xml /o` | exit 0, non-trivial dump (PRI header `mrm_pri2`) |
| `makeappx` | `pack /d <layout> /p repacked.msix` | exit 0 — schema accepts the shipped manifest |
| — | `AppxSignature.p7x` in extracted layout | absent (required for a Store upload) |

### 4.4 Runtime check (already on record)

`windows-latest` install test: `Add-AppxPackage` → **18 PASS / 0 FAIL**, status `Ok`, Start entry
launches via `Microsoft.MicrosoftEdge.Stable` with `--app-id`, production surface HTTP 200
(12 157 B), clean uninstall. See [`TEST-REPORT.md`](TEST-REPORT.md).

## 5 · `runFullTrust` — justified, and now measured

The capability is not declared “because PWABuilder does it”. The experiment
([`RUNFULLTRUST-REVIEW.md`](RUNFULLTRUST-REVIEW.md)) repacked the same app **without** the capability
and installed it on the runner:

```
Add-AppxPackage : Deployment failed with HRESULT: 0x80073D2F
A host runtime dependency resolving to a package with full trust content requires the main package
to have the runFullTrust capability.
```

So Windows itself rejects the package without it, because the Edge Stable host
(`156.0.4314.58`) carries full-trust content. Removing `runFullTrust` would make the package
uninstallable — it stays, and the Partner Center justification in
`windows/package-identity.json` (`capabilities.partnerCenterJustification`) describes exactly this
host requirement.

## 6 · Final artefact

| Property | Value |
|---|---|
| File to upload | `NEXORA-AI_4.4.1.0_neutral.msixupload` |
| Size | 10 455 141 bytes |
| SHA-256 | `d306d0e8cf967ce5fe767ac1f403349ca183c7724278355934e0d863745e59f2` |
| Signed? | no — by design; the Store signs it. The self-signed copy is for local sideloading only |
| Symbols | none (optional; see §2) |

## 7 · Still outside this review

Partner Center submission itself, Store certification, WACK on an interactive desktop and the
visual/tile checks need the owner’s account and a real session. They are **not** claimed as done.
