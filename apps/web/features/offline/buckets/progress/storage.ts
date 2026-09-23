import { isLibraryItemDeleted } from "../library/deleted-items";
// Dexie I/O for per-book reading progress. Lives alongside the rest of the
// offline data so cards / book-info / the reader can read completion % + the
// resume locator offline. The reader's localStorage snapshot stays as the fast
// synchronous first-paint path; this bucket is the durable, syncable copy.

import type { ReaderLocator } from "@/lib/api-types";

import { getDb, type AvaReaderDB, type ProgressRow } from "../../db";
import { bumpCompletionRevision, readCompletionRevision, recordCompletionAck, type CompletionWriteOptions } from "../../completion/state";

export async function writeProgress(input: {
  libraryItemId: string;
  locator: ReaderLocator | null;
  completionPercent: number;
  // Server reading timestamp; server-sourced writes (PATCH ack, primer
  // revalidate) pass it, a local reader write omits it and keeps the prior.
  lastReadAt?: string | null;
  // Local view ahead of the server (a pending PATCH). Drained by sync.ts.
  dirty?: boolean;
}, options: CompletionWriteOptions = {}): Promise<void> {
  const db = options.db ?? getDb();
  if (db !== getDb()) return;
  await db.transaction("rw", [db.progress, db.meta], async () => {
    if (await isLibraryItemDeleted(db, input.libraryItemId)) return;
    const prior = await db.progress.get(input.libraryItemId);
    if (options.expectedCompletionRevision !== undefined &&
      (prior?.dirty || options.expectedCompletionRevision !== await readCompletionRevision(db))) return;
    const nowIso = new Date().toISOString();
    await db.progress.put({
      libraryItemId: input.libraryItemId,
      locator: input.locator,
      completionPercent: input.completionPercent,
      lastReadAt: input.lastReadAt !== undefined ? input.lastReadAt : (prior?.lastReadAt ?? null),
      lastLocalUpdateAt: nowIso,
      lastServerUpdateAt: input.dirty === false ? nowIso : prior?.lastServerUpdateAt ?? null,
      dirty: input.dirty ?? prior?.dirty ?? false,
    });
    if (input.dirty === false) await recordCompletionAck(db, input.libraryItemId, { completionPercent: input.completionPercent });
    else await bumpCompletionRevision(db);
  });
}

export async function markProgressSynced(libraryItemId: string, db = getDb()): Promise<void> {
  if (db !== getDb()) return;
  await db.transaction("rw", [db.progress, db.meta], async () => {
    const row = await db.progress.get(libraryItemId);
    if (!row) return;
    await db.progress.put({ ...row, lastServerUpdateAt: new Date().toISOString(), dirty: false });
    await recordCompletionAck(db, libraryItemId, { completionPercent: row.completionPercent });
  });
}

// Dirty rows with a real position to push — the sync runner's work list.
// `dirty` is a boolean (not IndexedDB-indexable) so we scan+filter; the table
// holds one row per book, so it's cheap. Null-locator rows have nothing to send.
export async function listDirtyProgress(): Promise<ProgressRow[]> {
  const db = getDb();
  return db.progress
    .filter((row) => row.dirty && row.locator !== null)
    .toArray();
}

// Reconciles a dirty row after a successful PATCH: adopts the server's
// canonical position (locator + completion % + lastReadAt) and clears dirty —
// but only if the row still holds the locator we synced. A newer local write
// mid-request stays dirty (compare-and-clear). Adopting the server locator
// matters under most-recent-reading-wins: the server may have rejected our
// (stale) write and returned another device's newer position, which we take.
export async function markProgressSyncedIfUnchanged(
  libraryItemId: string,
  syncedLocator: ReaderLocator,
  server: {
    locator: ReaderLocator | null;
    completionPercent: number;
    lastReadAt: string | null;
  },
  db: AvaReaderDB = getDb(),
): Promise<void> {
  if (db !== getDb()) return;
  await db.transaction("rw", [db.progress, db.meta], async () => {
    const row = await db.progress.get(libraryItemId);
    if (!row) return;
    // Retain the canonical state beneath any newer unsynced local locator.
    await recordCompletionAck(db, libraryItemId, { completionPercent: server.completionPercent });
    if (!sameLocator(row.locator, syncedLocator)) return;
    await db.progress.put({
      ...row,
      locator: server.locator,
      completionPercent: server.completionPercent,
      lastReadAt: server.lastReadAt,
      lastServerUpdateAt: new Date().toISOString(),
      dirty: false,
    });
  });
}

export async function readProgress(
  libraryItemId: string,
): Promise<ProgressRow | undefined> {
  const db = getDb();
  return db.progress.get(libraryItemId);
}

// Completion % for cards / book-info offline. 0 when there's no cached row.
export async function readCompletionPercent(
  libraryItemId: string,
): Promise<number> {
  const row = await readProgress(libraryItemId);
  return row?.completionPercent ?? 0;
}

function sameLocator(a: ReaderLocator | null, b: ReaderLocator | null): boolean {
  if (!a || !b) {
    return a === b;
  }
  return (
    a.chapterId === b.chapterId &&
    a.blockId === b.blockId &&
    a.textOffset === b.textOffset
  );
}
