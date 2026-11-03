# Apple preflight — straitwatch

**0 fail · 7 warn · 95 pass** — generated 2026-11-03T04:12:41.735Z

| | Check | Detail | Ref |
|---|---|---|---|
| ⚠️ | `code.webview-exception` | Web-view shell (Capacitor) allowed only as app.kind "web-game" — AGENTS.md rule 4 exception. Residual Guideline 4.2 risk: keep the review notes explicit about the native features (offline, Game Center, haptics, native storage) | 4.2 |
| ⚠️ | `bundle.data-urls` | URLs inside data files (fine as attribution text; never fetch or open them): v3/audio/CREDITS.json: https://registry.npmjs.org |  |
| ⚠️ | `shots.iphone-6.9.source` | Screenshots were captured from the web build. Recapture on the iOS Simulator before submitting (farm-native-qa workflow or mac/native-qa.sh) so they show true native rendering | 2.3.3 |
| ⚠️ | `owner.email` | farm.config.json owner.email empty (needed for App Review contact) |  |
| ⚠️ | `owner.phone` | farm.config.json owner.phone empty (needed for App Review contact) |  |
| ⚠️ | `apple.team` | farm.config.json apple.teamId empty |  |
| ⚠️ | `release.asc-app` | No App Store Connect app id yet — create the app record (docs/HUMAN_STEPS.md) then `farm set <slug> ascAppId <id>` |  |
| ✅ | `input.spec` | spec valid |  |
| ✅ | `input.listing` | listing valid |  |
| ✅ | `input.shots` | shots valid |  |
| ✅ | `input.journeys` | journeys valid |  |
| ✅ | `spec.min-functionality` | 8 MVP features | 4.2 |
| ✅ | `spec.native-value` | Native value articulated | 4.2 |
| ✅ | `spec.iap-products` | IAP products defined | 3.1.1 |
| ✅ | `spec.restore` | Restore Purchases planned | 3.1.1 |
| ✅ | `spec.tabs` | 0 tabs | HIG |
| ✅ | `spec.settings-screen` | Settings/About screen present (privacy policy link, support, deletion) | 5.1.1(i) |
| ✅ | `webgame.source` | 50thycal/td_cargo_ship@claude/mobile-game-predator-prey-tu1t5k at 87f357f1e5 |  |
| ✅ | `webgame.bundle.fresh` | store bundle built from the checked-out commit |  |
| ✅ | `webgame.store-build` | built with npm run build:store |  |
| ✅ | `webgame.store-flavor` | index.html is the store flavour | 2.3.1 / 5.1.2 |
| ✅ | `bundle.remote-urls` | No remote URLs in code/markup (10 files scanned) | 4.2 / 2.5.2 |
| ✅ | `bundle.namespaces` | Allowed: XML namespace identifiers (http://www.w3.org/2000/svg) |  |
| ✅ | `bundle.own-links` | Allowed: the app's own legal pages as links (https://app-farm-legal.vercel.app/straitwatch/privacy) | 5.1.1(i) |
| ✅ | `bundle.fetch-remote` | No fetch() of an absolute URL | 4.2 / 2.5.2 |
| ✅ | `bundle.api` | No backend endpoints (/api/…) | 5.1.2 |
| ✅ | `bundle.channels` | No WebSocket / EventSource / sendBeacon | 5.1.2 |
| ✅ | `bundle.fetch` | 3 fetch() call(s), none to a remote host or /api/ (runtime requests are checked by the playtest) |  |
| ✅ | `bundle.forbid.api-playlog` | "/api/playlog" absent | 2.3.1 / 5.1.2 |
| ✅ | `bundle.forbid.download-log` | "Download log" absent | 2.3.1 / 5.1.2 |
| ✅ | `bundle.forbid.developer-mode` | "Developer mode" absent | 2.3.1 / 5.1.2 |
| ✅ | `bundle.forbid.play-v2` | "Play V2 →" absent | 2.3.1 / 5.1.2 |
| ✅ | `code.placeholder` | No placeholder content | 2.1 / 2.3.3 |
| ✅ | `code.privacy-link` | In-app privacy policy link (https://app-farm-legal.vercel.app/straitwatch/privacy) | 5.1.1(i) |
| ✅ | `code.restore` | Restore Purchases present | 3.1.1 |
| ✅ | `cap.dep.core` | @capacitor/core ^8.6.0 | 4.2 |
| ✅ | `cap.dep.ios` | @capacitor/ios ^8.6.0 | 4.2 |
| ✅ | `cap.dep.preferences` | @capacitor/preferences ^8.0.1 | 4.2 |
| ✅ | `cap.dep.haptics` | @capacitor/haptics ^8.0.2 | 4.2 |
| ✅ | `code.iap` | StoreKit plugin @capgo/native-purchases | 3.1.1 |
| ✅ | `config.version` | version 1.0.0 (MARKETING_VERSION) |  |
| ✅ | `cap.app-id` | appId com.appfarm.straitwatch |  |
| ✅ | `cap.app-name` | appName Straitwatch |  |
| ✅ | `cap.web-dir` | webDir dist |  |
| ✅ | `cap.server-url` | No server.url (loads the bundled files) | 4.2 / 2.5.2 |
| ✅ | `config.bundle-id` | PRODUCT_BUNDLE_IDENTIFIER com.appfarm.straitwatch |  |
| ✅ | `config.tablet` | TARGETED_DEVICE_FAMILY 1 | 2.4.1 |
| ✅ | `cap.native.preferences` | CapacitorPreferences linked in the iOS project | 4.2 |
| ✅ | `cap.native.haptics` | CapacitorHaptics linked in the iOS project | 4.2 |
| ✅ | `config.orientation` | Landscape lock: UIInterfaceOrientationLandscapeRight, UIInterfaceOrientationLandscapeLeft | 4.0 / HIG |
| ✅ | `config.encryption` | Export compliance declared (ITSAppUsesNonExemptEncryption=false) | Export compliance |
| ✅ | `config.launch-screen` | launch screen LaunchScreen | 2.1 |
| ✅ | `config.name` | display name "Straitwatch" | 2.3.8 |
| ✅ | `config.privacy-manifest.tracking` | NSPrivacyTracking false | 5.1.2 |
| ✅ | `config.privacy-manifest.userdefaults` | UserDefaults declared (Preferences) | ITMS-91053 |
| ✅ | `config.privacy-manifest.collected` | Manifest declares no collected data (matches the label) | 5.1.2 |
| ✅ | `icon.app.alpha` | app icon opaque | ITMS-90717 |
| ✅ | `icon.match` | binary icon matches store/icon-1024.png (Δ 0.2) |  |
| ✅ | `icon.store` | store icon 1024² opaque | ITMS-90717 |
| ✅ | `gamecenter.code` | GameKit used (native/game-center/ios/Sources/GameCenterPlugin/GameCenterPlugin.swift) |  |
| ✅ | `gamecenter.entitlement` | Game Center entitlement in App.entitlements |  |
| ✅ | `gamecenter.entitlement-linked` | CODE_SIGN_ENTITLEMENTS set |  |
| ✅ | `playtest.ok` | Playtest passed | 2.1 |
| ✅ | `playtest.fresh` | Playtest ran on the checked-out commit |  |
| ✅ | `listing.keywords.bytes` | keywords 97/100 bytes |  |
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
| ✅ | `shots.iphone-6.9.01-defend.png.size` | 01-defend.png 2868×1320 |  |
| ✅ | `shots.iphone-6.9.01-defend.png.alpha` | 01-defend.png opaque |  |
| ✅ | `shots.iphone-6.9.02-weapons.png.size` | 02-weapons.png 2868×1320 |  |
| ✅ | `shots.iphone-6.9.02-weapons.png.alpha` | 02-weapons.png opaque |  |
| ✅ | `shots.iphone-6.9.03-draft.png.size` | 03-draft.png 2868×1320 |  |
| ✅ | `shots.iphone-6.9.03-draft.png.alpha` | 03-draft.png opaque |  |
| ✅ | `shots.iphone-6.9.04-later.png.size` | 04-later.png 2868×1320 |  |
| ✅ | `shots.iphone-6.9.04-later.png.alpha` | 04-later.png opaque |  |
| ✅ | `shots.iphone-6.9.05-maps.png.size` | 05-maps.png 2868×1320 |  |
| ✅ | `shots.iphone-6.9.05-maps.png.alpha` | 05-maps.png opaque |  |
| ✅ | `shots.iphone-6.9.06-armory.png.size` | 06-armory.png 2868×1320 |  |
| ✅ | `shots.iphone-6.9.06-armory.png.alpha` | 06-armory.png opaque |  |
| ✅ | `preview.duration` | preview 27.9s |  |
| ✅ | `preview.size` | preview 1920×886 |  |
| ✅ | `preview.fps` | preview 30 fps |  |
| ✅ | `preview.codec` | preview H.264 |  |
| ✅ | `preview.audio` | preview has audio track |  |
| ✅ | `preview.bytes` | preview < 500MB |  |
| ✅ | `preview.content` | preview frame is filled | 2.3.4 |
| ✅ | `privacy.label` | App Privacy answers match spec | 5.1.2 |
| ✅ | `site.privacy.html` | site/privacy.html |  |
| ✅ | `site.terms.html` | site/terms.html |  |
| ✅ | `site.support.html` | site/support.html |  |
| ✅ | `site.index.html` | site/index.html |  |
| ✅ | `owner.legalName` | owner.legalName set |  |
| ✅ | `owner.firstName` | owner.firstName set |  |
| ✅ | `owner.lastName` | owner.lastName set |  |
