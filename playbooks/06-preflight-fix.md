## Stage — Preflight failures: make the app review-proof

`npm run farm -- run {{slug}} preflight` failed. Report: `{{reports}}/preflight.md`.

For each ❌, fix the underlying cause in the right place:
- `config.*` → `{{app}}/app.json` (or the spec, then `npm run farm -- run {{slug}} scaffold` to re-render config)
- `code.*` → app source
- `listing.*` → `{{listing}}`; `shots.*`/`preview.*`/`icon.*` → re-run `npm run farm -- run {{slug}} assets`
- `privacy.*` → `npm run farm -- run {{slug}} listing`; `site.*` → `npm run farm -- run {{slug}} legal`
- `playtest.*` → `npm run farm -- run {{slug}} playtest`
Also read every ⚠️ and fix the ones that are cheap. Re-run preflight until there are no failures.
Never silence a check by editing the checker — if a check is genuinely wrong, explain why in the PR.
