# Home dashboard

> Status: shipped · Updated: 2026-09-15 · ADRs: [[3-offline-first-dexie-buckets]] · Code:
> apps/web/components/app/home, apps/web/features/offline/buckets/home

## Summary

The signed-in landing page: continue reading, reading stats, daily goal, recent annotations, and
discovery. The daily entry point into the habit.

## Scope

- In: current-book resume card, stats (hours, highlights, volumes) with local deltas, daily mastery
  chart, recent annotations, featured/collections panels — offline-capable; a Now Listening
  placeholder module (static transport, no audio).
- Non-goals: full discovery engine (explore — future), insights analytics page (future).

## Behaviour

1. Home loads a cached payload (recents, featured, stats, collections) and renders offline.
2. Stats display server baseline augmented with unsynced local session/progress deltas.
3. Current-book card resumes reading at the saved position; cards link into library/reader.
4. The collections panel lists the first six collections in the library's display order
   ([[3-library/3.1-library-screen]] §3) — the six most relevant shelves, not the six with the
   lowest sortOrder. Rows open the clicked collection's page (payload carries the slug);
   the panel header's "open all" opens the library. A cached payload predating the slug field
   falls back to the library link until revalidation refreshes it.
5. Now Listening lays out as one grid in two shapes. Below `md` the cover and the title/author
   share a row — the cover column is a percentage of the card, so cover and title scale together
   on a narrow phone — and the "coming soon" line, the times/bar and the transport each span the
   full card width beneath it. From `md` the cover spans the whole stack in its own column.
   Titles too wide for the column hyphenate (`hyphens-auto`, dictionary keyed off `<html lang>`).
6. Slow-action feedback ([styles.md](../styles.md) §Buttons): resume surfaces (desktop button,
   mobile engagement card — not covers) swap their label to "Opening" + trailing ellipsis dots
   while reader navigation is pending; import buttons (incl. the empty-state first upload) show
   "Uploading" + dots from file pick until the refreshed payload renders.
7. The quote block shows one quote from a fixed curated list, picked by UTC day so it changes once
   a day and every viewer sees the same quote. Each pass through the list is shuffled by a seeded
   PRNG keyed to the pass number: the order looks different every cycle, yet all quotes still show
   before any repeats, and the pick stays reproducible on both server and client. Quotes stay in
   their original English in all locales and live in a code list (`home-quotes.ts`), not in the
   i18n message files.
8. Recent annotations shows up to three stacked quote cards, one latest saved annotation per
   non-archived book, ordered by the shared engagement timestamp (latest read, opened, or added).
   Books without annotations are skipped before selecting three. Home fetches annotation text
   only for those selected books, using annotation counts on library metadata to find candidates.
   Fewer eligible books show fewer cards; no annotations shows the existing empty state.
9. Daily mastery uses the user's saved reading goal (60 minutes when unset). Local goal edits
   immediately update remaining minutes, the chart scale, and completion for all displayed days,
   including days without new reading activity. Reading minutes are preserved.
10. After hydration, mastery shows seven UTC dates ending today, retaining matching cached days
    and adding unsynced reading per date. New dates show locally known activity until refresh.
    The existing 30-second stats refresh and tab-resume refresh advance stale windows.
    Initial rendering retains the cached window to keep server/client hydration consistent.

## Data & sync

home bucket (single payload row keyed to the user); composed with stats deltas. Service worker
serves the shell; client hydrates from the cached row.

## Edge cases

Cold start offline (no cached payload) → minimal shell; stale payload + fresh local deltas; no
current book.

## Acceptance criteria

- [ ] Home renders offline from the cached payload.
- [ ] Stats reflect local deltas without double-counting after sync.
- [ ] Mastery uses the saved goal on first load and responds to local goal edits while offline.
- [ ] Resume card opens the current book at the last position.
- [ ] Clicking a collections-panel row opens that collection at /app/library/collections/[slug].
- [ ] Recent annotations shows the latest quote from each of three recently engaged books with
      annotations, or fewer cards when fewer books qualify, using the existing quote card design.
- [ ] Covers render whole (never cropped) whatever the source image ratio — one shared
      `<BookCover>` owns ratio and fit app-wide, see [styles.md](../styles.md).
- [ ] Resume and import controls show their pending label (Opening/Uploading + trailing dots)
      while the action is in flight.
- [ ] The quote block shows the same quote for a whole UTC day and a different one the next day,
      cycling through the full list before repeating, in a different order each pass.
- [ ] Below `md`, Now Listening renders the title beside the cover and never overflows its column
      at any phone width; from `md` the layout is unchanged.

## Known gaps

- A title long enough to overrun its column falls back to a mid-word break with no hyphen where the
  browser ships no hyphenation dictionary (embedded Chromium; iOS Safari hyphenates). Past five
  lines it truncates — `line-clamp-5`.
- `listening.authorLine` carries authors only; the "coming soon" line is web copy. A cached payload
  written before that split still holds the old combined string, so the suffix shows twice until
  revalidation refreshes the home bucket.

## Open questions

Personalized recommendations source; insights page scope.
