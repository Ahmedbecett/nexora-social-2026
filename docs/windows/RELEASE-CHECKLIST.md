# Windows release checklist — NEXORA AI by BECETTI 4.4.1

Copy this into the release issue and tick every item. Do not mark a section complete by assumption.

## 0 · Source and version

- [ ] `package.json` version is `4.4.1` and the MSIX version is `4.4.1.0` (or a newer approved pair).
- [ ] `node windows/tools/sync-version.mjs --check` passes; MSIX version is four parts ending `.0`.
- [ ] `npm ci` clean.
- [ ] `npm test` all green.
- [ ] `npm run build` succeeds; `dist/sw.js`, `dist/offline.html`, `dist/windows/` exist.
- [ ] `node windows/tools/check-windows.mjs` exits 0; identity is complete (only Store URL may be pending).
- [ ] Android build still works: `npm run android:sync` (do not ship a broken APK).

## 1 · Partner Center identity

- [ ] Product **NEXORA AI by BECETTI** is a Draft; publisher display name **Ahmedbecetti**.
- [ ] `Package/Properties/DisplayName` and `uap:VisualElements DisplayName` are exactly **`NEXORA AI by BECETTI`**.
- [x] `Package/Identity/Name` = `Ahmedbecetti.NEXORAAIbyBECETTI` recorded in `windows/package-identity.json`.
- [x] `Package/Identity/Publisher` = `CN=A5D5DC31-4A15-4059-8030-D96C51054596` recorded.
- [x] Real **Product ID** `9ND09PBRDPKZ` recorded from Partner Center.
- [x] Package family name `Ahmedbecetti.NEXORAAIbyBECETTI_y0zvy3a8v70hm` recorded.
- [ ] Store URL added only after the listing is public (currently empty).
- [ ] Signing certificate obtained and stored outside the repository.
- [ ] `.pfx`/`.p12`/`.cer`/`certs/` not in `git status`.

## 2 · PWA (available now)

- [ ] HTTPS production URL loads; `data-build` matches `/version.json`.
- [ ] DevTools → Application → Manifest: name, icons 192/512/1024, `display_override`, shortcuts.
- [ ] Service worker registered and activated; no cache for `/api/`, `/version.json`, authorized requests.
- [ ] Offline reload shows the offline page/shell and does not expose stale conversations.
- [ ] Install from Edge works; app opens in a standalone window.
- [ ] Window Controls Overlay title bar appears; menu opens; `Ctrl+N`, `Ctrl+,`, `F1` work.
- [ ] Light/dark themes and RTL/LTR layouts are usable at 1366×768 and 1920×1080.
- [ ] Update flow: deploy a new build, confirm “update ready”, apply, confirm reload once.
- [ ] Sign in, sign out, add second account, revoke sessions.
- [ ] AI text conversation, new conversation, history, retry on failure.
- [ ] File upload and image generation where the provider allows.
- [ ] Studio: new project, edit, terminal, preview, save, publish (test account).
- [ ] Offline banner appears/disappears correctly; no app crash.

## 3 · MSIX

- [ ] Package built by `Build-Msix.ps1` with real identity, Hosted App Model, and `--app-fallback-url` containing `?nx_surface=msix`.
- [ ] All assets present (53 files), correct names/sizes.
- [ ] `Test-MsixPackage.ps1` passes (identity, Hosted App Model, exact capability set).
- [ ] `Test-MsixInstall.ps1` passes: `Add-AppxPackage`, Start entry, Edge host launch, `production-surface` HTTP 200.
- [ ] `node windows/tools/assert-install-test.mjs dist/windows/install-test.json --allow-headless` exits 0.
- [ ] Capabilities are exactly `internetClient` + `runFullTrust`; `runFullTrust` justification matches
      [`RUNFULLTRUST-REVIEW.md`](RUNFULLTRUST-REVIEW.md) and is pasted into Partner Center → Submission options.
- [ ] Store upload (`.msixupload`) left unsigned; if a direct-distribution copy is needed, it is signed with a real certificate via `Sign-StorePackage.ps1`.
- [ ] Install on clean Windows 10 2004+ and Windows 11 (x64; ARM64 if shipping it).
- [ ] Launch, sign in, AI request, Studio, theme, resizing, keyboard/mouse.
- [ ] Windows title bar and menu behave; no overlap with native caption buttons.
- [ ] Offline/network failure handling shown; no white screen.
- [ ] App update via new web deployment; package update via higher MSIX version.
- [ ] Uninstall leaves no crashing shortcut; account data on server intact.
- [ ] No secrets in package (`Test-MsixPackage.ps1` scan).

## 4 · Store listing

- [ ] Short/long descriptions from `STORE-LISTING.md` (no unsupported claims).
- [ ] Screenshots captured from the real app at required size; no personal data/secrets.
- [ ] Icon/tile/splash assets are the official brand.
- [ ] Category Productivity; system requirements Windows 10 2004+ / Windows 11.
- [ ] Privacy URL: `https://nexora-social-2026.vercel.app/windows/privacy.html` (HTTP 200).
- [ ] Support URL: `https://nexora-social-2026.vercel.app/windows/#support` (HTTP 200).
- [ ] Support email verified.
- [ ] Age-rating questionnaire completed.
- [ ] AI disclosure completed where Partner Center asks.
- [ ] Identity still matches Partner Center exactly; no Store URL before publication.
- [ ] Certification notes pasted (no test credentials, no mock services).

## 5 · Advertising

- [ ] Config still `enabled: false`, `provider: none`, `allowInMsix: false` unless a verified provider is active.
- [ ] If enabled: written provider confirmation for the exact surface/package type on file.
- [ ] Privacy policy names the provider before activation.
- [ ] Consent dialog verified; decline path shows no ad and no request.
- [ ] Real ads observed on a real device/package; no local impression counters.
- [ ] No Google test IDs or AdMob IDs in Windows config.
- [ ] **Never** state “ads are working” before real ads are verified.

## 6 · Privacy and security

- [ ] Policy is reachable and matches the shipped behaviour.
- [ ] No backend secrets in front-end bundles or MSIX.
- [ ] HTTPS only in production; no mixed content.
- [ ] Session revocation and account deletion verified.
- [ ] Error boundary shows a usable error state.
- [ ] Permissions requested only when used (microphone on voice).
- [ ] Local storage keys documented and cleared on sign-out where appropriate.

## 7 · Rollback and release

- [ ] Previous deployment/commit identified for rollback.
- [ ] `public/sw.js` cache version bump plan understood.
- [ ] Vercel headers for `/sw.js`, `/offline.html`, `/windows/ads-config.json` verified in production.
- [ ] Release notes prepared.
- [ ] Post-release: check Store install, update, uninstall, support inbox.

## 8 · Sign-off

- [ ] Engineering: tests + manual Windows report attached.
- [ ] Owner: advertising statement accurate.
- [ ] Store submission only when every blocking item is checked.
