# Straitwatch — product spec (app_farm `web-game`)

**What it is.** An offline convoy-defense game for iPhone, landscape only. Merchant ships cross a contested strait;
the player defends them from the carrier by tapping drones, missiles, jets and boats to intercept them. Ten waves
clear a map. It is the finished V3 web game from `50thycal/td_cargo_ship`, shipped as a native Capacitor app
(`app.kind: "web-game"`, the documented exception to AGENTS.md rule 4).

**Source.** `spec.json → source`: the game repo at its trunk `claude/mobile-game-predator-prey-tu1t5k` (W1 merged as PR #118). The farm checks it
out to `apps/straitwatch/source` (not committed), builds the store flavour (`npm run build:store` → `dist/index.html`,
marked `<meta name="app-flavor" content="store">`), runs the game's own suites (`npm test`, `e2e/v3.mjs`,
`e2e/v3-audio.mjs`) and captures screenshots from the real game. Game changes are made in the game repo, never here.

## Features (all MVP)
| Feature | What the player gets |
|---|---|
| Tap to intercept | Tap a threat to fire at it; the rack reloads; lose too many ships and the run ends |
| 20 maps, 4 chapters | Home Waters, The Narrows, Dark Water, Open War; each new map adds one idea (supertanker, lock gates, shore batteries, mines, oil rigs, night, a battleship, fast boats, a fork, two-way traffic, the tide, the Citadel) |
| Twelve weapons | Drafted after each wave, dropped as pickups, 15 s loaded, three held, three levels, MAX names |
| The Armory | Eleven upgrade cards in three bays, won after runs; one equipped per bay |
| Endless mode | Continue a cleared map into growing waves |
| Game Center | Best-score leaderboard per map, achievements |
| Full game unlock | Chapter 1 free; one non-consumable IAP (`com.appfarm.straitwatch.fullgame`) unlocks chapters 2–4; Restore Purchases in Settings |
| Settings | Audio, haptics, version, credits, privacy policy, Restore Purchases, Reset progress (confirmed) |

Note: the V3 enemy is **not** adaptive (`src/v3/data/waves.ts`: "There is no adaptive enemy"): every run on a map
escalates the same way. The listing must not claim an adaptive or learning enemy (Guideline 2.3.1).

## Screens
Menu (chapter tabs, map cards, Armory, Settings) → Briefing (loadout) → Game (HUD: wave, score, ships lost, pause,
speed; left rail: ship flow and formation; right rail: weapon slots) → Draft (after each wave) → Result (score, cards
won, next map / endless). Settings and Armory from the menu. A portrait "turn your phone" prompt never shows on iOS
(the shell is landscape-locked).

## Journeys (smoke flows in `e2e/journeys.json`, run against the store bundle)
1. **first-run** — open → The Strait → Start → wave 1 starts.
2. **armory** — with cards won: Armory → tap a won card → equipped.
3. **settings-legal** — Settings shows the privacy policy link, the version and the unlock; the unlock sheet lists chapters 2–4. Restore Purchases appears only when StoreKit is available (on device): preflight checks it is in the bundle; verify on TestFlight.

## Native value (Guideline 4.2)
Offline game in the binary (nothing remote) · Game Center · haptics · native saves (Preferences/UserDefaults) ·
StoreKit IAP with restore · landscape-locked full screen with a native launch screen and auto-pause.

## Privacy — App Privacy label: **Data Not Collected**
Apple's definition: "Collect" means transmitting data off the device so that *you or your third-party partners* can
access it longer than needed to service the request; "You are not responsible for disclosing data collected by
Apple"; payment details entered outside the app that the developer never sees are not collected; data processed
only on device is not collected (developer.apple.com/app-store/app-privacy-details, read 2026-11-03).
- **Progress and settings** stay on the device (Preferences/UserDefaults). Nothing is sent anywhere.
- **In-App Purchase** runs through StoreKit (`@capgo/native-purchases`); Apple processes payment; the app verifies
  the transaction on device and has no server. Not collected by the developer.
- **Game Center** scores and achievements are sent to Apple's Game Center service under Apple's privacy policy, not
  to a developer server; the developer receives no data. Not collected by the developer.
- **The store flavour removes the playtest log upload** (`/api/playlog`, Vercel Blob). Preflight fails if that
  endpoint, a remote URL or any network channel is in the store bundle, and the playtest fails on any runtime
  request to another host. If log upload, analytics or crash reporting is ever added, this label must change.
- Privacy manifest: `ios/App/App/PrivacyInfo.xcprivacy` declares no tracking, no collected data, and UserDefaults
  (CA92.1) for Preferences.

## Age rating
Cartoon or fantasy violence: infrequent/mild (abstract vector ships, drones and missiles in a fictional strait; no
blood, no people). Everything else: none. No gambling, no unrestricted web access, no user content.

## Owner decisions (2026-11)
Free with one unlock IAP (chapter 1 free) · no ads · Game Center yes · iPhone only · landscape only ·
bundle id `com.appfarm.straitwatch` · IAP price tier and public support email still to be chosen by the owner.
