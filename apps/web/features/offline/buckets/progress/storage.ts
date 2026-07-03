// Dexie I/O for per-book reading progress. Mirrors the reader's
// localStorage resume snapshot but lives in the same store as the rest of
// the offline data so library cards / book-info can show the correct
// completion percent + last-read chapter offline without going through
// localStorage. The localStorage substrate stays in place as the fast
// synchronous read path for the reader's first-paint resume.

import type { ReaderLocator } from "@/lib/api-types";

import { getDb, type ProgressRow } from "../../db";

export async function writeProgress(input: {
  libraryItemId: string;
  locator: ReaderLocator | null;
  completionPercent: number;
  // Server reading timestamp. Server-sourced writes (progress PATCH ack,
  // primer revalidate) pass it; a local reader write omits it and the prior
  // baseline is preserved so resume-recency comparisons stay meaningful.
  lastReadAt?: string | null;
  // True when the local view is ahead of the server (a pending PATCH).
  // Used by a future runner to send PATCH for any dirty row.
  dirty?: boolean;
}): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const prior = await db.progress.get(input.libraryItemId);
  await db.progress.put({
    libraryItemId: input.libraryItemId,
    locator: input.locator,
    completionPercent: input.completionPercent,
    lastReadAt:
      input.lastReadAt !== undefined
        ? input.lastReadAt
        : (prior?.lastReadAt ?? null),
    lastLocalUpdateAt: nowIso,
    lastServerUpdateAt: prior?.lastServerUpdateAt ?? null,
    dirty: input.dirty ?? prior?.dirty ?? false,
  });
}

export async function markProgressSynced(
  libraryItemId: string,
): Promise<void> {
  const db = getDb();
  const row = await db.progress.get(libraryItemId);
  if (!row) {
    return;
  }
  await db.progress.put({
    ...row,
    lastServerUpdateAt: new Date().toISOString(),
    dirty: false,
  });
}

export async function readProgress(
  libraryItemId: string,
): Promise<ProgressRow | undefined> {
  const db = getDb();
  return db.progress.get(libraryItemId);
}

// Convenience read used by library cards and book-info to render the
// completion percent offline. Returns 0 when there's no cached row.
export async function readCompletionPercent(
  libraryItemId: string,
): Promise<number> {
  const row = await readProgress(libraryItemId);
  return row?.completionPercent ?? 0;
}
