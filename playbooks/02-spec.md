## Stage 2 — Spec: product + review-proof design

**Inputs:** `{{brief}}`, `apple/REVIEW_GUIDELINES_CHECKLIST.md`, `farm.config.json` (bundle id prefix, owner)
**Outputs:** `{{spec}}` (Spec schema below) and `{{specMd}}` (human-readable PRD)

### Rules
- `app.slug` must be exactly `{{slug}}`. `app.bundleId` = `<farm.config.json apple.bundleIdPrefix>.<slug without dashes>`.
  `app.scheme` = slug without dashes. `version` = `1.0.0`. `supportsTablet: false` unless the brief needs iPad.
- **Screens** map 1:1 to Expo Router files under `app/` (relative to the Expo project), e.g.
  `{ "route": "/", "file": "app/(tabs)/index.tsx", "tab": true }`. Tabs live in `app/(tabs)/`; pushed screens in
  `app/` (e.g. `app/entry/[id].tsx`, route `/entry/[id]`). Keep the template's `settings` tab
  (`/settings`, `app/(tabs)/settings.tsx`) — it already has privacy/terms/support links and account deletion.
- **Features**: ≥3 MVP, each with testable acceptance criteria.
- **Journeys**: the 2–6 most important user flows in plain language; the build stage turns them into automated tests.
- **nativeValue**: concrete native capabilities (haptics, offline, notifications, widgets, share sheet, camera, etc.).
- **Accounts**: if any account exists → `deletionInApp: true`; third-party login → include `apple`.
  Prefer no accounts. If accounts are required, provide `demoAccount` (and the backend must accept it).
- **Permissions**: purpose strings must name the feature and the user benefit, e.g. "Scan receipts with the camera
  to add expenses automatically." Never "This app needs access to your camera."
- **Privacy**: list every data type that leaves the device (analytics, crash reporting, backend sync). Local-only
  data is not "collected". This drives the App Privacy label, the privacy policy and the privacy manifest — it must be true.
- **Design**: pick a distinctive primary color and tone; `textColor` must contrast with `backgroundColor`.

The gate runs policy checks (minimum functionality, account deletion, Sign in with Apple, IAP, ATT, UGC moderation,
purpose strings, settings screen). Fix every ❌ before finishing.
