# Highlights

> Status: shipped · Updated: 2026-06-30 · ADRs: [[3-offline-first-dexie-buckets]] · Code:
> apps/web/components/app/reader/reader-screen/overlays/highlights,
> apps/web/features/offline/buckets/highlights

## Summary
Color-coded text selections a reader saves while reading, listed in a panel and painted in-text.
Supports the deep-reading and revisit jobs.

## Scope
- In: create/recolor/delete a highlight, paint marks in the text, panel listing with color filter +
  jump-to-location, offline create/sync.
- Non-goals: notes/diary text, AI annotations (see ai-comments), sharing.

## Behaviour
1. Select text → color picker → highlight is painted instantly and added to the panel.
2. Panel lists highlights per book; filter by color; click jumps to the locator.
3. Recolor or delete updates instantly.

## Data & sync
highlights bucket; HighlightRecord anchored by locator + color. enqueueUpsert/enqueueDelete,
coalesced one-per-id, flushed idempotently (PUT keyed by client ULID) to
/library/:itemId/highlights.

## Edge cases
Offline create then reconnect; overlapping selections; locator that no longer resolves after
re-import; permanent failure → DropEvent toast. Replay integrity: the acked head is popped from the
queue by identity (not position), so a coalescing edit that lands while its own sync is in flight
can't drop a different queued highlight; a transient null auth token mid-flush (Clerk refresh)
reschedules instead of stranding the queue.

## Acceptance criteria
- [ ] Creating a highlight offline paints it and syncs on reconnect.
- [ ] Marks render at the correct text range across reloads.
- [ ] Delete/recolor reflect instantly and persist.

## Open questions
Cross-highlight overlap rendering; export.
