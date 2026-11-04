import { isLibraryItemDeleted } from "../library/deleted-items";
// Dexie I/O for per-book reading progress. Lives alongside the rest of the
// offline data so cards / book-info / the reader can read completion % + the
// resume locator offline. The reader's localStorage snapshot stays as the fast
// synchronous first-paint path; this bucket is the durable, syncable copy.

import type { ReaderLocator } from "@/lib/api-types";

import { getDb, type ProgressRow } from "../../db";
import {
  bumpCompletionRevision,
  readCompletionRevision,
  recordCompletionAck,
  type CompletionWriteOptions,
} from "../../completion/state";

export async function writeProgress(
  input: {
    libraryItemId: string;
    locator: ReaderLocator | null;
    completionPercent: number;
    // Server reading timestamp; server-sourced writes (PATCH ack, primer
    // revalidate) pass it, a local reader write omits it and keeps the prior.
    lastReadAt?: string | null;
    // Local view ahead of the server (a pending PATCH). Drained by sync.ts.
    dirty?: boolean;
  },
  options: CompletionWriteOptions = {},
): Promise<void> {
  const db = options.db ?? getDb();
  if (db !== getDb()) return;
  await db.transaction("rw", [db.progress, db.meta], async () => {
    if (await isLibraryItemDeleted(db, input.libraryItemId)) return;
    const prior = await db.progress.get(input.libraryItemId);
    if (
      options.expectedCompletionRevision !== undefined &&
      (prior?.dirty ||
        options.expectedCompletionRevision !==
          (await readCompletionRevision(db)))
    )
      return;
    // The serialized row clock also fences consecutive writes within one millisecond.
    const previous = Date.parse(prior?.lastLocalUpdateAt ?? "") || 0;
    const nowIso = new Date(Math.max(Date.now(), previous + 1)).toISOString();
    await db.progress.put({
      libraryItemId: input.libraryItemId,
      locator: input.locator,
      completionPercent: input.completionPercent,
      lastReadAt:
        input.lastReadAt !== undefined
          ? input.lastReadAt
          : (prior?.lastReadAt ?? null),
      lastLocalUpdateAt: nowIso,
      lastServerUpdateAt:
        input.dirty === false ? nowIso : (prior?.lastServerUpdateAt ?? null),
      dirty: input.dirty ?? prior?.dirty ?? false,
    });
    if (input.dirty === false)
      await recordCompletionAck(db, input.libraryItemId, {
        completionPercent: input.completionPercent,
      });
    else await bumpCompletionRevision(db);
  });
}

// Dirty rows with a real position to push — the sync runner's work list.
// `dirty` is a boolean (not IndexedDB-indexable) so we scan+filter; the table
// holds one row per book, so it's cheap. Null-locator rows have nothing to send.
export async function listDirtyProgress(db = getDb()): Promise<ProgressRow[]> {
  return db.progress
    .filter((row) => row.dirty && row.locator !== null)
    .toArray();
}

export async function readProgress(
  libraryItemId: string,
): Promise<ProgressRow | undefined> {
  const db = getDb();
  return db.progress.get(libraryItemId);
}
