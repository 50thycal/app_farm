## Stage 3 — Build the app

**Inputs:** `{{spec}}`, `{{specMd}}`, the scaffolded Expo project in `{{app}}` (read `{{app}}/AGENTS.md` — Expo
changes fast; check the versioned docs for the SDK in `{{app}}/package.json` rather than trusting memory).
**Outputs:** a complete, polished app + `{{journeys}}` + demo data.

### Build it like a real product
- Implement **every MVP feature** and **every screen** in the spec at the given file paths. No stubs, no "coming
  soon", no lorem ipsum, no dead buttons. Replace the starter `app/(tabs)/index.tsx` (it contains `FARM_PLACEHOLDER`).
- Use `npx expo install <pkg>` (never plain npm install) for native packages. Stay within Expo modules + well-known
  libraries that work in a dev/production build. No `react-native-webview` as the main UI.
- Persist with `lib/farm/storage.ts` (AsyncStorage) or `expo-sqlite`. Network calls must handle offline/errors with
  friendly UI (App Review tests on flaky networks — 2.1).
- iOS polish: safe areas, Dynamic Type friendly sizes, ≥44pt tap targets, empty states, loading states, haptics
  (`expo-haptics`) on key actions, dark mode via `useColorScheme` + `constants/Colors.ts`, SF Symbols via `expo-symbols`.
- Every interactive element a journey touches gets a stable `testID` (it becomes `data-testid` on web and the
  accessibility identifier on iOS, so the same tests run in both).
- Do not edit `ios/`/`android/` (they are generated). Configure native behavior in `app.json`/config plugins.
- If the source is a web app: port business logic/API clients into `lib/`, call the existing backend, rebuild UI natively.

### Demo mode (critical for screenshots, previews and App Review)
Implement `seedDemoData()` in `lib/farm/demo.ts`: realistic, attractive sample content (real-sounding names,
numbers, dates relative to now). It runs when the app opens with `?farmDemo=1` (web) / `<scheme>://?farmDemo=1` (iOS).

### Journeys → automated tests
Write `{{journeys}}`: one journey per spec journey (plus the starter ones). Steps DSL:
`{open:"/route"}`, `{tap:{id}|{text}}`, `{type:{target:{id},text}}`, `{expect:{id}|{text}}`, `{expectNot:...}`,
`{back:true}`, `{wait:ms}`, `{scroll:"down"|"up"}`, `{screenshot:"name"}`. Prefer `id` targets.
These run on the web build in this pipeline and compile to Maestro flows for the iOS simulator.

### Verify before finishing
```
cd {{app}} && npx tsc --noEmit && npx expo export -p web --output-dir dist-web
npm run farm -- gate {{slug}} build
npm run farm -- run {{slug}} playtest      # then open apps/{{slug}}/reports/playtest/*.png and LOOK at every screen
```
Visually review each capture as a demanding App Store reviewer would: alignment, clipping, contrast, empty areas,
text overflow, awkward copy. Fix and re-run until it looks like a shipped product.
