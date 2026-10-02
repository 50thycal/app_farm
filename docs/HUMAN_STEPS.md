# Steps that need a human (and why)

The pipeline automates everything Apple's tooling allows. These remain, by design or by Apple's API limits:

| # | Step | When | How long | Why it can't be automated |
|---|---|---|---|---|
| 1 | Apple Developer enrollment + agreements/tax/banking | once | ~1 day wait | legal identity + contracts |
| 2 | Create API key, Expo token, GitHub secrets | once | 15 min | credentials |
| 3 | **Create the App Store Connect app record** | per app | 2 min | the public ASC API cannot create apps |
| 4 | **App Privacy label** | per app (and when data use changes) | 2 min | not in the ASC API |
| 5 | Price + availability (first release) | per app | 1 min | `farm asc price` sets Free; availability defaults need one confirmation in ASC |
| 6 | TestFlight smoke test on a real iPhone | per release | 10 min | judgment call |
| 7 | Press **submit** (or say "submit" to the agent) | per release | 1 min | it's your account and your app |

## 3. Create the app record
**Option A — App Store Connect web (any computer):** Apps → `+` → New App → Platform iOS, Name = `store/listing.json`
`name`, Primary language, Bundle ID = `spec.json app.bundleId` (register it first with the `farm-asc` workflow,
`action=bundle-id`), SKU = the slug. Then copy the numeric **Apple ID** from App Information and run
`npm run farm -- set <slug> ascAppId <id>` (or ask the agent to), and commit.

**Option B — Mac:** `mac/create-app-record.sh <slug> you@appleid.com` (fastlane produce; one 2FA prompt).

If the name is taken, change `listing.json` `name` (and `spec.json` `app.name` if needed) and retry.

## 4. App Privacy label
The agent generates the answers in `apps/<slug>/store/app_privacy.json` from the spec.
**Mac:** `mac/app-privacy.sh <slug> you@appleid.com`. **Web:** App Store Connect → App Privacy → answer to match the
JSON (`DATA_NOT_COLLECTED` = "No, we do not collect data from this app").

## 6. TestFlight smoke test
Install TestFlight on your iPhone → the build appears after `farm-ios-release` finishes (internal testing needs no
review). Run the journeys in `spec.md`. Report anything odd to the agent.

## 7. Submit
Tell the agent "submit <slug>" — it runs `farm-asc` with `action=attach` then `action=submit, confirm=SUBMIT`.
Typical review time is 24–48 h. If rejected, paste the rejection message to the agent; it maps it to the guideline,
fixes, re-runs preflight and resubmits.
