// Pure Dexie reads that produce the "local delta" inputs the stats
// composer adds on top of the cached server stats. Each function makes one
// scan and returns plain values so the composer stays trivially testable.
//
// All zero / null / empty-map results are valid — the composer adds zero
// to the server baseline and the UI shows the server number unchanged.

import { getDb } from "../db";
import { completionTables, composeCompletedCount, readCompletionContext } from "../completion/counts";

// Sum of session seconds the server hasn't yet acknowledged, plus a
// per-book and per-UTC-day breakdown so the composer can target the home
// `mastery.days` bar chart and the book-info `minutesRead` field in a
// single DB pass. Bucket key for the daily breakdown is "YYYY-MM-DD" in
// UTC — matches the server's `ReadingSessionSegment.trackedDay` indexing.
export type UnsyncedSessionDeltas = {
  totalSeconds: number;
  byBookSeconds: Map<string, number>;
  byUtcDaySeconds: Map<string, number>;
};

export async function readUnsyncedSessionDeltas(): Promise<UnsyncedSessionDeltas> {
  const db = getDb();
  // Open sessions don't count yet — they only become a delta once they're
  // closed (endedAt is sealed). The exclusion mirrors the server's own
  // "session ended" gate so we don't double-count when the row eventually
  // syncs.
  const rows = await db.sessions
    .filter(
      (row) => row.syncedAt === null && row.state === "closed" && !!row.endedAt,
    )
    .toArray();

  let totalSeconds = 0;
  const byBookSeconds = new Map<string, number>();
  const byUtcDaySeconds = new Map<string, number>();

  for (const row of rows) {
    if (!row.endedAt) {
      continue;
    }
    const seconds = Math.max(
      0,
      Math.round(
        (new Date(row.endedAt).getTime() -
          new Date(row.startedAt).getTime()) /
          1000,
      ),
    );
    if (seconds === 0) {
      continue;
    }
    totalSeconds += seconds;
    byBookSeconds.set(
      row.libraryItemId,
      (byBookSeconds.get(row.libraryItemId) ?? 0) + seconds,
    );
    const dayKey = toUtcDayKey(row.startedAt);
    byUtcDaySeconds.set(dayKey, (byUtcDaySeconds.get(dayKey) ?? 0) + seconds);
  }

  return { totalSeconds, byBookSeconds, byUtcDaySeconds };
}

// Net change to the user-wide highlight count vs. the server snapshot.
// `+1` for every pending upsert whose id isn't yet in the snapshot
// (created offline since the last GET); `-1` for every pending delete
// targeting an id that is in the snapshot (deleted offline but not yet
// acked). Re-edits to an existing highlight cancel out (upsert + existing
// id contributes 0).
export async function readHighlightCountDelta(): Promise<number> {
  const db = getDb();
  const [snapshotIds, mutations] = await Promise.all([
    db.highlights.toArray().then((rows) => new Set(rows.map((row) => row.id))),
    db.highlightMutations.toArray(),
  ]);
  let delta = 0;
  for (const mutation of mutations) {
    if (mutation.kind === "upsert") {
      if (!snapshotIds.has(mutation.highlightId)) {
        delta += 1;
      }
    } else if (mutation.kind === "delete") {
      if (snapshotIds.has(mutation.highlightId)) {
        delta -= 1;
      }
    }
  }
  return delta;
}

// Signed difference from the raw cached home snapshot. A finished date OR
// 100% progress completes a book; clearing a date can therefore subtract one.
// Full snapshot metadata makes this safe with only a partial local library.
// Callers using readHome() already receive the composed count and must not
// add this delta again. Legacy snapshots keep their server count unchanged.
export async function readVolumesReadDelta(): Promise<number> {
  const db = getDb();
  return db.transaction("r", [db.home, ...completionTables(db)], async () => {
    const row = await db.home.get("me");
    if (row?.payload.completionItems === undefined) return 0;
    const context = await readCompletionContext(db);
    return composeCompletedCount(row.payload.completionItems, row.completionRevision ?? 0, context) -
      row.payload.stats.volumesRead;
  });
}

// "YYYY-MM-DD" in UTC. Matches the server's daily bucketing for
// ReadingSessionSegment.trackedDay.
function toUtcDayKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const __test = { toUtcDayKey };
