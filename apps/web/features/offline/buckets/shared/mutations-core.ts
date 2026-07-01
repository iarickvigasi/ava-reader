// Shared write-path primitives for the offline buckets (highlights,
// ai-comments). Two pieces are identical across buckets:
//   - `commit` — append a mutation to the queue, coalescing out any existing
//     pending row for the same id (we only ever need to send the final state),
//     mirror it to Dexie, and kick a flush.
//   - `enqueueDelete` — the everSynced/collapse logic: a delete for an id that
//     was never synced (only a queued upsert/generate) drops both, since
//     there's nothing on the server to delete.
//
// Each bucket's bespoke enqueue (enqueueUpsert / enqueueGenerate) builds its
// mutation and hands it to `commit`.

import { persist, trackPersist } from "./bucket-core";

type Mutationish = { id: string; kind: string };

type CommitBucket<Mutation> = {
  state: { snapshot: { id: string }[]; pending: Mutation[] };
  version: number;
  listeners: Set<() => void>;
  pendingPersist: Promise<unknown>;
};

type MutationDeps<Bucket, Mutation> = {
  getOrCreateBucket: (libraryItemId: string, apiBaseUrl: string) => Bucket;
  upsertPendingMutation: (
    libraryItemId: string,
    mutation: Mutation,
  ) => Promise<unknown>;
  removePendingMutation: (id: string) => Promise<unknown>;
  flushBucket: (libraryItemId: string, apiBaseUrl: string) => unknown;
};

export function createMutations<
  Mutation extends Mutationish,
  Bucket extends CommitBucket<Mutation>,
>({
  getOrCreateBucket,
  upsertPendingMutation,
  removePendingMutation,
  flushBucket,
}: MutationDeps<Bucket, Mutation>) {
  // Appends `mutation`, coalescing out any existing pending row with the same
  // id, then mirrors to Dexie (mutationId == row id, so put() coalesces the
  // Dexie row too) and kicks a flush.
  function commit(
    libraryItemId: string,
    apiBaseUrl: string,
    mutation: Mutation,
  ): void {
    const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
    const filtered = bucket.state.pending.filter((m) => m.id !== mutation.id);
    bucket.state = {
      ...bucket.state,
      pending: [...filtered, mutation],
    };
    persist(bucket);
    trackPersist(bucket, () => upsertPendingMutation(libraryItemId, mutation));
    void flushBucket(libraryItemId, apiBaseUrl);
  }

  function enqueueDelete(
    libraryItemId: string,
    apiBaseUrl: string,
    id: string,
  ): void {
    const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
    // If the row has never been synced (only exists in pending as an
    // upsert/generate), drop both the queued mutation and the delete — there's
    // nothing to delete on the server.
    const everSynced = bucket.state.snapshot.some((row) => row.id === id);
    const filtered = bucket.state.pending.filter((m) => m.id !== id);
    if (!everSynced) {
      bucket.state = { ...bucket.state, pending: filtered };
      persist(bucket);
      // Whatever mutation was queued, scrub it from Dexie too.
      trackPersist(bucket, () => removePendingMutation(id));
      return;
    }
    const next = {
      kind: "delete",
      id,
      queuedAt: new Date().toISOString(),
    } as unknown as Mutation;
    bucket.state = {
      ...bucket.state,
      pending: [...filtered, next],
    };
    persist(bucket);
    trackPersist(bucket, () => upsertPendingMutation(libraryItemId, next));
    void flushBucket(libraryItemId, apiBaseUrl);
  }

  return { commit, enqueueDelete };
}
