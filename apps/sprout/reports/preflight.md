# Apple preflight — sprout

**0 fail · 8 warn · 67 pass** — generated 2026-10-02T02:52:06.643Z

| | Check | Detail | Ref |
|---|---|---|---|
| ⚠️ | `shots.iphone-6.9.source` | Screenshots were captured from the web build. Recapture on the iOS Simulator before submitting (farm-native-qa workflow or mac/native-qa.sh) so they show true native rendering | 2.3.3 |
| ⚠️ | `owner.legalName` | farm.config.json owner.legalName empty (needed for App Review contact) |  |
| ⚠️ | `owner.firstName` | farm.config.json owner.firstName empty (needed for App Review contact) |  |
| ⚠️ | `owner.lastName` | farm.config.json owner.lastName empty (needed for App Review contact) |  |
| ⚠️ | `owner.email` | farm.config.json owner.email empty (needed for App Review contact) |  |
| ⚠️ | `owner.phone` | farm.config.json owner.phone empty (needed for App Review contact) |  |
| ⚠️ | `apple.team` | farm.config.json apple.teamId empty |  |
| ⚠️ | `release.asc-app` | No App Store Connect app id yet — create the app record (docs/HUMAN_STEPS.md) then `farm set <slug> ascAppId <id>` |  |
| ✅ | `input.spec` | spec valid |  |
| ✅ | `input.listing` | listing valid |  |
| ✅ | `input.shots` | shots valid |  |
| ✅ | `input.journeys` | journeys valid |  |
| ✅ | `spec.min-functionality` | 5 MVP features | 4.2 |
| ✅ | `spec.native-value` | Native value articulated | 4.2 |
| ✅ | `spec.tabs` | 4 tabs | HIG |
| ✅ | `spec.settings-screen` | Settings/About screen present (privacy policy link, support, deletion) | 5.1.1(i) |
| ✅ | `config.bundle-id` | bundleIdentifier com.appfarm.sprout |  |
| ✅ | `config.bundle-id.real` | bundle id is real |  |
| ✅ | `config.version` | version 1.0.0 |  |
| ✅ | `config.name` | display name "Sprout" |  |
| ✅ | `config.name.len` | home-screen name ≤ 30 |  |
| ✅ | `config.encryption` | Export compliance declared (ITSAppUsesNonExemptEncryption=false) | Export compliance |
| ✅ | `config.tablet` | supportsTablet=false |  |
| ✅ | `config.privacy-manifest` | Privacy manifest configured | Privacy manifest (ITMS-91053) |
| ✅ | `config.scheme` | scheme sprout |  |
| ✅ | `icon.store.size` | store icon 1024² |  |
| ✅ | `icon.store.alpha` | store icon opaque | ITMS-90717 |
| ✅ | `icon.app.size` | app icon 1024² |  |
| ✅ | `icon.app.alpha` | app icon opaque | ITMS-90717 |
| ✅ | `code.placeholder` | No placeholder content | 2.1 / 2.3.3 |
| ✅ | `code.screen.today` | app/(tabs)/index.tsx exists |  |
| ✅ | `code.screen.plants` | app/(tabs)/plants.tsx exists |  |
| ✅ | `code.screen.upcoming` | app/(tabs)/upcoming.tsx exists |  |
| ✅ | `code.screen.settings` | app/(tabs)/settings.tsx exists |  |
| ✅ | `code.screen.plant-detail` | app/plant/[id].tsx exists |  |
| ✅ | `code.screen.plant-form` | app/plant/new.tsx exists |  |
| ✅ | `code.privacy-link` | In-app privacy policy link | 5.1.1(i) |
| ✅ | `code.typecheck` | TypeScript clean |  |
| ✅ | `code.ios-bundle` | iOS JS bundle builds (Hermes) |  |
| ✅ | `playtest.ok` | Playtest passed | 2.1 |
| ✅ | `playtest.fresh` | Playtest is newer than the code |  |
| ✅ | `listing.keywords.bytes` | keywords 98/100 bytes |  |
| ✅ | `listing.name.match` | Store name matches the app name | 2.3.8 |
| ✅ | `listing.subtitle` | Subtitle adds information |  |
| ✅ | `listing.review-notes` | Review notes explain how to test | 2.1 |
| ✅ | `listing.copyright` | Copyright year current |  |
| ✅ | `listing.supportUrl.https` | supportUrl is https |  |
| ✅ | `listing.privacyPolicyUrl.https` | privacyPolicyUrl is https |  |
| ✅ | `listing.marketingUrl.https` | marketingUrl is https |  |
| ✅ | `listing.privacy-url` | Privacy URL matches the in-app link | 5.1.1(i) |
| ✅ | `listing.category` | Category matches spec |  |
| ✅ | `shots.iphone-6.9.count` | iphone-6.9: 6 screenshots |  |
| ✅ | `shots.iphone-6.9.01-today.png.size` | 01-today.png 1320×2868 |  |
| ✅ | `shots.iphone-6.9.01-today.png.alpha` | 01-today.png opaque |  |
| ✅ | `shots.iphone-6.9.02-streak.png.size` | 02-streak.png 1320×2868 |  |
| ✅ | `shots.iphone-6.9.02-streak.png.alpha` | 02-streak.png opaque |  |
| ✅ | `shots.iphone-6.9.03-plants.png.size` | 03-plants.png 1320×2868 |  |
| ✅ | `shots.iphone-6.9.03-plants.png.alpha` | 03-plants.png opaque |  |
| ✅ | `shots.iphone-6.9.04-detail.png.size` | 04-detail.png 1320×2868 |  |
| ✅ | `shots.iphone-6.9.04-detail.png.alpha` | 04-detail.png opaque |  |
| ✅ | `shots.iphone-6.9.05-upcoming.png.size` | 05-upcoming.png 1320×2868 |  |
| ✅ | `shots.iphone-6.9.05-upcoming.png.alpha` | 05-upcoming.png opaque |  |
| ✅ | `shots.iphone-6.9.06-add.png.size` | 06-add.png 1320×2868 |  |
| ✅ | `shots.iphone-6.9.06-add.png.alpha` | 06-add.png opaque |  |
| ✅ | `preview.duration` | preview 29.5s |  |
| ✅ | `preview.size` | preview 886×1920 |  |
| ✅ | `preview.fps` | preview 30 fps |  |
| ✅ | `preview.codec` | preview H.264 |  |
| ✅ | `preview.audio` | preview has audio track |  |
| ✅ | `preview.bytes` | preview < 500MB |  |
| ✅ | `privacy.label` | App Privacy answers match spec | 5.1.2 |
| ✅ | `site.privacy.html` | site/privacy.html |  |
| ✅ | `site.terms.html` | site/terms.html |  |
| ✅ | `site.support.html` | site/support.html |  |
| ✅ | `site.index.html` | site/index.html |  |
