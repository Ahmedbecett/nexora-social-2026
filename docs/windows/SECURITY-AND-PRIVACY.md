# Security and privacy review — Windows Edition

This is the engineering review behind the public policy at `/windows/privacy.html`. It maps requirement 7
(security/privacy) to code and names the residual risks. **It is not a certification or a penetration test.**

## 1 · Transport

| Control | Implementation | Verification |
|---|---|---|
| HTTPS only | Production URL is HTTPS; MSIX start page uses `https://`; `validateIdentity` rejects `http://`. | `tests/windows-msix.test.mjs` |
| HSTS | Set by Vercel deployment (`vercel.json`/platform defaults). | Check production headers |
| Mixed content | No third-party scripts by default; ad scripts load only after explicit configuration. | DevTools console |
| Service worker scope | Root scope on the app origin; static assets only. | `tests/update-cache.test.mjs`, `tests/windows-pwa.test.mjs` |

## 2 · Secrets

- No AI provider keys are used in the front end. AI calls go to the existing backend endpoints.
- The Windows configuration contains **no** API keys: `public/windows/ads-config.json` has empty values.
- `windows/scripts/Test-MsixPackage.ps1` scans package text for `OPENAI_API_KEY`, `DATABASE_URL`,
  `SUPABASE_SERVICE_ROLE`, `FIREBASE_PRIVATE_KEY`, `MONETAG_ZONE`, JWT-looking strings and private keys.
- Build-time variables must never be prefixed with `VITE_` unless they are public by design.
- Certificates are excluded: `.pfx`, `.p12`, `.cer`, `certs/`. No certificate is committed.

## 3 · Session and token storage

- The backend issues the session/token used by the existing web app; the Windows app stores it in the
  app's origin-scoped storage inside the Edge WebView2 (MSIX) or browser profile (PWA).
- Requests with `Authorization` are **never** cached by the service worker.
- Sign-out clears the session keys; “log out from all devices” revokes server-side sessions.
- **Residual risk:** Windows does not expose DPAPI/credential locker to hosted web content. A person with
  access to the unlocked Windows profile and the app data can read the token. Mitigations: sign out on
  shared devices, OS account lock, session revocation, short-lived tokens on the backend. Do not describe
  this as “hardware-backed secure storage”.

## 4 · API response handling

- Existing front-end API clients validate errors and surface retryable states. The Windows shell adds a
  top-level error boundary and an offline banner.
- The service worker does not fabricate responses for `/api/`; a network failure remains a failure.
- No mock API, demo users, or static statistics are introduced by the Windows layer.

## 5 · Local data inventory

| Key / store | Contents | Cleared on sign-out |
|---|---|---|
| `nx_token` (existing) | session token | yes |
| `nx_accounts` (existing) | account list/metadata | yes |
| `nx_theme`, `nx_lang` | UI preferences | no (intentional) |
| `nx_surface` (sessionStorage) | `msix` or `pwa` surface hint | session end |
| `nx_ads_consent` | `granted`/`denied` | user can clear |
| `nx_ad_freq` | frequency gate timestamp/count | expiry |
| Service worker caches | static app shell/assets | app data clear |
| Studio project data | existing app storage | existing flows |

The public policy lists the same categories and explains retention.

## 6 · Microsoft Store requirements

- Privacy policy URL reachable without sign-in: `/windows/privacy.html`.
- Support contact published: `/windows/#support` + email.
- No deceptive ads (none enabled), no fake system UI, no hidden charges.
- Account deletion available in-app (existing account settings).
- Age rating and AI-content disclosure completed in Partner Center.
- Package identity only from Partner Center; no invented Product ID.
- Package must not request capabilities it does not use: only `internetClient` (+ server for WebView2).

## 7 · Threat model (short)

| Threat | Mitigation | Residual |
|---|---|---|
| Token theft from local storage | origin isolation, HTTPS, revocation, sign-out | unlocked-profile access |
| XSS via AI/user content | existing React escaping; no `dangerouslySetInnerHTML` added; links sanitised by app | inherited web risk |
| Malicious ad script | disabled by default; consent; no arbitrary provider config from URL | if enabled without verification |
| Supply-chain package | no new native dependency; `npm ci`; lockfile committed | npm ecosystem risk |
| Fake update prompt | SW update only from same origin, user-confirmed | none added |
| Backend secrets leak in package | no secrets in front end; package scan | build misconfiguration |
| Ad fraud accusation | no local impressions/clicks; provider-only measurement | none |

## 8 · What was not tested

- No penetration test, no Windows Defender/App Certification Kit run (no Windows host).
- No certificate chain/signing test (no certificate).
- No real advertising provider test.
- No GDPR legal review; the policy is a good-faith engineering document, not legal advice.

## 9 · Before Store submission

1. Run the package inspector and an antivirus scan on the built MSIX.
2. Run Microsoft’s Windows App Certification Kit if available.
3. Confirm production headers (`Strict-Transport-Security`, `X-Content-Type-Options`, frame policy).
4. Re-read the privacy policy against the final build and advertising state.
5. Publish the policy and support pages **before** submitting the package.
