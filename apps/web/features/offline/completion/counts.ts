import type { CompletionItem, LibraryCollection } from "@/lib/api-types/library";
import { isOfflineBooksCollection } from "@/lib/smart-collections";
import type { AvaReaderDB, LibraryItemRow, ProgressRow } from "../db";
import type { FinishDateMutation } from "../buckets/library/finish-date/types";
import type { MembershipMutation } from "../buckets/library/membership/types";
import { COMPLETION_CHANGE_PREFIX, type CompletionChange } from "./state";

export type CompletionContext = {
  items: Map<string, LibraryItemRow>;
  dates: Map<string, FinishDateMutation>;
  progress: Map<string, ProgressRow>;
  memberships: Map<string, MembershipMutation>;
  changes: Map<string, CompletionChange>;
};

export const completionTables = (db: AvaReaderDB) => [
  db.libraryItems, db.finishDateMutations, db.progress, db.collectionMembershipMutations, db.meta,
];

export async function readCompletionContext(db: AvaReaderDB): Promise<CompletionContext> {
  const [items, dates, progress, memberships, changes] = await Promise.all([
    db.libraryItems.toArray(), db.finishDateMutations.toArray(), db.progress.toArray(),
    db.collectionMembershipMutations.toArray(), db.meta.where("key").startsWith(COMPLETION_CHANGE_PREFIX).toArray(),
  ]);
  return {
    items: new Map(items.map((row) => [row.libraryItemId, row])),
    dates: new Map(dates.map((row) => [row.libraryItemId, row])),
    progress: new Map(progress.map((row) => [row.libraryItemId, row])),
    memberships: new Map(memberships.map((row) => [row.libraryItemId, row])),
    changes: new Map(changes.map((row) => {
      const change = row.value as CompletionChange;
      return [change.libraryItemId, change];
    })),
  };
}

export function isFinished(item: { finishedAt?: string | null; completionPercent: number }): boolean {
  return item.finishedAt != null || item.completionPercent >= 100;
}

export function cachedCompletionItem(row: LibraryItemRow): CompletionItem {
  return { libraryItemId: row.libraryItemId, completionPercent: row.completionPercent,
    finishedAt: row.finishedAt !== undefined ? row.finishedAt : row.details?.finishedAt ?? null };
}

export function effectiveCompletion(item: CompletionItem, revision: number, context: CompletionContext): CompletionItem {
  const id = item.libraryItemId;
  const change = context.changes.get(id);
  const date = context.dates.get(id);
  const progress = context.progress.get(id);
  return {
    libraryItemId: id,
    finishedAt: date ? date.finishedAt :
      change?.finishedAt && change.finishedAt.revision > revision ? change.finishedAt.value : item.finishedAt,
    completionPercent: progress?.dirty ? progress.completionPercent :
      change?.completionPercent && change.completionPercent.revision > revision ? change.completionPercent.value : item.completionPercent,
  };
}

// The snapshot covers the whole library, including archived items. Never
// replace it with a count of whichever books happen to be cached locally.
export function composeCompletedCount(items: CompletionItem[], revision: number, context: CompletionContext): number {
  const baseline = new Map(items.map((item) => [item.libraryItemId, item]));
  for (const id of new Set([...context.dates.keys(), ...context.progress.keys(), ...context.changes.keys()])) {
    if (baseline.has(id)) continue;
    const row = context.items.get(id);
    const change = context.changes.get(id);
    if (context.dates.has(id) || context.progress.get(id)?.dirty ||
      (change?.finishedAt?.revision ?? 0) > revision || (change?.completionPercent?.revision ?? 0) > revision) {
      baseline.set(id, row ? cachedCompletionItem(row) : {
        libraryItemId: id, finishedAt: null, completionPercent: 0,
      });
    }
  }
  return [...baseline.values()].filter((item) => isFinished(effectiveCompletion(item, revision, context))).length;
}

type CountedCollection = Pick<LibraryCollection, "id" | "kind" | "smartKey" | "itemCount" | "unreadCount" | "completionItems"> & {
  completionRevision?: number;
};

// Membership and completion are evaluated together. Finishing then removing
// the same book changes its contribution once, rather than subtracting twice.
export function composeCollectionCounts(collection: CountedCollection, context: CompletionContext) {
  if (!collection.completionItems) return { itemCount: collection.itemCount, unreadCount: collection.unreadCount };
  const revision = collection.completionRevision ?? 0;
  const baseline = new Map(collection.completionItems.map((item) => [item.libraryItemId, item]));
  const members = new Set(baseline.keys());
  const offline = isOfflineBooksCollection(collection);
  if (offline || collection.kind === "CUSTOM") {
    for (const id of new Set([...context.items.keys(), ...context.changes.keys(), ...context.memberships.keys()])) {
      const change = context.changes.get(id);
      const ack = offline ? change?.offlineRequested : change?.memberships?.[collection.id];
      const row = context.items.get(id);
      const pending = offline
        ? row?.offlineRequestedDirty ? row.offlineRequested === true : undefined
        : context.memberships.get(id)?.changes.find((entry) => entry.collectionId === collection.id)?.member;
      const member = pending ?? (ack && ack.revision > revision ? ack.value : undefined);
      if (member === true) members.add(id);
      else if (member === false) members.delete(id);
    }
  }
  let unreadCount = 0;
  for (const id of members) {
    const row = context.items.get(id);
    const item = baseline.get(id) ?? (row ? cachedCompletionItem(row) : undefined);
    if (item && !isFinished(effectiveCompletion(item, revision, context))) unreadCount += 1;
  }
  return { itemCount: members.size, unreadCount };
}
