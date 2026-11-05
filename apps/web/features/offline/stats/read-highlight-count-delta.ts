import { getDb, type HighlightMutationRow } from "../db";

// Pending creates add one; deletes of snapshot highlights subtract one.
export async function readHighlightCountDelta(): Promise<number> {
  const db = getDb();
  const [snapshotIds, mutations] = await Promise.all([
    db.highlights.toArray().then((rows) => new Set(rows.map((row) => row.id))),
    db.highlightMutations.toArray(),
  ]);
  return countHighlightChanges(snapshotIds, mutations);
}

function countHighlightChanges(
  snapshotIds: ReadonlySet<string>,
  mutations: HighlightMutationRow[],
) {
  let delta = 0;
  for (const mutation of mutations) {
    if (mutation.kind === "upsert") {
      if (!snapshotIds.has(mutation.highlightId)) delta += 1;
    } else if (snapshotIds.has(mutation.highlightId)) {
      delta -= 1;
    }
  }
  return delta;
}
