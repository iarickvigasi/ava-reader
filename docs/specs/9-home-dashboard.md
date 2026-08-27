# Home dashboard

> Status: shipped · Updated: 2026-08-26 · ADRs: [[3-offline-first-dexie-buckets]] · Code:
> apps/web/components/app/home, apps/web/features/offline/buckets/home

## Summary
The signed-in landing page: continue reading, reading stats, daily goal, recent annotations, and
discovery. The daily entry point into the habit.

## Scope
- In: current-book resume card, stats (hours, highlights, volumes) with local deltas, daily mastery
  chart, recent annotations, featured/collections panels — offline-capable.
- Non-goals: full discovery engine (explore — future), insights analytics page (future).

## Behaviour
1. Home loads a cached payload (recents, featured, stats, collections) and renders offline.
2. Stats display server baseline augmented with unsynced local session/progress deltas.
3. Current-book card resumes reading at the saved position; cards link into library/reader.
4. Collections panel rows open the clicked collection's page (payload carries the collection slug);
   the panel header's "open all" opens the library. A cached payload predating the slug field
   falls back to the library link until revalidation refreshes it.
5. Slow-action feedback ([styles.md](../styles.md) §Buttons): resume surfaces (desktop button,
   mobile engagement card — not covers) swap their label to "Opening" + trailing ellipsis dots
   while reader navigation is pending; import buttons (incl. the empty-state first upload) show
   "Uploading" + dots from file pick until the refreshed payload renders.

## Data & sync
home bucket (single payload row keyed to the user); composed with stats deltas. Service worker
serves the shell; client hydrates from the cached row.

## Edge cases
Cold start offline (no cached payload) → minimal shell; stale payload + fresh local deltas; no
current book.

## Acceptance criteria
- [ ] Home renders offline from the cached payload.
- [ ] Stats reflect local deltas without double-counting after sync.
- [ ] Resume card opens the current book at the last position.
- [ ] Clicking a collections-panel row opens that collection at /app/library/collections/[slug].
- [ ] Covers render whole (never cropped) whatever the source image ratio — one shared
      `<BookCover>` owns ratio and fit app-wide, see [styles.md](../styles.md).
- [ ] Resume and import controls show their pending label (Opening/Uploading + trailing dots)
      while the action is in flight.

## Open questions
Personalized recommendations source; insights page scope.
