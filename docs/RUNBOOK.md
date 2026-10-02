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

## Updating an app later
Bump `spec.json app.version` → `npm run farm -- run <slug> scaffold` (re-renders config only) → change code →
playtest → assets (if UI changed) → preflight → `farm-ios-release` → `farm-asc listing` (set `whatsNew` in
listing.json) → attach → submit.

## Rejections
Paste Apple's message to the agent. It identifies the guideline, fixes the cause, adds a preflight check if the
issue was detectable, and resubmits after your OK. Reply in Resolution Center when clarification (not a code
change) is what's needed.
