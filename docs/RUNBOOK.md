# Runbook: idea → App Store

```
idea ─► intake ─► spec ─► scaffold ─► build ─► playtest ─► listing ─► assets ─► legal ─► preflight
  (agent)  (agent)  (script)  (agent)   (script)   (agent)   (script)  (script)  (script)
                                                                                    │
            human: app record ◄─ CI: farm-asc bundle-id                             ▼
   CI: farm-native-qa (macOS sim: Maestro, native shots + preview)  [optional, recommended]
   CI: farm-ios-release (EAS build ─► TestFlight)
   CI: farm-asc listing ─► price ─► attach
   human: TestFlight check ─► "submit" ─► CI: farm-asc submit
```

## Cloud session (this is where most of the work happens)
1. `npm run farm -- new "<idea>" --name <name>` — or say `/farm "<idea>"`.
2. Agent stages: `npm run farm -- next <slug>` → do it → `npm run farm -- gate <slug> <stage>`.
3. Script stages: `npm run farm -- run <slug> <stage>`.
4. Fully headless alternative: `npm run farm -- auto <slug> --agent claude` (stops at CI/human stages).
5. Commit + push. The PR shows the app, the store assets and the reports.

## Release (GitHub Actions — triggerable from the cloud session)
| Order | Workflow | Inputs |
|---|---|---|
| 1 | `farm-legal-site` | – (also runs on merge to main when `apps/*/site` changes) |
| 2 | `farm-asc` | `action=bundle-id` |
| 3 | *human* | create app record → `farm set <slug> ascAppId <id>` (docs/HUMAN_STEPS.md §3) |
| 4 | `farm-native-qa` | slug — native screenshots/preview replace the web captures |
| 5 | `farm-ios-release` | slug — EAS build → TestFlight |
| 6 | `farm-asc` | `action=listing`, then `action=price`, then `action=attach` |
| 7 | *human* | TestFlight check, App Privacy, then "submit" → `farm-asc action=submit confirm=SUBMIT` |

## Web games (`app.kind: "web-game"`, Capacitor) — AGENTS.md rule 4 exception
For a finished, self-contained offline web game that lives in its own repo (e.g. `apps/straitwatch` ←
`50thycal/td_cargo_ship`). The game repo owns the code, the store flavour (`npm run build:store`) and the committed
Capacitor iOS project; app_farm owns the spec, listing, captures, legal pages, preflight and the release.
```
intake ─► spec (kind web-game + source) ─► scaffold (checkout + npm ci → apps/<slug>/source, not committed)
  ─► build (gate: store build + screens exist + e2e/journeys.json) ─► playtest (game's own suites, the store bundle at
  4 phone sizes, farm journeys; any runtime request to another host fails) ─► listing ─► assets (captured from the
  real store build; landscape 2868×1320 + 1920×886 preview when orientation is landscape) ─► legal ─► preflight
  (replacement checks, see apple/REVIEW_GUIDELINES_CHECKLIST.md 4.2)
```
- Game changes go to the game repo (its own PR), never into `apps/<slug>/source`; re-run scaffold to move to a new
  ref. `farm run <slug> playtest --fast` skips the suites for quick capture iterations (the gate then fails).
- Captures can use `store/capture.mjs` hooks (real taps on a game, e.g. play to wave 3) and `seed` (a demo save in
  localStorage) in `shots.json` / `e2e/journeys.json`.
- Release order: `farm-legal-site` → `farm-asc action=bundle-id` → human: app record + `farm set <slug> ascAppId` →
  human: create the IAP product and the Game Center leaderboards/achievements in App Store Connect (ids must match
  the game) → **`farm-capacitor-release`** (macos-15: store build + `farm bundle-check` gate → `cap sync ios` →
  `xcodebuild archive` with automatic signing via the API key → export .ipa → upload to TestFlight → `mark-build`)
  → `farm-asc action=listing` → `action=attach` → human: TestFlight check, App Privacy, "submit". (`action=price`
  sets the app itself to Free; the unlock's price is set on the IAP product.)

## Updating an app later
Bump `spec.json app.version` → `npm run farm -- run <slug> scaffold` (re-renders config only) → change code →
playtest → assets (if UI changed) → preflight → `farm-ios-release` → `farm-asc listing` (set `whatsNew` in
listing.json) → attach → submit.

## Rejections
Paste Apple's message to the agent. It identifies the guideline, fixes the cause, adds a preflight check if the
issue was detectable, and resubmits after your OK. Reply in Resolution Center when clarification (not a code
change) is what's needed.
