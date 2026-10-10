# NEXORA

NEXORA is an Android social networking app project by Ahmedbecetti.

## Android package
`com.ahmedbecetti.nexora`

## Implemented foundation
- Firebase Authentication: email/password sign-in and registration.
- Firestore profile creation and profile editing (display name and bio).
- Instagram-inspired native Android UI with a clean white canvas, dark typography, violet/magenta accents, gradient story rings, custom launcher icon, top actions, post cards, and bottom navigation for Home/Search/Reels/Activity/Profile.
- Profile editor, follower/following counts, and a three-column grid of the signed-in user's posts.
- Social home feed with text posts.
- Like/unlike actions using each post's `likes/{uid}` subcollection.
- Comment creation.
- Member discovery by display name/email and follow/follower documents.
- System media picker and Android client code that requests authenticated presigned upload/download URLs from the Vercel storage API and stores media keys in Firestore posts. Runtime operation still depends on the correct deployed Vercel URL and environment variables.
- Firebase client configuration at `app/google-services.json`.
- Firestore rules source at `firestore.rules`.
- Firebase Storage rules source at `storage.rules`.
- Vercel endpoints at `api/storage/upload-url.js` and `api/storage/view-url.js` that verify Firebase ID tokens and create short-lived S3-compatible upload and download URLs for Neon Object Storage.

## Vercel storage API configuration
Configure these environment variables in Vercel. Never commit their values:
- `AWS_ENDPOINT_URL_S3`: `https://br-bold-sky-b4c1teyk.storage.c-6.us-east-2.aws.neon.tech` (also configured as a non-secret fallback in both API handlers).
- `AWS_ACCESS_KEY_ID`: Neon access key ID.
- `AWS_SECRET_ACCESS_KEY`: Neon secret access key.
- `AWS_REGION`: `us-east-2`.
- `S3_BUCKET`: exact bucket name created in Neon Object Storage.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase service-account JSON used server-side to verify Firebase ID tokens. Keep this secret and use a service account with only the permissions required.

The upload endpoint accepts authenticated POST requests with a Firebase ID token in `Authorization: Bearer <token>`, and JSON containing `contentType`, `size`, and optional `fileName`. It allows JPEG, PNG, WebP, MP4, QuickTime, and WebM files up to 20 MB and returns a five-minute presigned PUT URL. The client must upload the bytes to that URL with the returned Content-Type header. The view endpoint accepts an authenticated POST containing the stored object `key` and returns a five-minute presigned GET URL. The Android source calls these endpoints using `https://nexora-storage.vercel.app` as its current base URL. This is the Vercel API hostname, not the Neon endpoint; it still must be verified against the actual Vercel deployment and replaced in `MainActivity.kt` if different.

## Firebase Console setup
1. Enable Email/Password in Firebase Authentication.
2. Create the Cloud Firestore database.
3. Publish the rules from `firestore.rules` in Firestore → Rules. Changes in GitHub do not publish automatically.
4. Firebase Storage rules are separate from Neon Object Storage; publish `storage.rules` only if Firebase Storage is actually used.
5. Configure the Vercel variables above, including the exact Neon bucket name. A successful Vercel deployment alone does not prove an upload works.

## Current limitations / remaining work
- Media upload/playback, stories, Reels, messaging, and notification delivery require live Firebase, Vercel, and Neon configuration and still need end-to-end runtime testing.
- Notification writes are wired for likes, comments, follows, and messages; push notifications, blocking, full privacy controls, and production-grade moderation are not implemented.
- The Android API base URL is `https://nexora-storage.vercel.app`; verify that this is the active Vercel deployment before expecting media upload/playback to work.
- `GET /api/health` reports whether required environment variables are present. It does not reveal their values and does not validate credentials or perform live database/storage operations.
- Firestore rules in this repository must be reviewed and manually published in Firebase Console; commits do not publish rules automatically.
- The Android build workflow compiles a debug APK, uploads it as a workflow artifact, and attempts to publish it as a GitHub Release. A successful commit is not proof that the build passed; check Actions and Releases for the result.

## Build and download
- [GitHub Actions](https://github.com/Ahmedbecett/nexora-social-2026/actions)
- [GitHub Releases](https://github.com/Ahmedbecett/nexora-social-2026/releases)
- [Direct APK download — available after the first successful release](https://github.com/Ahmedbecett/nexora-social-2026/releases/latest/download/app-debug.apk)
- [Storage configuration health check](https://nexora-storage.vercel.app/api/health)

The generated debug APK is unsigned for production distribution and intended for testing. A production release should use a protected signing key stored in GitHub Actions secrets.
