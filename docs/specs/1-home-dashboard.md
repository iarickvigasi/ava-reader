# Home dashboard

> Status: shipped · Updated: 2026-10-13 · ADRs: [[3-offline-first-dexie-buckets]] · Code:
> apps/web/components/app/home, apps/web/features/offline/buckets/home

## Summary

The signed-in landing page: resume reading, stats, daily goal, annotations, and discovery.

## Scope

- In: current-book resume card, stats (hours, highlights, volumes) with local deltas, daily mastery
  chart, recent annotations, featured/collections panels — offline-capable; a Now Listening
  placeholder module (static transport, no audio).
- Non-goals: full discovery engine (explore — future), insights analytics page (future).

## Behaviour

1. Home loads a cached payload (recents, featured, stats, collections) and renders offline. Route
   loading and cache hydration show a full-page skeleton matching populated Home.
2. Stats reconcile local sessions against the cached reading snapshot (see
   [[6-reading-sessions-progress]]).
3. Current-book card resumes reading at the saved position; cards link into library/reader.
4. The collections panel lists the first six collections in the library's display order
   ([[3-library/3.1-library-screen]] §3) — the six most relevant shelves, not the six with the
   lowest sortOrder. Rows open the clicked collection's page (payload carries the slug); the panel
   header's "open all" opens the library. A cached payload predating the slug field falls back to
   the library link until revalidation refreshes it.
5. Now Listening uses the current engagement’s library item ID for cached covers before network.
6. Resume actions report pending navigation as “Opening”; imports report “Uploading” from file
   selection until refreshed metadata is available. The book-cover link remains a resume action.
7. The quote block shows one quote from a fixed curated list, picked by UTC day so it changes once a
   day and every viewer sees the same quote. Each pass through the list is shuffled by a seeded PRNG
   keyed to the pass number: the order looks different every cycle, yet all quotes still show before
   any repeats, and the pick stays reproducible on both server and client. Quotes stay in their
   original English in all locales and live in a code list (`home-quotes.ts`), not in the i18n
   message files.
8. Recent annotations shows up to three entries, one latest saved annotation per non-archived book,
   ordered by the shared engagement timestamp (latest read, opened, or added). Books without
   annotations are skipped before selecting three. Home fetches annotation text only for those
   selected books, using annotation counts on library metadata to find candidates. Fewer eligible
   books show fewer cards; no annotations shows the existing empty state.
9. Daily mastery headings link to `/app/insights` on desktop and mobile. Daily mastery uses the
   user's saved reading goal (60 minutes when unset). Local goal edits immediately update remaining
   minutes, the chart scale, and completion for all displayed days, including days without new
   reading activity. Reading minutes are preserved.
10. After hydration, mastery shows seven device-local dates ending today, retaining matching cached
    days and adding unsynced reading per date. New dates show locally known activity until refresh.
    The existing 30-second stats refresh and tab-resume refresh advance stale windows. Initial
    rendering retains the cached window to keep server/client hydration consistent. Detect the
    device IANA timezone on hydration/resume; only today follows the current device zone. Historical
    minutes retain the local dates of each session’s saved start timezone. Calendar-day changes and
    timezone changes refresh the cache and chart without a reload.
11. Mastery scrolls horizontally through seven-day device-local windows, initially ending today.
    Arrow and keyboard navigation jumps to exact week boundaries anchored to today's window; loading
    earlier dates must not interrupt a move and leave partially clipped days. Older weeks load on
    demand and keep weekday/date context while pending. The previous-week action retries failures.
    Once today is no longer viewed, “Back to today” replaces the goal message; otherwise the goal
    message remains available. Responsive hide/show and resize preserve the viewed dates using the
    last visible scroll offset; hidden charts must not replace that offset with their reset DOM
    position. Prepending preserves the viewed dates; today’s summary remains fixed. Stop at the
    earliest recorded day, not an empty week. Earlier weeks stay in memory only and are never
    persisted. Offline users can browse already loaded weeks. Missing weeks remain retryable;
    authentication recovery or reconnect automatically retries the requested week without a page
    reload. Token and request deadlines prevent an indefinitely pending skeleton.
12. A localized introduction explains available features on empty and populated Home.
13. Featured public books use the same public work cover as Explore, resolved through the approved
    reading asset’s main catalog-entry ID. Never use the main Book cover as a fallback. Missing
    mappings or catalog outages show a placeholder; cached Home payloads refresh normally. Developer
    contacts follow [[10-user-profile]] for eligibility, localization, links and offline use.

Featured covers and titles open the mapped edition info page on desktop and mobile. Unmapped or
older cached entries remain unlinked until refreshed. Featured cards subscribe to the Home cache so
refreshed edition mappings update visible links without reopening the page.

Desktop featured cards offer Read (using the catalog acquisition/reader flow) and Add to library.
Mobile cards retain edition links on the cover and title without action buttons.
Featured descriptions use the same safe HTML/entity decoding as book info, including cached content.
Featured book previews follow the Home presentation rules in [styles](../styles.md).

## Data & sync

home bucket (single payload row keyed to the user); composed with stats deltas. Service worker
serves the shell; client hydrates from the cached row.

## Edge cases

Cold start offline → minimal shell; stale payload + fresh local deltas; no current book.

## Acceptance criteria

- [ ] Mastery loads older dates seven at a time, with skeletons and retry, without persisting
      history or shifting the viewed dates. Controls work on mobile, desktop, and keyboard.
- [ ] Home renders offline from the cached payload.
- [ ] Stats reflect local deltas without double-counting after sync.
- [ ] Mastery uses the saved goal on first load and responds to local goal edits while offline.
- [ ] Resume card opens the current book at the last position.
- [ ] Clicking a collections-panel row opens that collection at /app/library/collections/[slug].
- [ ] Recent annotations shows the latest quote from each of three recently engaged books with
      annotations, or fewer entries when fewer books qualify.
- [ ] Resume and import controls report pending navigation/upload until completion.
- [ ] The quote block shows the same quote for a whole UTC day and a different one the next day,
      cycling through the full list before repeating, in a different order each pass.

## Known gaps

- `listening.authorLine` carries authors only; the "coming soon" line is web copy. A cached payload
  written before that split still holds the old combined string, so the suffix shows twice until
  revalidation refreshes the home bucket.

## Open questions

Personalized recommendations source; insights page scope.
