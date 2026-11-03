# Reading sessions, progress & stats

> Status: implemented · Updated: 2026-11-03
> ADRs: [[3-offline-first-dexie-buckets]], [[7-reading-time-intervals]], [[15-local-reading-checkpoints]] · Code:
> apps/web/features/offline/buckets/{sessions,progress}, apps/web/features/offline/stats,
> apps/web/components/app/home/sections/mastery, apps/api/src/reader/{sessions,progress}

## Summary

Tracks position, reading time and daily goals offline; composes home stats to support reading habits.

## Scope

- In: local session checkpoints, current locator + completion %, minutes read, daily-goal mastery
  chart, server-baseline + local-delta stats.

## Behaviour

1. Ready, visible reading starts a local session immediately. Every 30 seconds saves a checkpoint;
   normal hide/close saves the final remainder. Neither local operation waits for the network.
2. Independent device sessions add, including overlapping time. A session keeps its client ID across
   reconnects; replaying the same revision never adds time twice. One tracker owns recording within
   a browser profile/account. Hidden time and unexplained checkpoint gaps over 90 seconds do not
   accrue; recovery closes abandoned runs at their last durable checkpoint.
3. Position writes update the progress bucket (locator, completion %, minutes).
4. Home shows totals (hours, highlights, volumes) and a per-day minutes-vs-goal chart, all correct
   offline.
5. Time tracking runs silently. Persistence and sync failures retry automatically without messages
   or manual retry actions that interrupt reading.

## Data & sync

Sessions persist cumulative checkpoints keyed by stable clientSessionId; progress syncs independently.
Reading totals add uncovered local seconds to each snapshot; highlights add pending count changes.

`volumesRead` counts each library item once when **finishedAt is non-null OR completionPercent is
at least 100**. A manual finish date does not change percentage, reading position, or reading time.
Removing the date subtracts a completion only if progress is below 100; a dated book at 100 still
counts once. Home includes archived library items in this total.

The home snapshot carries a complete lightweight `completionItems` list, including items absent
from this device's book/progress cache. Reads compose each item's snapshot fields with newer
acknowledged fields and pending date/progress edits. Acknowledged changes remain available after
their queues clear until the particular home snapshot reflects them; an unrelated collection
refresh cannot retire a home adjustment. See [[4.11-completion-counts]] for the snapshot revision
and membership composition rules. Older cached home payloads without this metadata keep their
server total until a fresh response supplies it.

`readHome()` returns the effective completion total. The home stats hook consumes that value
directly and adds only its other stats deltas, so online and offline rendering never apply a
completion adjustment twice. Home stats and collection counts subscribe to Dexie changes.

The progress bucket (locator + completion % + server `lastReadAt`) is the offline resume substrate,
populated three ways: the reader writes it while reading (dirty until the server acks), `GET
/reader/progress` revalidates it from the server (primer, on reconnect — see [[4.4-cache-priming]]),
and the cached reader payload reads it back so a fresh/offline device resumes on the right page
([[2-reader/2.5-resume]]). A **dirty** row (local ahead) always wins over a server revalidate.

**Progress sync runner** (`progress/sync.ts`, mounted app-wide as `ProgressSyncRunner`, mirroring
the preferences/offline-intent flush): on reconnect / tab-visible / mount it PATCHes every dirty row
up to the server (single-flight, online-guarded), sending the row's **read time** (`readAt` =
`lastLocalUpdateAt`, the offline read moment — not the flush time); then clears the flag via a
compare-and-clear fence, adopting whatever position the server returns (a newer local write
mid-PATCH stays dirty for the next pass). This makes offline reading sync up **without reopening the
book**; before it, a dirty row only flushed through the open reader.

**Conflict resolution — most-recent-reading wins.** Every progress write (reader live PATCH + sync
runner) carries the client `readAt`; `PATCH .../reader/progress` ignores a write older than the
stored `lastReadAt` and returns the newer stored position for the client to adopt. So a late offline
sync can't rewind a page another device advanced, while a deliberate backward re-read still wins
(it's more recent). Decided by client wall-clock (skew caveat); the JS compare isn't fully atomic
against a same-book write racing inside one request. Resolves the [[2-reader/2.5-resume]] divergence
question.

Checkpoint uploads are the only supported reading-time protocol. The old start, heartbeat, stop,
and completed-session replay routes are removed. Cache upgrades discard pre-checkpoint local sessions,
including pending legacy time, and retire the unused session-mutation and stats-snapshot stores.
Already credited server history remains available. Checkpoints use whole-second prefixes capped at 24h.

Version 2 sessions persist cumulative contiguous checkpoints before `POST .../session/checkpoint`.
The payload carries clientSessionId, startedAt, checkpointAt, timeZone, revision and nullable endedAt.
The server credits only the extension of the saved prefix; repeated/older revisions are no-ops and
closed sessions never reopen. Local acknowledgment advances only the uploaded revision. Both open
and closed dirty sessions use the existing account sync runner with bounded requests and retries.

Home, history and book-info snapshots carry exact total seconds and per-session credited seconds
from the same transaction. Local rows add their uncovered suffix, even after acknowledgment.
Snapshot reading revisions reject older totals; coverage lookups are indexed once per composition.
Daily grouping uses the saved session timezone and rounding follows summation. Home coverage never
reconciles book-info against a different snapshot. Old caches retain their legacy baseline.

Mastery history stays in memory, using seven-day exclusive `before` cursors and snapshot coverage.

New sessions capture the device IANA timezone once, locally and on the server. Checkpoint, close,
and retry preserve it. Historical shared sessions keep the first creator's zone.
Credited UTC intervals are merged when adjacent and written with UTC totals in one transaction.
Home/history split intervals at midnight in each session's saved timezone, including DST. Travel
changes only today/window, never historical day assignment. UTC totals remain authoritative;
subtract interval-covered UTC seconds before grouping. Version 3 snapshots retain interval zones.
Old sessions without a saved timezone retain UTC allocation; never infer it from the viewer.
Version 2 caches retain their supplied daily allocation until refresh. A session keeps its start
zone across a device-zone change; the next session captures the new zone.

## Acceptance criteria

- [x] Reading offline accrues minutes and shows on home without double-counting after sync.
- [x] Online device A records 10 minutes; offline B records 5, reconnects, then reads 3: total 18.
- [x] Delayed/lost responses, reversed revisions and close during upload cannot lose or duplicate time.
- [x] Crash recovery retains durable time; hidden/suspended gaps and duplicate tab trackers add none.
- [ ] Home counts replayed sessions once in both GET/ack orders, after lost responses, reload,
      and stale GET arrivals; IDs older than the mastery window reconcile all-time hours too.
- [ ] Completion % and resume position survive reload and reconnect.
- [ ] A stale offline progress sync never rewinds a position advanced on another device
      (most-recent-reading wins); a genuine later read does win.
- [x] At 00:58 Sep 25 in Belgrade, today is Friday; 00:10–00:50 credits Friday 40 minutes.
- [x] Local midnight splits and DST preserve totals; travel/replay never reassign historical dates.
- [ ] A session saved in UTC at 23:40–00:30 credits 20 then 30 minutes, unchanged
      after the split server baseline replaces its local delta.
- [ ] Home's Books Read includes dated books or books at 100%, each once, including uncached and
      archived books. Clearing a date at 100% keeps the book counted.
- [ ] Pending additions/removals update counts immediately and survive queue acknowledgment,
      reload, and stale aggregate responses without duplicate or disappearing adjustments.

## Open questions

Time-remaining estimate model. Missing legacy intervals without durable checkpoints are unrecoverable.

Known gap: highlight counts retire pending deltas at upload acknowledgment, before a cached Home total
necessarily includes them. The displayed count can temporarily fall back until Home refreshes.
