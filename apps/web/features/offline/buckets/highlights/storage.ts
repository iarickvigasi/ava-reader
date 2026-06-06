// Dexie I/O for the highlights bucket. Replaces the localStorage substrate
// from the original module. Tables:
//   - highlights        — confirmed-by-server records (mirrors state.snapshot)
//   - highlightMutations — pending writes (mirrors state.pending)
//
// Each operation is small and atomic — there's no debounced "write the whole
// blob" step anymore. The bucket's in-memory state is updated by the
// caller (mutations.ts / sync.ts) and a matching Dexie write is fired in
// lockstep. If the tab crashes between in-memory and Dexie write, we lose
// the last unsynced mutation; the same race existed before with the 100ms
// debounce window and was considered acceptable.

import type {
  HighlightMutationPayload,
  HighlightMutationRow,
  HighlightRow,
} from "../../db";
import { getDb } from "../../db";

import {
  STORAGE_VERSION,
  type HighlightColor,
  type HighlightRecord,
  type HighlightsState,
  type PendingMutation,
} from "./types";

// Same legacy key prefix the localStorage substrate used. Surfaced so the
// cleanup module can purge old per-book entries on first boot after the
// migration.
export const LEGACY_LOCALSTORAGE_PREFIX = "ava-reader:highlights:";

// ----- reads ----------------------------------------------------------------

export async function readStorage(
  libraryItemId: string,
): Promise<HighlightsState> {
  const db = getDb();
  const [highlightRows, mutationRows] = await Promise.all([
    db.highlights.where("libraryItemId").equals(libraryItemId).toArray(),
    db.highlightMutations
      .where("scopeId")
      .equals(libraryItemId)
      .sortBy("queuedAt"),
  ]);
  return {
    version: STORAGE_VERSION,
    snapshot: highlightRows.map(rowToRecord),
    pending: mutationRows.map(rowToPendingMutation),
  };
}

// ----- snapshot writes ------------------------------------------------------

// Replaces every highlight row for this book with the provided list. Used
// after a fresh GET — the server is authoritative for the snapshot.
export async function replaceSnapshot(
  libraryItemId: string,
  snapshot: HighlightRecord[],
): Promise<void> {
  const db = getDb();
  const rows = snapshot.map((record) => recordToRow(libraryItemId, record));
  await db.transaction("rw", db.highlights, async () => {
    await db.highlights
      .where("libraryItemId")
      .equals(libraryItemId)
      .delete();
    await db.highlights.bulkPut(rows);
  });
}

export async function upsertSnapshotRow(
  libraryItemId: string,
  record: HighlightRecord,
): Promise<void> {
  const db = getDb();
  await db.highlights.put(recordToRow(libraryItemId, record));
}

export async function removeSnapshotRow(
  libraryItemId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  await db.highlights.delete([libraryItemId, id]);
}

// ----- mutation queue writes ------------------------------------------------

// Inserts or replaces the pending mutation for a given highlight. Each
// highlight has at most one pending mutation in flight; the mutationId is
// the highlight id so re-issuing an upsert (e.g. color change after color
// change) collapses to a single row.
export async function upsertPendingMutation(
  libraryItemId: string,
  mutation: PendingMutation,
): Promise<void> {
  const db = getDb();
  await db.highlightMutations.put(pendingToRow(libraryItemId, mutation));
}

export async function removePendingMutation(
  highlightId: string,
): Promise<void> {
  const db = getDb();
  await db.highlightMutations.delete(highlightId);
}

// ----- conversions ----------------------------------------------------------

function rowToRecord(row: HighlightRow): HighlightRecord {
  return {
    id: row.id,
    excerpt: row.excerpt,
    color: (row.color || "apricot") as HighlightColor,
    locator: row.locator,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function recordToRow(
  libraryItemId: string,
  record: HighlightRecord,
): HighlightRow {
  return {
    libraryItemId,
    id: record.id,
    excerpt: record.excerpt,
    color: record.color,
    locator: record.locator,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function rowToPendingMutation(row: HighlightMutationRow): PendingMutation {
  if (row.kind === "delete") {
    return {
      kind: "delete",
      id: row.highlightId,
      queuedAt: row.queuedAt,
    };
  }
  // Upsert. The envelope's payload is typed loosely (string highlightColor);
  // narrow back to the union here so callers can rely on it.
  const payload = row.payload as Exclude<HighlightMutationPayload, null>;
  return {
    kind: "upsert",
    id: row.highlightId,
    payload: {
      excerpt: payload.excerpt,
      highlightColor: payload.highlightColor as HighlightColor,
      locator: payload.locator,
    },
    queuedAt: row.queuedAt,
  };
}

function pendingToRow(
  libraryItemId: string,
  mutation: PendingMutation,
): HighlightMutationRow {
  const base = {
    // mutationId == highlightId: there's at most one pending mutation per
    // highlight at any time (mutations.ts coalesces), so reusing the id as
    // the primary key gives free idempotent replacement via Dexie.put().
    mutationId: mutation.id,
    scopeId: libraryItemId,
    queuedAt: mutation.queuedAt,
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
    highlightId: mutation.id,
  };
  if (mutation.kind === "delete") {
    return { ...base, kind: "delete", payload: null };
  }
  return {
    ...base,
    kind: "upsert",
    payload: {
      excerpt: mutation.payload.excerpt,
      highlightColor: mutation.payload.highlightColor,
      locator: mutation.payload.locator,
    },
  };
}
