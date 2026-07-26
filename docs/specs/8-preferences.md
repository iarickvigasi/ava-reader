# Reading preferences

> Status: shipped · Updated: 2026-07-15 · ADRs: [[3-offline-first-dexie-buckets]] · Code:
> apps/web/components/theme, apps/web/components/app/reader/overlays/preferences,
> apps/web/features/offline/buckets/me

## Summary
User-adjustable reading and language settings, applied instantly. Font/language/goal sync across
devices; theme follows the device (light/dark) with an ephemeral manual override.

## Scope
- In: font scaling, interface language, translation target language, daily reading-goal minutes —
  persisted offline, PATCH-synced. Theme — inferred from the device with a per-segment override.
- Non-goals: listening/narration controls (UI placeholder, no backend); account/profile settings;
  a permanent theme pin or a Light/Dark/System selector.

## Behaviour
1. Changing font/language/goal applies immediately, is written locally, and PATCH-syncs.
2. Only changed fields are sent (dirtyFields); untouched server fields are preserved.
3. Theme = the device scheme (`prefers-color-scheme`) unless the user has toggled within the
   current segment; then their choice (the override) wins.
4. Each device light↔dark shift discards the override, so the theme follows the device again —
   live while open, or on reopen when the device scheme no longer matches the segment the override
   was set against. Toggling back to the device scheme clears the override.

## Data & sync
me/preferences bucket → UserPreferences; PATCH dirtyFields only, cleared on ack. Theme is NOT
synced — it is device-specific and ephemeral. Resolved theme → `data-theme` + CSS vars + cookie
(SSR baseline); override → localStorage. A pre-paint inline script sets `data-theme` from device +
override before first paint (no flash). The server `theme` field is left dormant.

## Edge cases
Offline font/language change then reconnect; concurrent edits (last-write-wins per field); unknown
future server fields preserved. A device pinned to a fixed appearance never shifts, so an override
persists until the next manual toggle. An even number of device shifts while the app is closed
cannot be detected, so an override may linger one extra segment.

## Acceptance criteria
- [ ] With no override, the theme matches the device and updates live on a device light↔dark shift.
- [ ] A manual toggle sticks until the next device shift, then the theme follows the device.
- [ ] Toggling back to the device scheme clears the override.
- [ ] No theme flash on load, including when the device shifted while the app was closed.
- [ ] Font/language/goal still update instantly, PATCH only changed fields, and survive reload.

## Open questions
Listening section backend; per-book vs global overrides.
