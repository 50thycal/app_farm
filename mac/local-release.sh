#!/usr/bin/env bash
# Mac alternative to the farm-ios-release workflow: build on THIS Mac (eas build --local) and upload to TestFlight.
# Needs: Xcode, `eas login` (or EXPO_TOKEN), signing credentials (run `eas credentials -p ios` once interactively).
set -euo pipefail
SLUG="${1:?usage: local-release.sh <slug>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
npx tsx farm/cli.ts run "$SLUG" preflight --fast || { echo "preflight failing — fix first (or FORCE=1)"; [ "${FORCE:-0}" = 1 ] || exit 1; }
npx tsx farm/cli.ts release-config "$SLUG"
cd "apps/$SLUG/app"
npx eas-cli@latest build -p ios --profile production --local --non-interactive --output "$ROOT/apps/$SLUG/.farm-tmp/app.ipa"
npx eas-cli@latest submit -p ios --path "$ROOT/apps/$SLUG/.farm-tmp/app.ipa" --non-interactive
cd "$ROOT" && npx tsx farm/cli.ts mark-build "$SLUG" local --testflight
