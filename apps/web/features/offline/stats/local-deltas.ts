// Pure Dexie reads that produce the "local delta" inputs the stats
// composer adds on top of the cached server stats. Each function makes one
// scan and returns plain values so the composer stays trivially testable.

import { splitSecondsByUtcDay } from "./split-seconds-by-utc-day";
import { getDb } from "../db";
import {
  completionTables,
  composeCompletedCount,
  readCompletionContext,
} from "../completion/counts";

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
  // Only sealed sessions awaiting replay contribute local deltas.
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
    const slices = splitSecondsByUtcDay(row.startedAt, row.endedAt);
    const seconds = [...slices.values()].reduce((sum, value) => sum + value, 0);
    if (seconds === 0) {
      continue;
    }
    totalSeconds += seconds;
    byBookSeconds.set(
      row.libraryItemId,
      (byBookSeconds.get(row.libraryItemId) ?? 0) + seconds,
    );
    for (const [dayKey, sliceSeconds] of slices) {
      byUtcDaySeconds.set(
        dayKey,
        (byUtcDaySeconds.get(dayKey) ?? 0) + sliceSeconds,
      );
    }
  }

  return { totalSeconds, byBookSeconds, byUtcDaySeconds };
}

// Pending creates add one; deletes of snapshot highlights subtract one.
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

// Signed completion delta against the raw home snapshot (not composed readHome).
export async function readVolumesReadDelta(): Promise<number> {
  const db = getDb();
  return db.transaction("r", [db.home, ...completionTables(db)], async () => {
    const row = await db.home.get("me");
    if (row?.payload.completionItems === undefined) return 0;
    const context = await readCompletionContext(db);
    return (
      composeCompletedCount(
        row.payload.completionItems,
        row.completionRevision ?? 0,
        context,
      ) - row.payload.stats.volumesRead
    );
  });
}
