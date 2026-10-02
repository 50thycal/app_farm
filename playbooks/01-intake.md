## Stage 1 — Intake: turn the rough input into a sharp product brief

**Input:** `{{idea}}` (source: {{sourceType}} — `{{sourceValue}}`)
**Output:** `{{brief}}` (must validate against the Brief schema below)

### If the source is a web app (`web-url`) or a repo
1. Actually look at it. For a URL: fetch the page(s) (WebFetch / curl / Playwright via `node`), and if it is a Vercel
   deployment you can also use the Vercel MCP tools (`get_deployment_file_contents`, `list_deployment_files`,
   `web_fetch_vercel_url`). For a repo: clone or read it.
2. Inventory: routes/screens, core user actions, data model, auth, APIs/backend it calls, payments, third-party SDKs.
3. Decide what is **reused** (backend/API, business logic, copy, brand) vs **rebuilt natively**. We never ship a
   web view wrapper — Guideline 4.2 rejects those. The web app's backend can become the iOS app's API.

### If the source is a rough idea
Make product decisions instead of asking questions. Pick the smallest product that is genuinely useful and complete
on day one. Prefer: works offline with local storage, no account, free — unless the idea fundamentally needs
otherwise. Every account, server, payment or permission adds review risk and work; only add them when essential.

### The brief must answer
- `workingName` (≤30 chars, distinctive, not generic, no "App"/"Free"/"Pro" filler) + 2+ alternatives
- One-liner, problem, audience, the **core loop** (what the user does every session), differentiator
- MVP features (≥3, each a real capability, not "settings" or "about"); later features
- Category (App Store category id), monetization model, needsBackend, needsAccounts
- `risks`: App Review risks with guideline numbers and mitigations (see `apple/REVIEW_GUIDELINES_CHECKLIST.md`)
- `openQuestions`: anything a human must decide later (do not block on them — pick a default and note it)

Write `{{brief}}` as JSON. Keep `{{idea}}` unchanged.
