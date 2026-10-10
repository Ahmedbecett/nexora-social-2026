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

## Firebase Hosting web client

A responsive NEXORA web starter lives in `public/`. It uses the Firebase web app configuration for project `nexora-social-2026`, supports email/password account creation and sign-in, reads and creates text posts in Firestore, and can register this browser for Firebase Cloud Messaging notifications. Browser push requires HTTPS, a supported browser, notification permission, and published Firestore rules.

### Deploy from the repository root

Install Node.js and Firebase CLI, then run:

```sh
npm install -g firebase-tools
firebase login
firebase use nexora-social-2026
firebase deploy --only hosting
```

The repository contains `.firebaserc` and `firebase.json`, so Firebase Hosting publishes the `public/` directory to the project's Hosting site. You can deploy from Termux or a computer with the Firebase CLI installed.

### One-time Firebase Console setup

1. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
2. In Firestore Database, create the database if needed and publish the repository's `firestore.rules`.
3. In Project settings → General, register/confirm the Web app configuration. The web app config is client-side configuration, not a Firebase Admin credential.
4. In Project settings → Cloud Messaging → Web Push certificates, use the public VAPID key for browser push. The website includes it in its client code; do not use it as a server credential.
5. After Hosting deploys, open the Hosting URL in Chrome, create an account, and tap **Enable browser notifications**.

For native Android push sending, separately configure `FIREBASE_SERVICE_ACCOUNT_JSON` as a private environment variable in Vercel and redeploy the Vercel API. Never commit a service-account JSON file or paste its private key into chat.

### Current web-client scope

The Hosting site currently provides sign-in/sign-up, text posting, a live Firestore feed, and browser push-token registration. It is a web companion/starter, not yet a full web clone of all native Android screens and features. Notification delivery must be tested after deployment and the server credentials/rules are configured.
