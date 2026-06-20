# Android Play Store Roadmap

## Summary

Release Habits Social as a Trusted Web Activity using Bubblewrap. Work is ordered from the easiest repository work to the most complex, while delaying Play developer account fees, identity verification, and console-only work until the app is ready.

- Intended package ID: `com.habitssocial.app`
- Audience: adults 18+
- Monetization: free, no ads or purchases
- Production host: `www.habitssocial.com`

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

## 2. Improve the PWA manifest — Small code phase

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

## 3. Generate the local Android TWA — Moderate tooling phase

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

## 4. Establish local TWA ownership — Small code and deployment phase

1. Obtain the upload certificate's SHA-256 fingerprint.
2. Create `/.well-known/assetlinks.json`.
3. Associate `www.habitssocial.com` with `com.habitssocial.app`.
4. Publish the upload certificate fingerprint.
5. Add an automated check for:
   - Public availability without authentication
   - Valid JSON
   - Correct package ID
   - Correct upload fingerprint
6. Build and install the upload-key-signed Android app.
7. Confirm it opens fullscreen without Chrome's toolbar.

The Google Play App Signing fingerprint is added later after the first Play upload.

## 5. Record policy acceptance — Moderate code and database phase

1. Assign version identifiers to the current Terms and Privacy Policy.
2. Add tests requiring policy acceptance during registration.
3. Store:
   - Accepted Terms version
   - Accepted Privacy Policy version
   - Acceptance timestamp
4. Generate the required database migration.
5. Add an explicit acceptance checkbox to email registration.
6. Apply the same requirement to Google registration.
7. Reject missing, false, malformed, or stale policy versions server-side.
8. Prompt existing users once if no current acceptance is recorded.
9. Do not block account deletion, logout, or policy viewing from that prompt.
10. Run migration validation, service tests, type-checking, and the production build.

## 6. Add reporting and moderation — Largest code phase

1. Support two report targets:
   - User
   - Individual chat message
2. Define a small fixed list of report reasons and a bounded optional explanation.
3. Add a private reports table containing:
   - Reporter
   - Target type and identifier
   - Reason and explanation
   - Review status
   - Creation and resolution timestamps
4. Implement authenticated `POST /api/reports`.
5. Validate target existence and visibility.
6. Prevent users from reporting themselves or inaccessible messages.
7. Prevent duplicate-report flooding and apply a bounded rate limit.
8. Add Report User to the existing profile menu.
9. Add Report Message to the existing message menu.
10. Offer blocking after successful reporting.
11. Notify the support address without placing sensitive content in application logs.
12. Keep report records inaccessible to ordinary users.
13. Document the manual review, suspension, rejection, and resolution process.
14. Test authorization boundaries, invalid targets, rate limits, duplicate reports, blocking, and sensitive-data handling.
15. Run migration checks, type-checking, tests, and the production build.

## 7. Prepare store material and reviewer access

1. Draft the short store description.
2. Draft the full store description.
3. Confirm the existing 512×512 icon against Play requirements.
4. Create the 1024×500 feature graphic.
5. Create a dedicated reviewer account.
6. Populate it with:
   - Several habits and logs
   - At least one bucket
   - A friend connection
   - Example chat messages
7. Prepare a screenshot checklist.
8. Capture final screenshots only after the release UI is stable.
9. Prepare App Access instructions for the reviewer account.
10. Prepare final Data Safety answers from actual runtime behavior.

## 8. Qualify the complete Android build locally

Test in failure-first order:

1. Installation and fullscreen TWA verification
2. Navigation and Android Back behavior
3. Email/password authentication
4. Google authentication
5. Session persistence after restart
6. Online habit and bucket operations
7. Offline restart and local operations
8. Reconnection and synchronization
9. Background and foreground recovery
10. Realtime chat reconnection
11. Push permission and delivery
12. Notification-link routing
13. User and message reporting
14. User blocking
15. Account deletion and local-data clearing
16. External-link handling
17. Upgrade from an earlier local build
18. Full type-check, tests, production build, service-worker verification, and TWA verification

## 9. Create and verify the Play developer account — Manual external phase

Do this only when the application and store material are ready.

1. Decide whether public disclosure under a personal developer account is acceptable:
   - Legal name
   - Country
   - Developer email
2. Use a permanent Google account and enable two-step verification.
3. Prepare:
   - Exact legal name and address
   - Working contact phone number
   - Private contact email
   - Public developer email
   - Government-issued ID if requested
   - Non-prepaid supported payment card
4. Register a Personal Play developer account.
5. Accept the Developer Distribution Agreement.
6. Pay the one-time US$25 registration fee.
7. Use `DevFoFun` as the public developer name.
8. Use `support@habitssocial.com` as the public developer email.
9. Verify the contact email, developer email, and phone number.
10. Complete legal identity verification.
11. Complete Android device verification using the Play Console mobile app when requested.
12. Resolve every account-level setup warning before creating the app.

An Organization account should only be used if a real registered organization and matching D-U-N-S record are available.

## 10. Create the Play Console app and lock its identity — Manual external phase

1. Create the Play Console application with:
   - Default language: English (United States)
   - App name: `Habits Social`
   - Type: App
   - Pricing: Free
   - Support email: `support@habitssocial.com`
2. Accept the required policy, export-law, and Play App Signing terms.
3. Select the Productivity category.
4. Add only clearly relevant store tags.
5. Enter the verified Privacy Policy URL.
6. Enter the existing account-deletion instructions URL.
7. Declare that the app contains no ads.
8. Add the reviewer credentials and App Access instructions.
9. Declare the target audience as 18 and over only.
10. Enable the available minor-access restriction that matches the 18+ Terms.
11. Record that the app includes:
    - User-generated content
    - Social interaction
    - Chat or messaging
    - Blocking
    - User and message reporting
12. Complete the content-rating questionnaire.
13. Complete Data Safety from actual runtime behavior.
14. Upload the icon, feature graphic, descriptions, and screenshots.

## 11. Upload internally and finalize Play signing — Requires Phase 10

1. Build the upload-key-signed Android App Bundle.
2. Upload it to the internal-testing track.
3. Confirm that `com.habitssocial.app` is accepted and permanently bound to the Play application.
4. If the package ID is already claimed, stop before publication, choose a replacement, and update the Android project and asset links together.
5. Allow Google Play to generate and protect the app-signing key.
6. Obtain the Play App Signing SHA-256 fingerprint.
7. Add the Play fingerprint alongside the upload fingerprint in `/.well-known/assetlinks.json`.
8. Redeploy and verify both fingerprints.
9. Install the Play-provided internal build.
10. Confirm it opens fullscreen without Chrome's toolbar.
11. Re-run the physical Android qualification checks affected by Play signing or distribution.

## 12. Run mandatory closed testing and release

Before starting, reconfirm Google's current tester-count and duration requirements because they may change.

1. Recruit at least 15 genuine testers to protect against dropouts.
2. Publish the approved bundle to closed testing.
3. Meet Google's required minimum opted-in tester count.
4. Maintain the required tester count continuously for the required duration.
5. Give testers workflows covering authentication, offline use, chat, push, reporting, blocking, and deletion.
6. Record feedback and engagement.
7. Fix release-blocking defects.
8. Increment the version code for every corrected bundle.
9. Retest affected workflows.
10. Apply for production access with the collected testing evidence.
11. Reconfirm that the Privacy Policy and Data Safety answers match runtime behavior.
12. Verify all public policy and deletion URLs.
13. Verify reviewer credentials.
14. Upload the qualified production bundle.
15. Release to 10% and review Play Vitals, support requests, synchronization failures, authentication failures, and reports.
16. Expand to 50% and review again.
17. Expand to 100%.
18. Keep the package ID permanent and increment `versionCode` for every future bundle.

## Assumptions

- The Android app remains a TWA rather than Capacitor.
- The publisher will use a new personal Play developer account unless a registered organization is available.
- The existing account-deletion implementation and help-center instructions are retained.
- No advertising, billing, subscriptions, or native-only features are included.
- Repository changes require a single-use `implementify` authorization per coding phase.
