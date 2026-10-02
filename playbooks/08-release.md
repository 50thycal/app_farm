## Release: build, TestFlight, App Store Connect listing

Prerequisites (one-time, see `docs/SETUP.md` and `docs/HUMAN_STEPS.md`): Apple Developer Program membership,
App Store Connect API key, Expo account + `EXPO_TOKEN`, GitHub secrets, the App Store Connect app record for
`{{slug}}`'s bundle id.

From any session (this cloud session included) trigger GitHub Actions — via the GitHub MCP `actions_run_trigger`
tool, the GitHub UI, or `gh workflow run`:
1. `farm-asc.yml` with `action=bundle-id` (registers the bundle id) — first time only
2. create the app record (human step, 1 minute) → `npm run farm -- set {{slug}} ascAppId <id>` → commit
3. `farm-ios-release.yml` → EAS cloud build (production) → auto-submit to TestFlight
4. `farm-asc.yml` with `action=listing` → metadata, screenshots, preview, age rating, review info
5. `farm-asc.yml` with `action=price` → Free (if the app is free)
6. `farm-asc.yml` with `action=attach` → attaches the processed build to the version
Then mark stages: `npm run farm -- gate {{slug}} release --force` (once TestFlight has the build) and
`npm run farm -- gate {{slug}} store --force`.
