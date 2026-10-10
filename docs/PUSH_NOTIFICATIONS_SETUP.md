# NEXORA push notifications setup

## What is implemented in the repository

- Android Firebase Cloud Messaging dependency and receiver service.
- Android 13+ notification permission request and notification channel.
- Per-user device tokens stored at `users/{uid}/fcmTokens/{sha256-token}`.
- Authenticated Vercel endpoint `POST /api/push`. It verifies the caller's Firebase ID token and sends only a notification document created by that caller.
- The app requests push delivery after it creates an in-app notification.

## Required one-time setup

1. **Publish the Firestore rules.** In Firebase Console, open Firestore Database → Rules and publish the repository's `firestore.rules`. This includes the owner-only `fcmTokens` subcollection rule. Merely committing the file to GitHub does not publish it to Firebase.
2. **Configure the server credential in Vercel.** In Firebase Console → Project settings → Service accounts, generate a private key for a service account. In Vercel → the NEXORA project → Settings → Environment Variables, add `FIREBASE_SERVICE_ACCOUNT_JSON` with the entire JSON service-account document as its value, for each environment you use. Redeploy after saving it.
3. Never commit the service-account JSON, paste it into chat, or put it in the Android app. If it is exposed, revoke that key and create a replacement.
4. Build and install a fresh APK from the GitHub Actions workflow, sign in, and allow notifications when Android asks. Test with two accounts by liking or commenting on a post owned by the other account.

## About the VAPID key in Firebase Console

The key shown under **Project settings → Cloud Messaging → Web Push certificates** is a public VAPID key for browser/Web Push. It is not the Android FCM token, and it cannot authenticate Firebase Admin. This repository's current client is a native Android app, so its Android push flow uses the native FCM SDK and does not need the VAPID key. A separate web client/service worker would be needed to use that key for browser notifications.

## Verification status

Code has been committed to GitHub, but notification delivery is not confirmed until the Firestore rules are published, the Vercel service-account environment variable is configured, and an APK is built and tested on a device.
