# GitHub Actions (optional)

`android-release.yml` builds the signed Nexora APK on every push to `main` and uploads it to the
`latest` GitHub release (`/releases/latest/download/Nexora.apk`).

It is stored here because the access token used for the upload had no `workflow` scope.
To enable it: move it to `.github/workflows/android-release.yml` (and delete the two old Kotlin
workflows `android-apk.yml` / `android-build.yml`, which are disabled). The repository secrets
`NEXORA_KEYSTORE_BASE64` and `NEXORA_KEYSTORE_PASSWORD` are already configured.
