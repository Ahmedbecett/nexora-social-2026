# Android releases and Google sign-in

The active workflow is `.github/workflows/android-release.yml`. The older YAML files in
this directory are reference copies, not the active release pipeline.

## Required Firebase setup

1. In Firebase project `nexora-social-2026`, enable **Authentication → Sign-in method → Google**.
2. Register Android app `com.ahmedbecetti.nexora` and add the **SHA-1 and SHA-256 of the
   actual APK signing certificate**. Google Play App Signing uses a different certificate
   from an upload key; register the Play signing certificate too when distributing there.
3. Download a fresh `google-services.json` after enabling Google and registering the SHA.
   It must contain the Android OAuth client and a **Web** OAuth client (`client_type: 3`),
   which generates `default_web_client_id` for the native plugin. Do not use an Android
   client ID as the Web client ID.
4. Save the raw JSON as the GitHub Actions secret **`GOOGLE_SERVICES_JSON`**. Locally,
   place it at `android/app/google-services.json` (gitignored).
5. Run `node scripts/check-android-firebase.mjs` before building locally. CI runs this
   check automatically and stops instead of publishing an APK with broken native auth.
   The structural check cannot verify Firebase console settings or the actual signing SHA.

## Stable release signing

Publishing from `main` requires `NEXORA_KEYSTORE_BASE64` and `NEXORA_KEYSTORE_PASSWORD`.
`NEXORA_KEY_ALIAS` defaults to `nexora`; `NEXORA_KEY_PASSWORD` is optional and defaults
to the keystore password. Keep using the existing production key so installed apps can
update normally. Do not generate a new key for each build.

PR/manual builds outside `main` may use the debug signing fallback, but still require
Firebase configuration. Their Google sign-in works only if that debug certificate is
registered in Firebase. Fork PRs do not receive repository secrets and cannot complete
this configured APK job. A debug-signed APK must not be promoted as the production APK.

The workflow publishes `Nexora.apk` to the `latest` release and updates the website's
APK download on `main` only.

## Verification

- `npm test` checks OAuth config validation, native/web token routing, Credential Manager
  fallback, cancellation, missing tokens, and stalled API exchanges.
- `npm run build` checks the web bundle.
- On a physical Android device, install an APK signed with the registered production key.
  Test account selection, cancellation and retry, a new Google account (profile completion),
  an existing account, and offline/reconnect behavior.
- In a browser, allow popups and test Google login on a Firebase-authorized domain.

Without the Firebase JSON and registered signing certificate, a successful end-to-end
Google login cannot be verified or fixed by client code alone.
