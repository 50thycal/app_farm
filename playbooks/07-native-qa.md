## Native QA on the iOS Simulator (macOS)

Runs automatically in GitHub Actions (`.github/workflows/farm-native-qa.yml`, macOS runner) or locally on a Mac with
`mac/native-qa.sh {{slug}}`. It:
1. `expo prebuild` + `xcodebuild` a Release simulator build of `{{app}}`
2. boots an iPhone Pro Max simulator, sets a clean status bar (9:41, full battery)
3. runs every Maestro journey in `{{app}}/.maestro/journeys` (compiled from `{{journeys}}`)
4. captures native screenshots for each scene (`store/raw/native/*.png`) and records the preview (`store/raw/native/preview.mov`)
5. writes `{{reports}}/native-qa.json` and commits results back to the branch

Afterwards re-run `npm run farm -- run {{slug}} assets --skip-build` — the composer prefers native captures — and
`npm run farm -- run {{slug}} preflight`.
If a journey fails only on native, fix the app (often: missing `testID`, keyboard covering an input, safe-area
issues, or a web-only API). Check the Maestro output and the screenshots uploaded as workflow artifacts.
