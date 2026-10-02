# App Review checklist (what gets apps rejected, and how the pipeline covers it)

Source of truth: https://developer.apple.com/app-store/review/guidelines/ — re-read when Apple updates it.
"Gate" = enforced automatically (spec gate / playtest / preflight). "Agent" = playbook instruction + visual review.

| Guideline | Rejection reason | Covered by |
|---|---|---|
| 2.1 App completeness | crashes, broken links, placeholder content, empty first launch, demo account missing | Gate: playtest (journeys + crawler + runtime errors), placeholder scan, demo account check · Agent: empty states, review notes |
| 2.3.1 / 2.3.7 Accurate metadata | hidden features, "best/#1/free" claims, trademarks, keyword stuffing | Gate: listing checks (risky words, keyword bytes, dupes) |
| 2.3.3 Screenshots | must show the app in use, not just splash/login | Agent: scenes with demo data · Gate warns until native captures exist |
| 2.3.8 Name | store name must match the app's home-screen name closely | Gate: name match |
| 2.3.10 Other platforms | mentioning Android/Google Play | Gate: listing + code scan |
| 2.5.1 Public APIs | private APIs | Expo SDK only |
| 2.5.4 Background modes | unjustified background modes | Gate: warns on UIBackgroundModes |
| 3.1.1 In-App Purchase | digital goods sold outside IAP, no Restore | Spec gate + preflight: IAP library + restore + external payment scan |
| 3.1.2 Subscriptions | missing price/period/terms disclosure, no EULA link | Spec gate warning · terms page has subscription terms |
| 4.0 Design | non-native feel, tiny tap targets, broken layouts | Playtest: overflow, tap-target size · Agent: visual review |
| 4.2 Minimum functionality | thin apps, repackaged websites, web views | Spec gate: ≥3 MVP features + nativeValue · preflight warns on react-native-webview |
| 4.3 Spam | template clones | Agent: distinct concept, design and icon per app |
| 4.8 Login services | social login without Sign in with Apple | Spec gate + preflight dependency check |
| 5.1.1(i) Privacy policy | missing in metadata or in-app | Legal site + Settings screen link · Gate: URL match + in-app link |
| 5.1.1(ii) Permissions | vague purpose strings, asking for unneeded permissions | Spec gate + preflight (introspected Info.plist) |
| 5.1.1(v) Account deletion | account creation without in-app deletion | Spec gate + preflight (`delete-account` UI) |
| 5.1.2 Data use | App Privacy label not matching behavior, tracking without ATT | `store/app_privacy.json` generated from spec · ATT check |
| Privacy manifest (ITMS-91053/91061) | required-reason APIs undeclared | `ios.privacyManifests` rendered by scaffold · preflight |
| Export compliance | build stuck on encryption questions | `ITSAppUsesNonExemptEncryption=false` set by scaffold |
| ITMS-90717 | icon with alpha channel | Gate: icon checks |
| 1.2 UGC | no report/block/filter | Spec gate |
| 1.3 / 5.1.4 Kids | third-party analytics/ads, no parental gate | Spec gate warning |

## Before pressing submit (human, 5 min)
- TestFlight build installs and runs on a real device; every journey in spec.md works
- Screenshots/preview show the current UI
- Review notes explain every feature and any demo account
- App Privacy answers match `store/app_privacy.json`
- Age rating questionnaire answered honestly
