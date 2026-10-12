# Workspace archive (2026-10-12)

Files from the Arena agent workspace used to build Nexora 2.2 – 2.4.6.

| Folder | Contents |
|---|---|
| `uploads/` | Screenshots and reference images sent during development (Instagram UI references, bug reports), `google-services.json` copies, Google site-verification file, old diff |
| `uptodown/` | Uptodown store listing kit: `LISTING.md`, icon, 1024x500 featured image, 7 screenshots (APK is in GitHub Releases) |
| `store-assets/` | Store description, featured image, 512px icon |
| `qa/` | Playwright QA scripts and their screenshots (`v21` … `v30`), helper scripts, and the 2.4.6 patch scripts (`p246/`) |

Not stored here on purpose:
- **Secrets** (release keystore, keystore password, GitHub/Vercel/Neon/Blob tokens, IndexNow key, DB credentials) are in the owner's private Google Drive folder *“Nexora - private keys (DO NOT SHARE)”*. Passwords inside QA scripts are replaced with `<OFFICIAL_PASSWORD>` / `<QA_TEMP_PASSWORD>`.
- **APKs** are attached to the GitHub Releases (`v2.2.0` … `v2.4.6`, `v2.6.0`).
- **Large binaries** (git bundles of older versions, the Uptodown kit zip, an old work-in-progress diff) are attached to the `workspace-archive-2026-10-12` pre-release.
