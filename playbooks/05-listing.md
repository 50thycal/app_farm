## Stage 5 — Store listing, icon and screenshot scenes

**Inputs:** `{{spec}}`, the working app, `farm.config.json`, `apple/ASSET_SPECS.md`
**Outputs:** `{{listing}}`, `{{shots}}`, `{{iconSvg}}`

### `{{listing}}` (App Store metadata — schema below)
- `name` ≤30 (matches the app name), `subtitle` ≤30 (benefit, not a repeat of the name).
- `keywords` ≤100 **bytes**, comma-separated, **no spaces**, no words already in the name/subtitle, no competitor
  or Apple trademarks, singular forms, think like a searcher.
- `description`: hook sentence first (it shows above the fold), then features as short paragraphs or "•" lines,
  then a closing line. No prices, no "best/#1", no mention of other platforms, no placeholder text, no emoji spam.
- `promotionalText` ≤170: timely hook (editable without review).
- URLs: use `privacyUrl`/`termsUrl`/`supportUrl`/`marketingUrl` from `{{app}}/app.json` → `expo.extra.farm`
  (marketing = the support URL without `/support`). They must match the in-app links.
- `copyright`: `<current year> <owner.legalName>`.
- `review.notes`: tell the reviewer exactly how to exercise every feature, that demo content appears on first launch
  if applicable, any hardware/permission needs, and the account policy. If login is required, provide the demo account.
- `ageRating`: answer honestly for the app's content (most utility apps: all `NONE`, `gambling:false`,
  `unrestrictedWebAccess:false`). You may add newer App Store Connect age-rating keys if needed; unknown keys are
  rejected by the API with a clear error.
- `brand`: screenshot background gradient (`background` → `backgroundEnd`), caption `text` color and `accent`.

### `{{shots}}` — 5–8 screenshot scenes + the preview video script
- Scenes are the story of the app, in order: (1) the core value in one glance, (2–5) key features, (last) trust or
  delight. Each `caption` ≤40 chars, benefit-led ("Know where every dollar goes"), wrap a word in `*asterisks*`
  to color it with the accent. Optional `subcaption` ≤60.
- Each scene's `steps` start with `{open:...}` and navigate to a state full of demo data (demo:true).
- `preview.steps`: a 15–30 s tour of the core loop (open → a few taps/types/scrolls). About 10–16 steps at the default
  1.4 s pacing. Show real interactions, not static screens.

### `{{iconSvg}}`
A 1024×1024 SVG (`viewBox="0 0 1024 1024"`), full-bleed opaque background (no transparency, no rounded corners —
iOS applies the mask), one bold simple glyph readable at 60px, no text/words, no Apple hardware or emoji.
Make it distinctive and on-brand with `spec.design`.

Then: `npm run farm -- gate {{slug}} listing && npm run farm -- run {{slug}} listing` (exports App Privacy JSON,
fastlane metadata and Maestro flows), then `npm run farm -- run {{slug}} assets` and **look at** the rendered
`store/screenshots/**.png` and `store/previews/**/poster.png`. Iterate on captions, demo data or scenes until they look like a
top-chart app's listing.
