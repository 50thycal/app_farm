#!/usr/bin/env bash
# Native QA on the iOS Simulator: Release build → Maestro journeys → native screenshots → app preview recording.
# Usage: mac/native-qa.sh <slug>      (also run by .github/workflows/farm-native-qa.yml on macos-15)
set -uo pipefail
SLUG="${1:?usage: native-qa.sh <slug>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/$SLUG/app"
REPORTS="$ROOT/apps/$SLUG/reports"
RAW="$ROOT/apps/$SLUG/store/raw/native"
mkdir -p "$REPORTS" "$RAW"
cd "$ROOT"
npx tsx farm/cli.ts maestro "$SLUG" || exit 1

cd "$APP"
[ -d node_modules ] || npm ci
echo "› expo prebuild (ios)"
npx expo prebuild -p ios --clean || exit 1
WS=$(ls ios | grep '\.xcworkspace$' | head -1); SCHEME="${WS%.xcworkspace}"
echo "› xcodebuild $SCHEME (Release, simulator)"
xcodebuild -workspace "ios/$WS" -scheme "$SCHEME" -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO -quiet || exit 1
APP_PATH=$(find build/Build/Products/Release-iphonesimulator -maxdepth 1 -name '*.app' | head -1)

# Newest available "iPhone … Pro Max" simulator (6.9" screenshots are 1320×2868).
UDID=$(xcrun simctl list devices available -j | node -e '
  const d=JSON.parse(require("fs").readFileSync(0)).devices; let best;
  for (const [rt, list] of Object.entries(d)) if (rt.includes("iOS")) for (const x of list)
    if (/iPhone \d+ Pro Max/.test(x.name)) { const v=+(x.name.match(/\d+/)[0]); if(!best||v>best.v||(v===best.v&&rt>best.rt)) best={v,rt,u:x.udid,n:x.name}; }
  if (!best) process.exit(1); console.error("› simulator", best.n, best.rt); console.log(best.u);') || { echo "no Pro Max simulator"; exit 1; }
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl status_bar "$UDID" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
xcrun simctl ui "$UDID" appearance light
xcrun simctl install "$UDID" "$APP_PATH"
export MAESTRO_DRIVER_STARTUP_TIMEOUT=180000

echo "› Maestro journeys"
FAIL=0
maestro --device "$UDID" test .maestro/journeys --format junit --output "$REPORTS/native-junit.xml" || FAIL=1

echo "› Native screenshots"
for f in .maestro/shots/*.yaml; do maestro --device "$UDID" test "$f" || echo "! shot failed: $f"; done

echo "› App preview recording"
if [ -f .maestro/preview/preview.yaml ]; then
  xcrun simctl io "$UDID" recordVideo --codec h264 --force "$RAW/preview.mov" & REC=$!
  sleep 2
  maestro --device "$UDID" test .maestro/preview/preview.yaml || echo "! preview flow failed"
  sleep 1; kill -INT "$REC"; wait "$REC" 2>/dev/null
fi

SHOTS=$(ls "$RAW"/*.png 2>/dev/null | wc -l | tr -d ' ')
node -e "require('fs').writeFileSync('$REPORTS/native-qa.json', JSON.stringify({at:new Date().toISOString(), ok: $FAIL===0, device:'$UDID', screenshots:$SHOTS, summary: $FAIL===0 ? 'all journeys passed' : 'journey failures — see native-junit.xml'}, null, 2))"

cd "$ROOT"
[ "$SHOTS" -gt 0 ] && npx tsx farm/cli.ts assets "$SLUG" --only compose
[ -f "$RAW/preview.mov" ] && npx tsx farm/cli.ts native-preview "$SLUG" "$RAW/preview.mov"
npx tsx farm/cli.ts gate "$SLUG" native-qa
exit $FAIL
