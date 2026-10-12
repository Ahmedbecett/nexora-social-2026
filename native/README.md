# NEXORA — Native Android (Kotlin + Jetpack Compose)

A full native rebuild of NEXORA, with **no WebView and no web UI**. It talks to the same backend as the web/Capacitor app (`https://nexora-social-2026.vercel.app/api/`, Vercel + Neon), uses the same accounts and data, and copies the same Instagram-style design.

> Official build since **v3.1.0**: package `com.ahmedbecetti.nexora` (versionCode 16), signed with the same key as v2.6.0, so it installs as an update over it.

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

## v3.0.0
- Instagram structure everywhere: bottom bar Home / Reels / Messages / Search / Profile, profile note bubble, multiple links, reposts tab, account switcher with badges, saved-profiles login screen
- Inbox tab with notes rail, Message requests (+ Spam folder kept on the device, delete, block), notifications grouped by Today / Yesterday / Last 7 days / Last 30 days
- Full "Settings and activity" (Accounts Center, Archive, Your activity, Time management, privacy and interaction controls, lists, Hidden Words, Account Status…) backed by the API
- Native Google sign-in (Credential Manager → `auth/google` / `auth/complete`)

## v3.1.0
- Audio/video WebRTC calling, with a full-mesh group call (up to four participants) using the existing hidden chat-message signaling; no new server or Firebase changes. Background incoming-call polling works for up to 10 minutes after the app is backgrounded; reliable push ringing is not available because this project has no FCM configuration.
- AdMob banner (same account/application and unit as v2.6.0; Google test unit in debug).
- Chat: gallery image/video, camera capture, AAC voice notes, bundled stickers and GIFs, optional GIPHY API search (user-supplied key), real device location sharing with map intent, hand-drawing PNG, music-link card, remote AI image generation via Pollinations, and optional OpenAI-compatible chat assistant (user-supplied key, held in memory only).
- Chat metadata is validated and stored in the existing `messages.media_meta` JSON column; no schema migration, Firebase modification, seeded accounts, or synthetic location data.

## External-service constraints
- WebRTC uses Google STUN only. Some carrier/firewall NATs require TURN; the app does not embed an unsafe public relay or invent credentials. For robust calling on all networks, provision an authenticated TURN service and configure its credentials before relying on calls.
- AI image generation, GIPHY search and paid/provider-backed AI chat depend on those third-party services, network availability and (for GIPHY / AI chat) user-provided credentials. Errors are shown rather than replaced with fake results.
- App-based inbound call polling cannot wake a force-stopped process. Background calls are not guaranteed after the 10-minute polling window.

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
