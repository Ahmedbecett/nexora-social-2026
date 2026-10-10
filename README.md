# NEXORA

NEXORA is an Android social networking app project by Ahmedbecetti.

## Android package
`com.ahmedbecetti.nexora`

## Implemented foundation
- Firebase Authentication: email/password sign-in and registration.
- Firestore profile creation and profile editing (display name and bio).
- Social home feed with text posts.
- Like/unlike actions using each post's `likes/{uid}` subcollection.
- Comment creation and display of recent comments.
- Member discovery by display name/email and follow/follower documents.
- Firebase client configuration at `app/google-services.json`.
- Firestore rules source at `firestore.rules`.
- Firebase Storage rules source at `storage.rules`.
- Vercel endpoints at `api/storage/upload-url.js` and `api/storage/view-url.js` that verify Firebase ID tokens and create short-lived S3-compatible upload and download URLs for Neon Object Storage.

## Vercel storage API configuration
Configure these environment variables in Vercel. Never commit their values:
- `AWS_ENDPOINT_URL_S3`: Neon S3 endpoint.
- `AWS_ACCESS_KEY_ID`: Neon access key ID.
- `AWS_SECRET_ACCESS_KEY`: Neon secret access key.
- `AWS_REGION`: Neon region, for example `us-east-2`.
- `S3_BUCKET`: exact bucket name created in Neon Object Storage.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase service-account JSON used server-side to verify Firebase ID tokens. Keep this secret and use a service account with only the permissions required.

The upload endpoint accepts authenticated POST requests with a Firebase ID token in `Authorization: Bearer <token>`, and JSON containing `contentType`, `size`, and optional `fileName`. It allows JPEG, PNG, WebP, MP4, QuickTime, and WebM files up to 20 MB and returns a five-minute presigned PUT URL. The client must upload the bytes to that URL with the returned Content-Type header. The view endpoint accepts an authenticated POST containing the stored object `key` and returns a five-minute presigned GET URL. These API endpoints are committed, but the Android app has not yet been wired to call them.

## Firebase Console setup
1. Enable Email/Password in Firebase Authentication.
2. Create the Cloud Firestore database.
3. Publish the rules from `firestore.rules` in Firestore → Rules. Changes in GitHub do not publish automatically.
4. Firebase Storage rules are separate from Neon Object Storage; publish `storage.rules` only if Firebase Storage is actually used.
5. Configure the Vercel variables above, including the exact Neon bucket name. A successful Vercel deployment alone does not prove an upload works.

## Current limitations / remaining work
- The Android UI does not yet call the Vercel upload endpoint; image/video picker and upload progress UI remain to be implemented.
- Stories, short-video/Reels UI, direct messages, push notifications, blocking/reporting, privacy settings, and production-grade moderation are not implemented yet.
- Review Firestore rules before public release and publish the intended rules manually in Firebase Console.
- No APK build or CI build has been run during feature development, by design.

## Build policy
The APK workflow is intentionally manual-only. Do not run it until feature development and review are complete.
