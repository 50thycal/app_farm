# Handing off to a Mac (Claude Code desktop or Codex)

Use the Mac when you want things the cloud session can't do: run the iOS Simulator yourself, build locally with
Xcode, use fastlane with your Apple ID (app record, App Privacy), or debug a native-only issue.

## Start
```bash
git clone <this repo> && cd app_farm && git checkout <branch>
bash mac/bootstrap.sh          # Xcode check, ffmpeg, Maestro, fastlane, EAS CLI, Chromium, farm doctor
npm run farm -- status <slug>
```
Open the folder in **Claude Code desktop** (reads `CLAUDE.md`) or **Codex** (reads `AGENTS.md`) and say:
> Continue the app_farm pipeline for `<slug>` on this Mac. Do the mac-only steps.

## Mac-only toolbox
| Task | Command |
|---|---|
| Native QA: Release sim build, Maestro journeys, native screenshots + preview | `mac/native-qa.sh <slug>` |
| Watch the app live in the simulator | `cd apps/<slug>/app && npx expo run:ios` |
| Create the App Store Connect app record | `mac/create-app-record.sh <slug> you@appleid.com` |
| Publish App Privacy answers | `mac/app-privacy.sh <slug> you@appleid.com` |
| Build locally + upload to TestFlight | `mac/local-release.sh <slug>` (after `eas credentials -p ios` once) |
| Push listing/media without the ASC API | `cd apps/<slug>/store && fastlane deliver --metadata_path fastlane/metadata --screenshots_path fastlane/screenshots/en-US --skip_binary_upload` |
| App Store Connect API from the Mac | `export ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_PRIVATE_KEY_PATH=~/keys/AuthKey.p8` then `npm run farm -- asc listing <slug>` |

When done, commit and push (`apps/<slug>/store/raw/native`, `reports/`, `pipeline.json`) so the cloud session sees it.
