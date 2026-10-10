# NEXORA

NEXORA is an Android social networking app project by Ahmedbecetti.

## Android package
`com.ahmedbecetti.nexora`

## Current foundation
- Firebase Authentication using email and password.
- Firestore user profile creation during registration.
- Firebase client configuration at `app/google-services.json`.
- Firestore rules source at `firestore.rules`.
- Firebase Storage rules source at `storage.rules`.
- GitHub Actions APK workflow is manual-only. Do not run it until feature development is complete.

## Firebase Console setup
1. Enable Email/Password in Firebase Authentication.
2. Create the Cloud Firestore database.
3. Publish the rules from `firestore.rules` in Firestore → Rules. Changes in GitHub do not publish automatically.
4. Enable Firebase Storage and publish `storage.rules` in Storage → Rules. Storage rules are not active until published in Firebase Console or deployed using Firebase CLI.

## Build policy
The APK workflow is intentionally manual-only during development. Do not start a build until the owner confirms feature development is complete.

## Planned product scope
- Profiles and profile editing
- Photo/video posts and feed
- Stories and short vertical videos
- Likes, comments, follows and discovery
- Direct and group messaging
- Notifications, privacy controls, reporting and blocking

Features in the planned scope are not considered implemented until their code is added and verified. Do not commit service-account keys or other private credentials.