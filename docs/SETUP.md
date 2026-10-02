# One-time setup

Everything here is done once per person/team, not per app. ~45 minutes (+ Apple's enrollment wait).

## 1. Accounts
| Account | Why | Cost |
|---|---|---|
| [Apple Developer Program](https://developer.apple.com/programs/enroll/) | publish on the App Store | $99/yr |
| App Store Connect → **Agreements, Tax, and Banking** | required even for free apps (Free Apps agreement) and for paid apps/IAP (Paid Apps agreement) | – |
| [Expo](https://expo.dev/signup) | EAS cloud builds (macOS/Xcode in the cloud) + submit | free tier is enough to start |
| [Vercel](https://vercel.com) *(or GitHub Pages)* | hosts privacy policy / terms / support pages | free |

Individual vs Organization: an Organization (D-U-N-S number) shows your company as seller; regulated apps
(finance, health, crypto, VPN) usually require it.

## 2. App Store Connect API key
App Store Connect → Users and Access → **Integrations → App Store Connect API** → Team Keys → `+`
→ name `app-farm`, access **App Manager** → download the `.p8` (only downloadable once).
Note the **Key ID** and **Issuer ID**. Your **Team ID** is on developer.apple.com → Membership.

## 3. Expo token
expo.dev → Account settings → **Access tokens** → create `app-farm` (robot or personal token).

## 4. GitHub secrets (repo → Settings → Secrets and variables → Actions)
| Secret | Value |
|---|---|
| `EXPO_TOKEN` | Expo access token |
| `ASC_KEY_ID` | API key ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_PRIVATE_KEY` | full contents of the `.p8` file (including BEGIN/END lines) |
| `APPLE_TEAM_ID` | 10-char Team ID |
| `FARM_OWNER_EMAIL`, `FARM_OWNER_PHONE` | *(optional)* App Review contact if you keep them out of `farm.config.json` |
| `VERCEL_TOKEN` (+ `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` optional) | legal-site deploys |

Variables: `APPLE_TEAM_TYPE` = `INDIVIDUAL` or `COMPANY_OR_ORGANIZATION`; `LEGAL_TARGET` = `pages` to use GitHub Pages.

## 5. `farm.config.json`
```jsonc
{
  "owner": { "legalName": "Jane Doe LLC", "displayName": "Jane Doe", "firstName": "Jane", "lastName": "Doe",
             "email": "support@yourdomain.com", "phone": "+1 555 555 0100", "country": "US" },
  "apple": { "teamId": "ABCDE12345", "teamType": "INDIVIDUAL", "bundleIdPrefix": "com.yourdomain" },
  "legal": { "baseUrl": "https://app-farm-legal.vercel.app" },   // where farm-legal-site deploys
  "expo":  { "owner": "your-expo-username" },
  "defaults": { "sdk": "latest", "supportsTablet": false }
}
```
The owner email appears publicly on support/privacy pages and goes to App Review; use a support address.
`bundleIdPrefix` is permanent per app once published — choose a domain you control.

## 6. Cloud sessions (Claude Code on the web)
The default network policy blocks `expo.dev`, `api.appstoreconnect.apple.com` and `api.vercel.com`. Either keep
release work in GitHub Actions (recommended — nothing else needed) or add those hosts to the environment's allowed
domains (environment settings → Network access) so `farm asc …` and `eas` work directly from the session.

## 7. Mac (optional but recommended)
`bash mac/bootstrap.sh` — Xcode, simulator runtime, ffmpeg, Maestro, fastlane, EAS CLI, Chromium.
Then `npm run farm -- doctor`.
