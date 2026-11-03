# Playtest — straitwatch

**0 fail · 0 warn · 21 pass** — generated 2026-11-03T04:11:21.469Z

| | Check | Detail | Ref |
|---|---|---|---|
| ✅ | `suite.unit` | npm test: tests: 988 passed (988) (129s) |  |
| ✅ | `suite.e2e-v3` | node e2e/v3.mjs: 137 ok, 0 FAIL (568s) |  |
| ✅ | `suite.e2e-v3-audio` | node e2e/v3-audio.mjs: 16 ok, 0 FAIL (22s) |  |
| ✅ | `suite.e2e-v3-store` | npm run build:store && { npx vite preview --port 4184 --strictPort >/dev/null 2>&1 & P=$!; for i in $(seq 60); do curl -sf http://localhost:4184/ >/dev/null && break; sleep 0.5; done; BASE_URL=http://localhost:4184 node e2e/v3-store.mjs; S=$?; kill $P; exit $S; }: 80 ok, 0 FAIL (26s) |  |
| ✅ | `store.flavor` | index.html is the store flavour |  |
| ✅ | `screen.956x440.overflow` | 956×440: fits the screen | HIG layout |
| ✅ | `screen.956x440.errors` | 956×440: no runtime errors |  |
| ✅ | `screen.956x440.remote` | 956×440: no remote requests | 4.2 |
| ✅ | `screen.874x402.overflow` | 874×402: fits the screen | HIG layout |
| ✅ | `screen.874x402.errors` | 874×402: no runtime errors |  |
| ✅ | `screen.874x402.remote` | 874×402: no remote requests | 4.2 |
| ✅ | `screen.844x390.overflow` | 844×390: fits the screen | HIG layout |
| ✅ | `screen.844x390.errors` | 844×390: no runtime errors |  |
| ✅ | `screen.844x390.remote` | 844×390: no remote requests | 4.2 |
| ✅ | `screen.667x375.overflow` | 667×375: fits the screen | HIG layout |
| ✅ | `screen.667x375.errors` | 667×375: no runtime errors |  |
| ✅ | `screen.667x375.remote` | 667×375: no remote requests | 4.2 |
| ✅ | `journey.first-run` | Start the first map from a fresh install |  |
| ✅ | `journey.armory` | Equip an Armory card |  |
| ✅ | `journey.settings-legal` | Settings shows the privacy policy, the version and the full-game unlock (Restore is native-only: checked in the bundle and on TestFlight) |  |
| ✅ | `journey.draft` | Defend wave 1 and draft a weapon |  |

Source: 50thycal/td_cargo_ship@claude/mobile-game-predator-prey-tu1t5k (87f357f1e5). Screen captures for visual review: `apps/straitwatch/reports/playtest/*.png`
