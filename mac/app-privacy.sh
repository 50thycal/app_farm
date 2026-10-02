#!/usr/bin/env bash
# Publishes the App Privacy ("nutrition label") answers from apps/<slug>/store/app_privacy.json.
# App Privacy is not available in the App Store Connect API, so this uses fastlane (Apple ID session).
set -euo pipefail
SLUG="${1:?usage: app-privacy.sh <slug> [apple-id]}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
BUNDLE=$(node -e "console.log(require('./apps/$SLUG/spec.json').app.bundleId)")
TEAM_NAME="${FASTLANE_ITC_TEAM_NAME:-}"
fastlane run upload_app_privacy_details_to_app_store \
  username:"${2:-${FASTLANE_USER:?set FASTLANE_USER or pass apple id}}" app_identifier:"$BUNDLE" \
  json_path:"apps/$SLUG/store/app_privacy.json" ${TEAM_NAME:+team_name:"$TEAM_NAME"}
echo "✓ App Privacy published for $BUNDLE"
