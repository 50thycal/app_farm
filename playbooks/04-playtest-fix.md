## Stage 4 — Playtest failures: diagnose and fix

The automated playtest for `{{slug}}` failed. Report: `{{reports}}/playtest.md`, captures (including `FAIL-*.png`)
in `{{reports}}/playtest/`.

1. Read the failing checks and look at the failure screenshots.
2. Reproduce locally if needed: `cd {{app}} && npx expo export -p web --output-dir dist-web`, then re-run
   `npm run farm -- run {{slug}} playtest --skip-build`.
3. Fix the **app** (preferred) or, if the journey itself is wrong (wrong testID, outdated flow), fix `{{journeys}}`.
   Never weaken a journey just to make it pass — the journey encodes what App Review will try.
4. Runtime errors (`pageerror`, `console.error`) are crashes on iOS too. Fix the root cause.
5. Re-run until the gate passes; then review the screen captures visually once more.
