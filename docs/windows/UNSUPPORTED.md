# Unsupported features and known limitations — Windows Edition 4.4.0

This list is deliberately explicit. A Store-ready release must not hide gaps behind vague wording.

## Not supported (by platform or current scope)

| Feature | Status | Reason / alternative |
|---|---|---|
| Google AdMob ads | **Not supported on Windows** | AdMob is an Android/iOS SDK. The Android production IDs are not reused. |
| MG Ads (Miracle Games) | **Incompatible with this package type** | The current UWP SDK (`MiracleGames.Sdk.Uwp`, UAP 10.0, C# API) cannot run in a PWABuilder Win32/WebView2 hosted PWA. MG's C++/Win32 and H5 SDKs need a native host or a verified H5/WebView2 integration that MG has not documented; no AppKey or ad unit was provided. See `MG-ADS-FEASIBILITY.md`. |
| Google AdSense inside the installed app/MSIX | **Disabled** | AdSense policies prohibit desktop app wrappers and WebView technologies. It remains on public website pages only. |
| Monetag / Adsterra inside the Windows app | **Not integrated** | No written verification for this package type; no test IDs or fake impressions. |
| Offline AI conversations | **No** | AI requests require the production backend. The offline shell only opens cached UI and says so. |
| OS push notifications | **No** | No notification service worker/push subscription is implemented. In-app states only. |
| Background execution / auto-start | **No** | Not needed for the product; avoids Store policy and battery concerns. |
| File type associations / share target / custom protocol | **No** | The package declares an app URI handler for the website, but the UI does not register file handlers or a custom scheme. |
| Windows Hello / OS credential vault for the app session | **No** | A hosted PWA/MSIX has no native credential locker API. Session tokens are origin-scoped storage protected by the Windows user session. See the privacy policy. |
| In-app purchases through Microsoft Store | **No** | The Store submission does not offer Store-billed purchases. Existing subscriptions are handled by the web payment flow. |
| Multiple separate windows / tabs | **Limited** | The app uses one window; `launch_handler` prefers reusing the existing window. |
| Native Windows tile live updates, jump lists, taskbar badges | **No** | Not implemented. Standard tile and splash assets only. |
| Windows 10 versions older than 2004 (build 19041) | **Not supported** | WebView2/hosted app model baseline. Older systems may work in a browser but are not a release target. |
| x86 32-bit package | **Not produced by default** | PWABuilder options target x64 and arm64. Add x86 only if the Store requires it. |
| Signed MSIX download in the repository | **Not provided** | Requires a Partner Center identity and signing certificate. Scripts are included; the certificate is not and must not be. |
| Microsoft Store publication / Store URL | **Draft** | Product ID `9ND09PBRDPKZ` and identity are recorded, but the listing is not published; do not link to it yet. |
| Store screenshots | **Not committed** | Must be captured from the real Windows app. A capture script and instructions are included. |
| Advertising operational claim | **No** | Advertising is disabled. Do not claim otherwise until a real provider is verified and tested. |

## Known limitations / risks

1. **Hosted app model:** the MSIX loads the production URL. If Vercel is unavailable, the app shows the
   cached shell/offline page. A native offline-first package is out of scope.
2. **Token storage:** tokens live in origin-scoped local storage inside the WebView2/browser profile. They
   are not readable by other origins and are sent only over HTTPS, but a user with access to an unlocked
   Windows session and the app profile could use them. Sign out on shared devices.
3. **Updates are two-layered:** web content updates automatically; Store package identity/icon/permission
   changes require a new MSIX submission with a higher version.
4. **Service worker caching:** static assets are cached; API and authorized requests are never cached.
   Clearing browser/app data signs the user out and removes the offline shell until next online launch.
5. **Window Controls Overlay:** only appears in browsers that support it (current Edge/Chrome). In older
   engines the native title bar remains; there is no broken layout, just no custom bar.
6. **RTL/LTR:** the Windows title bar follows the interface language. Some third-party content in Studio
   may switch direction independently.
7. **Voice input:** uses browser speech APIs and may be unavailable on some Windows configurations.
8. **File analysis:** limits and provider availability apply, as on the web.
9. **Store listing media:** screenshots and optional promotional art must be produced by the publisher
   from the real app; this repository does not fabricate them.
10. **Advertising cannot be validated from this sandbox:** no Windows package, no Partner Center identity,
    no approved ad network. Treat all ad code paths as untested in production until the checklist passes.
