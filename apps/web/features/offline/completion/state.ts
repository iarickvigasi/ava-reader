import { getDb, type AvaReaderDB } from "../db";

const REVISION_KEY = "completion-revision";
export const COMPLETION_CHANGE_PREFIX = "completion-change:";

export type RevisedValue<T> = { value: T; revision: number };
export type CompletionChange = {
  libraryItemId: string;
  finishedAt?: RevisedValue<string | null>;
  completionPercent?: RevisedValue<number>;
  offlineRequested?: RevisedValue<boolean>;
  memberships?: Record<string, RevisedValue<boolean>>;
};

export type CompletionWriteOptions = {
  db?: AvaReaderDB;
  expectedCompletionRevision?: number;
  seedOnly?: boolean;
  // Mutation responses can safely retain their original baseline while newer
  // acknowledged fields remain overlaid. Unlike a GET, they also carry an ack.
  snapshotCompletionRevision?: number;
};

export async function readCompletionRevision(db = getDb()): Promise<number> {
  const value = (await db.meta.get(REVISION_KEY))?.value;
  return typeof value === "number" ? value : 0;
}

// Call inside the same transaction as the corresponding local write or ack.
// This fences aggregate GETs across tabs, not just inside one JS runtime.
export async function bumpCompletionRevision(db: AvaReaderDB): Promise<number> {
  const revision = await readCompletionRevision(db) + 1;
  await db.meta.put({ key: REVISION_KEY, value: revision, updatedAt: new Date().toISOString() });
  return revision;
}

// Keep acknowledged fields until EACH aggregate has refreshed. Clearing the
// mutation queue alone cannot retire an adjustment to an older cached total.
// Fields are independent: saving a date must not freeze reading progress.
export async function recordCompletionAck(
  db: AvaReaderDB,
  libraryItemId: string,
  values: { finishedAt?: string | null; completionPercent?: number; offlineRequested?: boolean; memberships?: Record<string, boolean> },
): Promise<number> {
  const revision = await bumpCompletionRevision(db);
  const key = `${COMPLETION_CHANGE_PREFIX}${libraryItemId}`;
  const prior = (await db.meta.get(key))?.value as CompletionChange | undefined;
  const next: CompletionChange = { ...prior, libraryItemId };
  if (values.finishedAt !== undefined) next.finishedAt = { value: values.finishedAt, revision };
  if (values.completionPercent !== undefined) next.completionPercent = { value: values.completionPercent, revision };
  if (values.offlineRequested !== undefined) next.offlineRequested = { value: values.offlineRequested, revision };
  if (values.memberships) next.memberships = {
    ...prior?.memberships,
    ...Object.fromEntries(Object.entries(values.memberships).map(([id, value]) => [id, { value, revision }])),
  };
  await db.meta.put({ key, value: next, updatedAt: new Date().toISOString() });
  return revision;
}
