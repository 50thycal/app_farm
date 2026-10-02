#!/usr/bin/env bash
# One-time Mac setup for the app_farm pipeline (Claude Code desktop / Codex / terminal).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "› Xcode"
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Install Xcode from the App Store, open it once, then run: sudo xcode-select -s /Applications/Xcode.app"; exit 1
fi
xcodebuild -version
xcrun simctl list runtimes | grep -q iOS || echo "! No iOS simulator runtime — Xcode → Settings → Components → iOS"

echo "› Homebrew packages"
command -v brew >/dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@22 ffmpeg watchman cocoapods fastlane 2>/dev/null || true

echo "› Maestro"
command -v maestro >/dev/null || curl -fsSL "https://get.maestro.mobile.dev" | bash

echo "› Node deps + Chromium for web playtests"
npm ci
npx playwright-core install chromium

echo "› EAS CLI"
npm i -g eas-cli >/dev/null 2>&1 || true

[ -f farm.config.json ] || npx tsx farm/cli.ts init
npx tsx farm/cli.ts doctor
echo "✓ Mac ready. Next: docs/MAC_HANDOFF.md"
