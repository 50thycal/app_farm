# app_farm — operating manual for agents (Claude Code, Codex, any CLI agent)

This repo is a pipeline that turns a rough app idea (or a rough web app) into an iOS app that is built, playtested,
review-proofed and ready to publish on the App Store, with its listing, screenshots and preview video.
You are the operator. The `farm` CLI tracks state, runs the deterministic steps and **gates** every stage.

## The loop
```
npm run farm -- status <slug>          # where are we?
npm run farm -- next <slug>            # full instructions for the next stage
… do the work …
npm run farm -- gate <slug> <stage>    # must pass before moving on
```
Script stages run with `npm run farm -- run <slug> <stage>`. A failing script stage prints exactly what to fix
(`npm run farm -- prompt <slug> <stage>` gives the fix playbook).

Stages: `intake → spec → scaffold → build → playtest → listing → assets → legal → preflight → [native-qa] → release → store → submit`.
Owners: **agent** (you write), **script** (farm runs), **ci** (GitHub Actions), **human** (needs the owner).

## Starting an app
- From an idea: `npm run farm -- new "<idea text>" --name <short-name>`
- From a web app (e.g. Vercel): `npm run farm -- new "<what it is>" --url https://x.vercel.app` (or `--repo owner/repo`)
Then work the loop until the next stage is `ci`/`human`. Commit after each passing gate.

## Rules
1. **Never weaken a gate to pass it.** Fix the app, the data or the copy. If a check is truly wrong, fix the checker in
   a separate, explained commit.
2. **Look at your output.** After playtest and assets, open the PNGs in `apps/<slug>/reports/playtest/` and
   `apps/<slug>/store/screenshots/` and judge them like an App Store reviewer and a picky designer.
3. **No placeholders ever** (lorem ipsum, TODO in UI, fake buttons, "coming soon"). Demo data must look real.
4. **Native, not a website.** Never wrap a web view as the app (Guideline 4.2). Port logic, rebuild UI natively.
5. **Expo changes fast.** Read `apps/<slug>/app/AGENTS.md` and the versioned Expo docs for the SDK in use.
   Use `npx expo install` for packages. Never hand-edit `ios/` or `android/`.
6. **Outward-facing actions need the human:** submitting for review (`asc submit`), spending money, creating
   accounts, publishing the legal site under a new domain. Prepare everything, then ask.
7. Secrets never go in the repo (`.p8` keys, tokens, passwords). CI reads GitHub secrets; locally use env vars.

## Where things run
| Need | Cloud session (Linux) | Mac (Claude Code desktop / Codex) | GitHub Actions |
|---|---|---|---|
| intake/spec/build/listing (agent work) | ✅ | ✅ | – |
| playtest, screenshots, preview, preflight | ✅ (web build + Chromium) | ✅ | – |
| Native simulator QA + native screenshots | – | `mac/native-qa.sh` | `farm-native-qa` (macos-15) |
| iOS build + TestFlight | – | `mac/local-release.sh` | `farm-ios-release` (EAS cloud) |
| App Store Connect listing/media/submit | if ASC API is reachable | `farm asc …` | `farm-asc` |
| Create the ASC app record, App Privacy label | – | `mac/create-app-record.sh`, `mac/app-privacy.sh` | – |

From a cloud session, trigger workflows with the GitHub MCP tool `actions_run_trigger` (workflow file name +
`ref` + inputs) and read results with `actions_get` / `get_job_logs`. Workflows must exist on the default branch.

## Key files per app (`apps/<slug>/`)
`pipeline.json` state · `idea.md` · `brief.json` · `spec.json` + `spec.md` · `app/` Expo project
(`app/e2e/journeys.json` tests, `app/.maestro/` generated flows, `lib/farm/demo.ts` demo data) ·
`store/listing.json`, `store/shots.json`, `store/icon.svg` · generated: `store/screenshots/`, `store/previews/`,
`store/app_privacy.json`, `store/fastlane/` · `site/` legal pages · `reports/` playtest + preflight.

More: `docs/RUNBOOK.md` (end-to-end), `docs/SETUP.md` (one-time), `docs/HUMAN_STEPS.md`, `docs/MAC_HANDOFF.md`,
`apple/REVIEW_GUIDELINES_CHECKLIST.md`, `apple/ASSET_SPECS.md`.
