# GitHub Actions (optional)

`android-release.yml` builds the signed Nexora APK on every push to `main` and uploads it to the
`latest` GitHub release (`/releases/latest/download/Nexora.apk`).

**مُفعَّل الآن:** نُسخ إلى `.github/workflows/android-release.yml` (v4.2) ويُبنى عند كل push إلى `main`.
يمكن حذف هذا الملف من docs/ci. الأسرار `NEXORA_KEYSTORE_BASE64` و`NEXORA_KEYSTORE_PASSWORD` (و`NEXORA_KEY_ALIAS` اختياري) تُقرأ إن وُجدت؛ وإلا يُوقَّع بمفتاح التصحيح.
