# Reading preferences

> Status: shipped · Updated: 2026-06-06 · ADRs: [[3-offline-first-dexie-buckets]] · Code: apps/web/components/app/reader/reader-screen/overlays/preferences, apps/web/features/offline/buckets/me

## Summary
User-adjustable reading and language settings, applied instantly and synced. Tunes the reading experience across the app.

## Scope
- In: font scaling, light/dark theme, interface language, translation target language, daily reading-goal minutes — persisted offline, PATCH-synced.
- Non-goals: listening/narration controls (UI placeholder, no backend), account/profile settings.

## Behaviour
1. Changing a setting applies immediately (font, theme, language) and is written locally.
2. Only changed fields are sent (dirtyFields); server fields not touched are preserved.
3. Settings persist across reloads and devices once synced.

## Data & sync
me/preferences bucket → UserPreferences. PATCH with dirtyFields only; cleared on ack. Theme via data-theme + CSS vars + cookie.

## Edge cases
Offline change then reconnect; concurrent edits on two devices (last-write-wins per field); unknown future server fields preserved.

## Acceptance criteria
- [ ] Changing font/theme/language updates the UI instantly.
- [ ] Only changed fields are PATCHed; others remain intact.
- [ ] Preferences survive reload and sync across devices.

## Open questions
Listening section backend; per-book vs global overrides.
