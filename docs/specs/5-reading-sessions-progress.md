# Reading sessions, progress & stats

> Status: shipped · Updated: 2026-08-11 · ADRs: [[3-offline-first-dexie-buckets]] · Code:
> apps/web/features/offline/buckets/{sessions,progress}, apps/web/features/offline/stats,
> apps/web/components/app/home/sections/mastery, apps/api/src/reader/{sessions,progress}

## Summary
Tracks reading position, time read, and reading streak/goal — fully offline — and composes the stats
shown on home. Serves the "track time spent/remaining, build a habit" job.

## Scope
- In: session start/heartbeat/stop, current locator + completion %, minutes read, daily-goal mastery
  chart, server-baseline + local-delta stats.
- Non-goals: reading diary/reflection (future), social comparison.

## Behaviour
1. Opening a book starts a session; heartbeats accrue while reading; closing stops it.
2. Sessions are **multi-device**: each client sends a `clientInstanceId` and is tracked as a session
   participant. Time accrues only while at least one participant is live (none seen for 90s → marked
   stopped), and a `stop` ends the session only once no live participant remains — so reading one
   book on a second device neither double-counts the time nor cuts the first device off.
3. Position writes update the progress bucket (locator, completion %, minutes).
4. Home shows totals (hours, highlights, volumes) and a per-day minutes-vs-goal chart, all correct
   offline.

## Data & sync
sessions bucket (clientSessionId ULID, per-day segments) and progress bucket; both flush
idempotently. Stats = server baseline + unsynced local deltas, so reconnect never double-counts.

The progress bucket (locator + completion % + server `lastReadAt`) is the offline resume substrate,
populated three ways: the reader writes it while reading (dirty until the server acks), `GET
/reader/progress` revalidates it from the server (primer, on reconnect — see [[11-cache-priming]]),
and the cached reader payload reads it back so a fresh/offline device resumes on the right page
([[1-reader/1.5-resume]]). A **dirty** row (local ahead) always wins over a server revalidate.

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
against a same-book write racing inside one request. Resolves the [[1-reader/1.5-resume]] divergence
question.

A completed offline session replays via `POST .../session` with `clientSessionId` + original
`startedAt`/`endedAt`. The server records it with those exact timestamps and the real `endedAt −
startedAt` duration (split into per-UTC-day segments), keyed `@@unique([userId, clientSessionId])` —
so a retried replay returns the existing row unchanged rather than reopening or re-dating it.
Timestamps are validated (invalid date or `endedAt < startedAt` → 400); an over-long span is clamped
to 24h and logged. This path never routes through the live `start` action.

## Edge cases
Offline across multiple days; multiple devices for one book; clock changes; session never stopped
(crash) → heartbeat bounds it.

## Acceptance criteria
- [ ] Reading offline accrues minutes and shows on home without double-counting after sync.
- [ ] Completion % and resume position survive reload and reconnect.
- [ ] A stale offline progress sync never rewinds a position advanced on another device
  (most-recent-reading wins); a genuine later read does win.
- [ ] Daily mastery chart reflects per-day minutes against the goal.

## Open questions
Time-remaining estimate model; merging sessions started independently on two offline devices (the
participant mechanism above only reconciles clients that reach the same session row).
