# app_farm

**Rough app idea (or rough Vercel web app) in → App Store–ready iOS app out.**

app_farm is a pipeline operated by an AI agent (Claude Code in the cloud, Claude Code desktop or Codex on a Mac)
and enforced by a CLI. It takes an idea through product spec, a native Expo/React Native app, automated playtests,
App Store screenshots + preview video + listing copy, privacy/terms/support pages, an Apple-review preflight,
EAS cloud builds to TestFlight, and App Store Connect upload. You do a handful of human-only steps (docs/HUMAN_STEPS.md).

```
idea / web app
   │  intake ─ spec ─ scaffold ─ build ─ playtest ─ listing ─ assets ─ legal ─ preflight     ← cloud session (Linux)
   │                                                                     │
   │       native-qa (macOS simulator, Maestro) · release (EAS → TestFlight) · store (ASC API) ← GitHub Actions / Mac
   ▼                                                                     │
App Store review  ◄──────────────────────── human: TestFlight check + "submit"
```

## Quick start
```bash
npm ci
npm run farm -- init                      # then fill farm.config.json (docs/SETUP.md)
npm run farm -- new "an app that …" --name myapp
npm run farm -- next myapp                # instructions for the next stage (agents follow these)
npm run farm -- auto myapp --agent claude # or let a headless agent run every automatable stage
npm run farm -- status myapp
```
In Claude Code: `/farm "an app that …"`.

## What each stage produces
| Stage | Owner | Output | Gate |
|---|---|---|---|
| intake | agent | `brief.json` | schema |
| spec | agent | `spec.json`, `spec.md` | schema + App Review policy rules (4.2, 4.8, 5.1.1, 3.1, 1.2…) |
| scaffold | script | Expo SDK app (expo-router, demo mode, settings w/ legal links, privacy manifest, export compliance) | deps + config |
| build | agent | features, demo data, `e2e/journeys.json` | typecheck, web export, every spec screen exists, no placeholders |
| playtest | script | `reports/playtest.md` + screen captures | journeys pass, crawler finds no crashes/errors |
| listing | agent | `store/listing.json`, `store/shots.json`, `store/icon.svg` | metadata limits + risky-wording checks |
| assets | script | icon set, framed 1320×2868 screenshots, 886×1920 preview video, fastlane export, App Privacy JSON, Maestro flows | files present |
| legal | script | `site/` privacy, terms, support, marketing pages | files present |
| preflight | script | `reports/preflight.md` (~60 checks) | zero failures |
| native-qa | CI/Mac | Maestro on iOS simulator, native screenshots + preview | journeys pass |
| release | CI/Mac | EAS build → TestFlight | build recorded |
| store | CI/Mac | ASC: metadata, categories, age rating, review info, screenshots, previews | pushed |
| submit | human | App Review submission | submitted |

## Example
`apps/sprout/` is a complete sample run (houseplant watering tracker) through every cloud stage, including its
screenshots (`apps/sprout/store/screenshots/iphone-6.9/`), preview video and preflight report.

## Docs
- `AGENTS.md` / `CLAUDE.md` — operating manual for agents
- `docs/SETUP.md` — accounts, API keys, secrets (once)
- `docs/RUNBOOK.md` — end-to-end flow, release order, updates, rejections
- `docs/HUMAN_STEPS.md` — what still needs you, and why
- `docs/MAC_HANDOFF.md` — continuing on a Mac with Claude Code desktop or Codex
- `apple/REVIEW_GUIDELINES_CHECKLIST.md`, `apple/ASSET_SPECS.md`
