## Stage 4 — Playtest failures (web game)

Report: `{{reports}}/playtest.md`; captures in `{{reports}}/playtest/`; full suite logs in `apps/{{slug}}/.farm-tmp/suites/`.
- `suite.*` — the game's own tests failed: fix the game in its repo (PR there), re-run scaffold, re-run playtest.
- `screen.*.remote` / `journey.*` with remote requests — the store build fetched another host: remove it in the game.
- `screen.*.errors` — runtime errors are crashes in the iOS web view too.
- `journey.*` — fix the game, or the journey if it is wrong (selector changed). Never weaken a journey to pass.
- `store.flavor` — the bundle is not the store flavour (the game repo has no `source.buildCmd` yet).
Iterate captures quickly with `npm run farm -- run {{slug}} playtest --fast` (skips the suites; the gate then fails),
and finish with a full run.
