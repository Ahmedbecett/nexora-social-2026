# NEXORA

NEXORA is an Android social app starter project by Ahmedbecetti.

## Android package name
`com.ahmedbecetti.nexora`

## Requirements
- Android Studio
- JDK 17
- Android SDK 35

## Firebase setup
1. Create a Firebase project.
2. Register an Android app with package name `com.ahmedbecetti.nexora`.
3. Download `google-services.json` and place it in `app/google-services.json`.
4. In Firebase Authentication, enable Email/Password.
5. Create a Cloud Firestore database and configure production security rules before using real accounts.
6. Open this repository in Android Studio and sync Gradle.

Do not commit private credentials or service-account keys. The Firebase client configuration file is app-specific; obtain it from your own Firebase project.