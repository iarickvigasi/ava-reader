# Reader · resume

> Status: shipped · Updated: 2026-06-07 · Parent: [[_overview]] · Code: apps/web/features/reader/resume.ts

## Summary
Restores the reader to the last position on reopen, reconciling a fast local snapshot with the synced server position.

## Scope
- In: writing/reading a local resume snapshot, building a server snapshot, choosing the preferred snapshot, parsing/migrating snapshot versions, producing the restore target.
- Non-goals: pinning the page to that target (see pagination), tracking minutes/% (see 5-reading-sessions-progress).

## Behaviour
1. On position change, writeLocalReaderResumeSnapshot stores a versioned snapshot (v2: {locator, savedAt, version}) in localStorage, keyed per libraryItemId.
2. On open, read the local snapshot and the server one (createServerResumeSnapshot from ReaderProgressPayload).
3. selectPreferredReaderResumeSnapshot chooses between local and server (by recency/source) → a ReaderResumeSelection.
4. The chosen locator becomes a navigation target / restore intent so pagination lands on the right page.
5. parseReaderResumeSnapshot tolerates/migrates older or malformed values.

## Data & sync
Local: localStorage (createReaderResumeStorageKey). Server: `initialPayload.progress` — from the live reader fetch when online-uncached, else overlaid from the **progress bucket** by the cached reader payload (`loadReaderPayloadFromCache`). So a cached/offline book on a fresh device still gets a server snapshot (the primer fills the bucket — [[11-cache-priming]]); a position advanced on another device can win over a stale local snapshot once the bucket revalidates. Locator types from spec 4.

## Edge cases
No snapshot (first open) → start at chapter 1; corrupt/old-version snapshot → parse safely or discard; local newer than server (offline reading); server newer (read on another device); locator no longer resolvable.

## Acceptance criteria
- [ ] Reopening resumes at the last position from the most recent source.
- [ ] Offline-written local position wins until the server catches up.
- [ ] Corrupt or legacy snapshots never crash; they degrade to a safe start.

## Open questions
Resume across re-imported editions. (Two-device divergence is now resolved server-side by most-recent-reading-wins — see [[5-reading-sessions-progress]] — modulo client clock skew.)
