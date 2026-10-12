# NEXORA — Native Android (Kotlin + Jetpack Compose)

A full native rebuild of NEXORA, with **no WebView and no web UI**. It talks to the same backend as the web/Capacitor app (`https://nexora-social-2026.vercel.app/api/`, Vercel + Neon), uses the same accounts and data, and copies the same Instagram-style design.

> Test build: package `com.ahmedbecetti.nexora.kt`. It installs **side-by-side** with the current app (`com.ahmedbecetti.nexora`, v2.6.0) and does not replace it.

## Stack
- Kotlin 2.x, Jetpack Compose (Material 3), single-activity, a state-driven navigation stack
- OkHttp + org.json for the REST API (Bearer token, same endpoints as the web app)
- Coil for images, Media3/ExoPlayer for videos and reels
- Strings come from the web app's own translation tables (55 languages, RTL-aware): `tools-dump-i18n.mjs`
- Icons are generated from the web app's SVG icon set: `tools-gen-icons.mjs` → `ui/IconsGen.kt`

## Round 1 (this build)
- Login, sign-up and password reset (username/email + password)
- Home feed with the stories tray, post cards (multi-photo carousel, video, double-tap like, save, repost, share, comments with replies and likes, likes list, report and delete)
- Story viewer (progress bars, tap and long-press, viewed state, reply → DM)
- Reels: vertical full-screen pager (your network's reels + real world videos), like, comment, mute
- Search and Explore grid, user search, hashtags
- Profiles: grid, reels and tagged tabs, highlights, follow, unfollow and requests, followers and following, block and report
- Edit profile, notifications, follow requests, saved posts, settings (theme, language, privacy, logout)
- Messages: inbox, requests, new message, chat (text, replies, reactions, unsend, delete-for-you, seen and typing, shared posts, photos, videos, voice playback, call log lines)

## Later rounds
Create post, reel and story (camera and gallery upload), sending media and voice in chat, audio and video calls, the full settings set, AdMob, Google and phone login, avatar upload.

## Build
```bash
cd native
./gradlew :app:assembleDebug          # debug
./gradlew :app:assembleRelease        # needs keystore.properties (never committed)
```
`keystore.properties`:
```
storeFile=/path/to/release.jks
storePassword=...
keyAlias=...
keyPassword=...
```

## Screenshot smoke test
A Robolectric test boots the real app against the production API and saves screenshots of every screen:
```bash
NX_TOKEN=<jwt> NX_THEME=light ./gradlew :app:testDebugUnitTest --tests '*SmokeTest*'   # → /tmp/shots
```
