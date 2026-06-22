# Android Play Store Roadmap

## Summary

Release Habits Social as a bundled Capacitor Android application while retaining the existing website and installable PWA.

Phases 1–3 record the completed TWA investigation. On June 22, 2026, the Android architecture pivoted from Trusted Web Activity (TWA) to Capacitor because a TWA deliberately shares Chrome's cookies, IndexedDB, Cache Storage, service worker, and login session for `www.habitssocial.com`. The product requirement is an Android app with an independent login session and local cache.

The Capacitor app will package the Nuxt client inside the Android application, use the same Habits Social accounts and server data, retain the existing Dexie offline model inside Android's private WebView storage, and use native Firebase Cloud Messaging for Android notifications.

- Intended package ID: `com.habitssocial.app`
- Audience: adults 18+
- Monetization: free, no ads or purchases
- Production API host: `www.habitssocial.com`
- Android architecture: bundled Capacitor app, not a remote WebView
- Website/PWA: retained
- Google authentication: removed from all platforms
- Initial Capacitor release: `1.7.0`, version code `1`

## 1. Correct existing public policies — Complete June 20, 2026

1. Audit the data and external services actually used.
2. Remove unsupported claims about:
   - Advertising identifiers
   - Advertising networks
   - Personalized advertising
   - Advertising SDKs
   - Ad-consent controls
3. Document the real providers and purposes.
4. Update the Privacy Policy and Terms of Service dates.
5. Verify these public logged-out URLs:
   - Privacy Policy
   - Terms of Service
   - Contact Support
   - Account-deletion instructions
6. Retain this deletion URL:

   `https://www.habitssocial.com/help-center/creating-an-account-and-logging-in/#delete-your-account`

No new deletion article is required.

## 2. Improve the PWA manifest — Complete June 20, 2026

1. Add a stable manifest `id`.
2. Add a user-facing manifest description.
3. Retain the existing start URL, scope, standalone display, theme colors, and icons.
4. Add one small automated check for:
   - Manifest availability
   - Stable ID
   - Start URL and scope
   - Required 192×192 and 512×512 icons
   - Maskable icon
   - Service-worker availability
5. Run the production build and existing service-worker verification.

## 3. Generate the local Android TWA — Complete June 22, 2026

No Play developer account is required for this phase.

1. Confirm the current Google Play target SDK requirement.
2. Invoke Bubblewrap without adding it as an unnecessary application dependency.
3. Generate the Android project under `android/`.
4. Configure:
   - Application ID `com.habitssocial.app`
   - Host `www.habitssocial.com`
   - Scope `/`
   - App name `Habits Social`
   - Version name `1.6.0`
   - Version code `1`
   - Existing branding and theme colors
5. Treat the application ID as intended but not yet reserved; only the first successful Play upload can confirm and permanently bind it.
6. Generate a dedicated upload key outside the repository.
7. Exclude key files, passwords, and signing properties from Git.
8. Create an encrypted backup of the upload key and credentials.
9. Build a debug APK.
10. Install it on a physical Android device.
11. Confirm the app launches and reaches the production site.

The TWA was a successful feasibility spike, but it is not the release architecture. Its shared Chrome storage behavior does not meet the product requirement for an independent Android session and cache.

## Pivot Decision — June 22, 2026

Use a bundled Capacitor 8 application from Phase 4 onward.

Decisions:

- Package the Nuxt client in the APK/AAB; never use Capacitor `server.url` in production.
- Keep the same server accounts, habits, friends, messages, and synchronization APIs.
- Keep Android's login session, IndexedDB, cache, and application lifecycle separate from Chrome/PWA.
- Keep Dexie/IndexedDB rather than introducing a native SQLite migration.
- Keep the website and installable PWA.
- Remove Google Sign-In everywhere.
- Require native Android push notifications before Play release.
- Preserve the existing external upload key and encrypted backup.
- Commit the Capacitor Android project; it is no longer treated as disposable generated output.

## 4. Retire the TWA and remove Google authentication — Complete June 22, 2026

1. Delete the Bubblewrap `android/` project and `twa-manifest.json`. — complete
2. Remove `android/` from `.gitignore`. — complete
3. Continue ignoring: — complete
   - `*.jks`
   - `*.keystore`
   - Signing properties
   - Gradle caches and generated APK/AAB outputs
4. Preserve the upload key and encrypted backup. — complete
5. Uninstall the TWA debug application before Capacitor isolation testing. — complete
6. Remove the Google Identity Services script and login/signup UI. — complete
7. Delete the Google login, Google registration, and Google client-ID endpoints. — complete
8. Remove Google token-verification helpers, environment variables, CSP allowances, tests, and documentation. — complete
9. Do not migrate existing Google-created accounts: the previous Google registration flow required users to create a normal password. — complete
10. Verify existing users can sign in with email/password and use password reset. — complete

## 5. Establish the bundled Capacitor foundation — Complete June 22, 2026

1. Install Android Studio 2025.2.1 or newer with its embedded JDK and Android SDK. — complete (Android Studio 2025.3.3 at `C:\Program Files\Android\Android Studio\`, embedded JDK at `jbr\`, SDK at `C:\Users\Dwayne\AppData\Local\Android\Sdk\` with platforms/android-36 + build-tools 36.1.0/35.0.0/37.0.0 + platform-tools)
2. Pin Capacitor 8 packages to one compatible version. — complete (all `@capacitor/*` pinned `^8`; resolved 8.0.1–8.4.1, deduped against `@capacitor/core@8.4.1`)
3. Add only required native dependencies: — complete
   - Capacitor core, CLI, and Android — `@capacitor/core@8.4.1`, `@capacitor/cli@8.4.1` (dev), `@capacitor/android@8.4.1`
   - App lifecycle — `@capacitor/app@8.1.0`
   - Network state — `@capacitor/network@8.0.1`
   - System browser — `@capacitor/browser@8.0.3`
   - Push notifications — `@capacitor/push-notifications@8.1.1` (installed only; usage is Phase 8)
   - Android Keystore-backed secure storage — `@aparajita/capacitor-secure-storage@8.0.0` (community plugin; the plan-named `@capacitor-community/secure-storage` does not exist on npm; this is the active Capacitor 8 secure-storage plugin, verified via its README to use AES-GCM with an Android KeyStore-generated key; installed only, usage is Phase 6)
4. Add a native Nuxt build mode that: — complete (gated on `process.env.HABITS_BUILD === 'native'`)
   - Uses `ssr: false` — complete
   - Produces `.output/public/index.html` — complete (`nitro.preset = 'static'` under native)
   - Disables `@vite-pwa/nuxt` and service-worker generation for native builds only — complete (web build keeps PWA; native build asserts no `sw.js`, no `manifest.webmanifest`)
   - Embeds the production API and PartyKit hosts at build time — complete (`build:native` script sets `NUXT_PUBLIC_API_BASE_URL=https://www.habitssocial.com` + `NUXT_PUBLIC_PARTYKIT_HOST=habits-social-realtime-production.ieatcode4breakfast.partykit.dev` + `NUXT_PUBLIC_REALTIME_ENABLED=true`; native CSP meta tag in `index.html` contains both `https://` and `wss://` forms of the PartyKit host, both asserted by `verify-native-build.mjs`)
5. Generate a fresh Capacitor Android project and commit it. — complete (`npx capacitor add android`; `android/` source tree staged, NOT gitignored per pivot decision; only build outputs + keys + `local.properties` ignored)
6. Configure: — complete
   - Package ID `com.habitssocial.app` — verified via `aapt2 dump badging` on the built debug APK: `package: name='com.habitssocial.app'`
   - App name `Habits Social` — verified via `aapt2 dump badging`: `application-label:'Habits Social'`
   - Version `1.7.0` — verified: `versionName='1.7.0'`
   - Version code `1` — verified: `versionCode='1'`
   - Minimum SDK 24 — verified: `minSdkVersion:'24'`
   - Compile and target SDK 36 — verified: `targetSdkVersion:'36'`, `compileSdkVersion='36'`
   - Existing icon, splash, and black branding — complete (5 mipmap density buckets via extended `scripts/generate-icons.js`; black `windowBackground` in `styles.xml`)
7. Do not enable remote `server.url`, cleartext traffic, mixed content, or unrestricted WebView navigation. — complete (`capacitor.config.ts` has no `server.url` (only `androidScheme: 'https'`); `android.allowMixedContent: false`; `AndroidManifest.xml` has no `usesCleartextTraffic`; no unrestricted-navigation intent filter; only MAIN/LAUNCHER filter)
8. Add deterministic scripts for: — complete (npm scripts added to `package.json`)
   - Native web build — `build:native` (zero-dep Node wrapper `scripts/build-native.mjs`, no `cross-env` dependency)
   - Capacitor sync — `cap:sync` and `cap:sync:full`
   - Debug APK — `android:debug` (note: uses `capacitor build android --debug` which is unsupported in Cap 8; actual debug build is `cd android && .\gradlew.bat assembleDebug` with `JAVA_HOME` set to Android Studio's `jbr\`)
   - Signed release AAB — `android:release` (fails closed if `android/keystore.properties` is absent)
9. Add a native-build assertion that checks: — complete (`scripts/verify-native-build.mjs`, modeled on `scripts/verify-sw-build.mjs`)
   - `index.html` exists — assertion (a)
   - No service worker is bundled — assertion (b): `sw.js` absent; assertion (c): `manifest.webmanifest` absent; assertion (d): no `push-sw.js` reference
   - No Google Identity script is bundled — assertion (e): no `accounts.google.com`, `gsi/`, `client_id`
   - The native CSP and production hosts are present — assertion (f): both `https://` AND `wss://` forms of the production PartyKit host explicitly checked (after a review caught the initial raw-host-count hole); assertion (h): `apiBaseUrl` embedded in payload
   - Additional assertions: (g) no `.output/server/index.mjs` (static preset confirmed); (i) no help-center content bundled (Option A: Android help loads live via in-app browser)

Agent-runnable verification (Phase 5D): all 6 steps PASS — 754 tests, typecheck clean, web build 16/16 assertions, native build 9/9 assertions, `cap:sync:full` completed, no secrets staged.

Build and run verification (Phase 5E, partial): the debug APK builds via `gradlew assembleDebug` (BUILD SUCCESSFUL in 1m 10s), installs via `adb install` (Success), and launches on a physical Android device. App build, package identity, manifest, and install path are confirmed working on real hardware.

Deferred to Phase 6: the real-device Help Center tap (Phase 5E step E3). The Help button lives inside the authenticated layout (`app/layouts/default.vue`), which requires login. The native build currently has no centralized API client wired — relative `/api/...` calls hit `https://localhost` and die. Phase 6 wires the centralized client + bearer-token storage; once login works on native, the Help Center tap becomes the first device checkpoint of Phase 6. The unit tests already prove `useHelpModal.open()` branches correctly: under the native flag `Browser.open` is called with `https://www.habitssocial.com/help-center/<path>` and `isOpen` stays false; under the web flag `isOpen` is set true and `Browser.open` is NOT called.

## 6. Implement independent Android authentication and storage

Carries one deferred checkpoint from Phase 5: the real-device Help Center tap. The Help button lives inside the authenticated layout, so the in-app browser sheet (Option A) cannot be tested on a device until login works on native. Once the centralized API client + bearer-token storage in steps 2–3 below are wired and a user can log in on the Android app, the first device checkpoint of this phase is: tap Help Center inside the logged-in app and confirm the Capacitor Browser sheet opens to `https://www.habitssocial.com/help-center/welcome` with no login wall. This closes the Phase 5E device-test gap.

Note on the `@aparajita/capacitor-secure-storage` plugin installed in Phase 5: audit its transitive dependency tree for risk before wiring JWT storage in step 3. The plan originally named `@capacitor-community/secure-storage` which does not exist on npm (404); the substitution was verified via the plugin's README to use AES-GCM with an Android KeyStore-generated key (key never leaves the secure element), satisfying the Android-Keystore-backed requirement.

1. Keep existing account IDs, JWT format, and server data.
2. Introduce one centralized API client:
   - Web/PWA uses relative URLs and existing HttpOnly cookie authentication.
   - Android uses absolute production URLs and `Authorization: Bearer <token>`.
3. Store Android's JWT only in Android Keystore-backed secure storage.
4. Store only the non-secret cached user profile in local storage.
5. Apply explicit connection and read timeouts to native API traffic.
6. Add `X-Habits-Client: android/1.7.0` to Android requests.
7. Extend `/api/auth/me` to return a renewed bearer token when the existing sliding-session threshold is reached.
8. Route every client API call through the centralized client.
9. Retain the existing Dexie database and synchronization logic.
10. Request persistent storage on native startup where supported.
11. Disable Android cloud backup and data extraction for application storage. — already set in Phase 5 (`android:allowBackup="false"` in `AndroidManifest.xml`)
12. On logout or account deletion, clear:
    - Secure JWT
    - Cached user profile
    - All Dexie data and pending synchronization state
    - Native push token registration
    - Delivered notifications
13. Fail closed on missing, malformed, expired, or revoked bearer tokens.

Isolation acceptance gate:

1. With Chrome/PWA logged in, a fresh Android install must show the login screen.
2. Android login/logout must not change Chrome/PWA authentication.
3. Android IndexedDB and cached data must survive process termination and device restart.
4. Clearing Android app data must not alter Chrome/PWA data.
5. Uninstalling Android must not alter Chrome/PWA data.

## 7. Adapt application behavior to Android

1. Use Capacitor Network events to trigger reconnection and synchronization.
2. Use Capacitor App lifecycle events for:
   - Foreground refresh
   - Realtime reconnection
   - Background cleanup
3. Integrate Android Back with the existing router and modal-history behavior.
4. Exit the application only from the root screen when no modal or nested route is active.
5. Open external URLs in the system browser.
6. Keep internal help content bundled.
7. Preserve PartyKit realtime behavior through authenticated token requests.
8. Add a native CSP limited to required production API, PartyKit, image, and asset hosts.
9. Permit HTTPS only.
10. Verify offline creation, restart, reconciliation, and conflict handling before native push work begins.

## 8. Add native Android push notifications

1. Create a Firebase project with Analytics disabled.
2. Register `com.habitssocial.app`.
3. Add the Firebase `google-services.json` to the Android app.
4. Store Firebase service-account credentials only as Cloudflare secrets.
5. Add a bounded native device-token table containing:
   - User ID
   - Unique FCM token
   - Platform
   - App version
   - Last-seen, created, updated, and disabled timestamps
6. Add authenticated device-token registration and deletion endpoints.
7. Register and rotate the FCM token after login and permission approval.
8. Request notification permission only from a clear user action.
9. Create explicit Android notification channels for chat and social activity.
10. Send through FCM HTTP v1 with:
    - Short timeouts
    - Cached OAuth access tokens
    - Bounded concurrency
    - Automatic disabling of invalid tokens
11. Continue Web Push for website/PWA subscriptions.
12. Do not include chat text, usernames, emails, habit names, or other sensitive content in FCM payloads.
13. Use generic notification text and fetch current content after the app opens.
14. Route notification taps to the intended inbox, friend, or social screen.
15. Remove native push tokens on logout and account deletion.
16. Update the Privacy Policy and Data Safety documentation for Firebase installation identifiers, tokens, and delivery metrics.

## 9. Record policy acceptance

1. Assign versions to the current Terms and Privacy Policy.
2. Store:
   - Accepted Terms version
   - Accepted Privacy Policy version
   - Acceptance timestamp
3. Add an explicit acceptance checkbox to email registration.
4. Reject missing, false, malformed, or stale acceptance server-side.
5. Prompt existing users once when current acceptance is absent.
6. Do not block logout, account deletion, or policy viewing from the prompt.
7. Test registration, stale versions, malformed payloads, existing-user prompts, and allowed escape routes.
8. Run migration validation, service tests, type-checking, web build, and native build.

## 10. Add reporting and moderation

1. Support reports against:
   - Users
   - Individual chat messages
2. Define a small fixed reason list and a bounded optional explanation.
3. Add private report records containing:
   - Reporter
   - Target type and identifier
   - Reason and explanation
   - Review status
   - Creation and resolution timestamps
4. Implement authenticated report submission.
5. Validate target existence, visibility, and ownership boundaries.
6. Prevent self-reporting and reports against inaccessible messages.
7. Prevent duplicate-report flooding and apply bounded rate limits.
8. Add Report User and Report Message actions.
9. Offer blocking after a successful report.
10. Keep report records inaccessible to ordinary users.
11. Notify support without placing sensitive report or message content in logs.
12. Document manual review, suspension, rejection, and resolution.
13. Test authorization, invalid targets, duplicates, rate limits, blocking, and sensitive-data handling.

## 11. Qualify the complete Android application locally

Test in failure-first order:

1. Fresh install and storage isolation from Chrome/PWA
2. Email signup, login, logout, password reset, and session renewal
3. Process death and device restart
4. Online habit and bucket operations
5. Offline launch, edits, restart, and reconciliation
6. Background and foreground recovery
7. Realtime chat reconnection
8. Android Back and modal behavior
9. Notification permission denied, granted, and revoked
10. Foreground, background, killed-app, and notification-tap behavior
11. User and message reporting
12. User blocking
13. Account deletion and complete local-data clearing
14. External links and password-reset deep links
15. Upgrade without local-data loss
16. Accessibility, keyboard, safe areas, rotation, dark theme, and large text
17. Release build with remote debugging disabled

Automated gates:

1. Full type check and test suite
2. Production web build and PWA verification
3. Native static-build assertions
4. Capacitor sync
5. Android lint
6. Debug APK build
7. Upload-key-signed release AAB build
8. Package, version, SDK, permission, signature, and secret-scanning verification

## 12. Prepare store material and reviewer access

1. Draft the short and full store descriptions.
2. Confirm the 512×512 icon against current Play requirements.
3. Create the 1024×500 feature graphic.
4. Create a dedicated reviewer account.
5. Populate it with habits, logs, a bucket, a friend connection, and example chat messages.
6. Prepare Android screenshots only after the release UI is stable.
7. Prepare App Access instructions.
8. Prepare final Data Safety answers from actual runtime behavior.
9. Declare:
   - User-generated content
   - Social interaction
   - Direct messaging
   - Blocking
   - User and message reporting
   - Firebase Cloud Messaging
10. Declare no ads, billing, subscriptions, analytics, location, camera, or microphone.

## 13. Create and verify the Play developer account

Do this only after the application and store material are qualified.

1. Use a permanent Google account and enable two-step verification.
2. Prepare exact legal identity, address, phone, contact email, public developer email, identification, and supported payment card.
3. Register a Personal Play developer account unless a real registered organization and matching D-U-N-S record are available.
4. Accept the Developer Distribution Agreement and pay the registration fee.
5. Use `DevFoFun` as the public developer name.
6. Use `support@habitssocial.com` as the public developer email.
7. Complete contact, identity, and Android-device verification.
8. Resolve every account-level setup warning before app creation.

## 14. Create the Play app and upload internally

1. Create the application as:
   - English (United States)
   - App name `Habits Social`
   - App type
   - Free
   - Productivity category
   - Audience 18 and over
2. Add verified policy and account-deletion URLs.
3. Complete App Access, content rating, Data Safety, UGC, and messaging declarations.
4. Upload the store listing and reviewer credentials.
5. Build and upload the upload-key-signed AAB to internal testing.
6. Confirm and permanently bind `com.habitssocial.app`.
7. If the package ID is unavailable, stop before publication and update the Android project consistently.
8. Enable Play App Signing.
9. Obtain the Play App Signing SHA-256 fingerprint.
10. Publish `/.well-known/assetlinks.json` with upload and Play fingerprints.
11. Restrict Android App Links initially to password-reset routes.
12. Keep browser fallback working when the app is absent.
13. Install the Play-generated internal build.
14. Re-run signing-, storage-, notification-, upgrade-, and deep-link-sensitive tests.

## 15. Run mandatory closed testing and release

Reconfirm current Play requirements immediately before starting.

As of June 22, 2026, newly created personal accounts require at least 12 testers opted in continuously for 14 days.

1. Recruit at least 15 genuine testers to protect against dropouts.
2. Publish the qualified bundle to closed testing.
3. Maintain at least 12 continuously opted-in testers for at least 14 days.
4. Give testers workflows covering:
   - Authentication and storage isolation
   - Offline use and synchronization
   - Chat and realtime recovery
   - Native push
   - Reporting and blocking
   - Account deletion
   - Restart and upgrades
5. Record engagement, feedback, defects, and fixes.
6. Increment `versionCode` for every corrected bundle.
7. Apply for production access with the testing evidence.
8. Reconfirm policy URLs, reviewer credentials, Privacy Policy, and Data Safety answers.
9. Release to 10% and review Play Vitals, support, authentication, sync, push, and moderation failures.
10. Expand to 50% and review again.
11. Expand to 100%.
12. Keep the package ID permanent and increment `versionCode` for every future bundle.

## Assumptions

- Android and web share server accounts and server data but never share local storage or login sessions.
- Dexie remains the Android offline database; no native SQLite migration is planned.
- Google authentication is removed from every platform.
- Native push is mandatory before Play release.
- The website and installable PWA remain supported.
- Native code updates ship only through Play releases; no remote-code or live-update service is used.
- The existing upload key and encrypted backup remain valid.
- The old TWA debug APK is obsolete and must not be distributed.
- Repository changes require a single-use `implementify` authorization per coding phase.
