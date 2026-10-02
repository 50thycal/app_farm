# Sprout — plant watering made simple

**One-liner:** Know exactly which houseplants need water today, and keep every one of them alive.

## Core loop
Open **Today** → water what's due with one tap (haptic + streak) → glance at **Upcoming**.

## MVP features
1. **Add & edit plants** — name, room, type preset (fern 4d, succulent 14d, cactus 21d, tropical 7d, herb 3d, custom), interval stepper 1–60 days.
2. **Today** — due/overdue plants sorted by urgency; one-tap Water; celebratory empty state.
3. **Plant detail** — next due, interval, room, watering history; Water now; edit; delete.
4. **Care streak** — consecutive days with every due plant watered; best streak.
5. **Upcoming** — next 7 days grouped by day.

## Screens
| Route | File | Purpose |
|---|---|---|
| `/` | app/(tabs)/index.tsx | Today + streak |
| `/plants` | app/(tabs)/plants.tsx | All plants + add |
| `/upcoming` | app/(tabs)/upcoming.tsx | Next 7 days |
| `/settings` | app/(tabs)/settings.tsx | Support, legal |
| `/plant/[id]` | app/plant/[id].tsx | Detail & history |
| `/plant/new` | app/plant/new.tsx | Add/edit form |

## Policy notes
No accounts, no data collection, no permissions, free. Local-only storage. Demo mode seeds 8 plants with realistic history.
