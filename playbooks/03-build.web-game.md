## Stage 3 — Build (web game: `app.kind: "web-game"`)

The game is built **in its own repo** (`{{sourceValue}}` via `spec.json → source`), checked out read-only at
`{{source}}`. Do game changes there, in a branch/PR of the game repo, then re-run `npm run farm -- run {{slug}} scaffold`
to move the checkout to the new ref. Never commit changes inside `{{source}}`.

What the game repo must provide (preflight enforces it — AGENTS.md rule 4 exception):
- `source.buildCmd` (e.g. `npm run build:store`) → `source.webDir/source.entry` with
  `<meta name="app-flavor" content="store">`; no playtest notes, log upload, developer mode (`source.forbid`), no
  remote URLs/`fetch`/`/api/`/sockets; the in-app privacy link to the farm's legal URL.
- Capacitor: `capacitor.config.*` (appId = `spec.app.bundleId`, webDir = `source.webDir`, no `server.url`), the
  committed iOS project (`source.ios.project`, Swift Package Manager), `@capacitor/preferences` + `@capacitor/haptics`,
  Info.plist orientation lock matching `spec.app.orientation`, `ITSAppUsesNonExemptEncryption=false`, a launch
  storyboard, `PrivacyInfo.xcprivacy`, an opaque 1024 icon, `TARGETED_DEVICE_FAMILY` 1 unless `supportsTablet`,
  Game Center code + entitlement when `spec.app.gameCenter`, package.json `version` = `spec.app.version`.

Here, write `{{journeys}}`: farm smoke flows run against the store bundle at phone size. Same DSL as Expo apps plus
`{tap|expect:{css:"…"}}`, `{tapAt:[x,y]}`, `{hook:"name", ms, args}` (functions in `store/capture.mjs` that drive the
real UI, e.g. play a wave) and per-journey `seed` (localStorage items such as a demo save). One journey per spec
journey; include Settings showing the privacy link.

Verify: `npm run farm -- gate {{slug}} build`, then `npm run farm -- run {{slug}} playtest` and LOOK at every capture in
`{{reports}}/playtest/`.
