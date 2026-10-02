#!/usr/bin/env bash
# Creates the App Store Connect app record (the one step Apple's public API can't do) with fastlane produce,
# then stores the app id in the pipeline. Needs an Apple ID with App Manager rights; prompts for 2FA once.
# Usage: mac/create-app-record.sh <slug> [apple-id-email]
set -euo pipefail
SLUG="${1:?usage: create-app-record.sh <slug> [apple-id]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
read_json() { node -e "const j=require('$1'); console.log($2)"; }
BUNDLE=$(read_json "./apps/$SLUG/spec.json" "j.app.bundleId")
NAME=$(read_json "./apps/$SLUG/store/listing.json" "j.name")
LOCALE=$(read_json "./apps/$SLUG/store/listing.json" "j.locale")
TEAM=$(read_json "./farm.config.json" "j.apple.teamId")
APPLE_ID="${2:-${FASTLANE_USER:-}}"
[ -n "$APPLE_ID" ] || read -rp "Apple ID email: " APPLE_ID
fastlane produce --username "$APPLE_ID" --app_identifier "$BUNDLE" --app_name "$NAME" \
  --language "$LOCALE" --sku "$SLUG-$(date +%Y%m%d)" --team_id "$TEAM" --platforms ios
if [ -n "${ASC_KEY_ID:-}" ]; then
  npx tsx farm/cli.ts asc status "$SLUG"     # discovers the app by bundle id and stores ascAppId
else
  echo "Open https://appstoreconnect.apple.com/apps → $NAME → App Information → Apple ID (numeric)"
  read -rp "Apple ID of the new app: " APP_ID
  npx tsx farm/cli.ts set "$SLUG" ascAppId "$APP_ID"
fi
npx tsx farm/cli.ts release-config "$SLUG"
echo "✓ App record created. Commit apps/$SLUG/pipeline.json and apps/$SLUG/app/eas.json."
