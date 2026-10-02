---
name: farm
description: Run the app_farm pipeline — take a rough app idea, a Vercel/web app URL, or an existing app slug and drive it through spec, build, playtest, store assets, Apple preflight and release. Use when the user gives an app idea, says "farm", "make an app", "ship to the App Store", or names an app under apps/.
---

# farm — idea → App Store

Argument: an idea in quotes, a URL (web app to port), or an existing slug.

1. If it's new: `npm run farm -- new "<idea>" --name <2-3 word name>` (add `--url <url>` for a web app). Note the slug.
   If no `farm.config.json` owner info is filled in, continue anyway and list it under "needs from you" at the end.
2. Loop until the next stage is `ci` or `human`:
   - `npm run farm -- next <slug>` → follow the printed playbook exactly (agent stages) or run the printed command (script stages).
   - `npm run farm -- gate <slug> <stage>` → on failure, fix and re-gate. Never weaken a check.
   - After `playtest` and `assets`, Read the PNGs and fix anything that looks unpolished.
   - Commit after each passing stage with a message like `farm(<slug>): <stage>`.
3. At the `native-qa` / `release` / `store` stages: if GitHub Actions secrets are configured, trigger
   `farm-native-qa.yml`, `farm-ios-release.yml`, `farm-asc.yml` via the GitHub MCP `actions_run_trigger`
   tool (ref = current branch once workflows are on the default branch). Otherwise hand off per docs/MAC_HANDOFF.md.
4. Never trigger `farm-asc` with `action=submit` without the user's explicit "submit" in this conversation.
5. Finish with: status table, links to `reports/preflight.md`, the screenshots, and a short "needs from you" list.
