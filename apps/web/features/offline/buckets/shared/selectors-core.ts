// Shared read-path primitives for the offline buckets (highlights,
// ai-comments). Both buckets merge a server snapshot with the pending queue
// the same way — snapshot rows form the baseline, a pending delete hides its
// row, and the result is sorted newest-first by `createdAt`. The only thing
// that differs is how a *non-delete* pending mutation becomes a record, so
// that single step is supplied by the caller via `applyPending`.

// Records carry an `id` (merge key) and a `createdAt` (sort key). Mutations
// carry a `kind` discriminant and the `id` of the row they target.
type Recordish = { id: string; createdAt: string };
type Mutationish = { kind: string; id: string };

// Builds the merged view (snapshot + pending) the UI renders. Pending deletes
// remove the matching row; every other pending mutation is handed to
// `applyPending`, which mutates the working map in place (the delete branch is
// already handled here, so the callback only ever sees non-delete mutations).
export function mergeSnapshotAndPending<
  R extends Recordish,
  M extends Mutationish,
>(
  snapshot: R[],
  pending: M[],
  applyPending: (byId: Map<string, R>, mutation: Exclude<M, { kind: "delete" }>) => void,
): R[] {
  const byId = new Map<string, R>();
  for (const row of snapshot) {
    byId.set(row.id, row);
  }
  for (const mutation of pending) {
    if (mutation.kind === "delete") {
      byId.delete(mutation.id);
      continue;
    }
    applyPending(byId, mutation as Exclude<M, { kind: "delete" }>);
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

// Wraps a `select` in the `version`-keyed memo used by useSyncExternalStore:
// re-derives only when the bucket's `version` changed since the last call,
// otherwise returns the cached array so React sees referential equality.
type DerivedBucket<R> = {
  version: number;
  derived: R[];
  derivedVersion: number;
};

export function createStableSelector<R, B extends DerivedBucket<R>>(
  select: (bucket: B) => R[],
): (bucket: B) => R[] {
  return (bucket) => {
    if (bucket.derivedVersion === bucket.version) {
      return bucket.derived;
    }
    bucket.derived = select(bucket);
    bucket.derivedVersion = bucket.version;
    return bucket.derived;
  };
}
