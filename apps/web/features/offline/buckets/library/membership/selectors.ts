import type { LibraryBookInfo } from "@/lib/api-types/library";
import type { CollectionMembershipRow, CollectionRow, LibraryItemRow } from "../../../db";
import type { MembershipMutation } from "./types";
import { cachedCompletionItem, isFinished } from "../../../completion/counts";

export function overlayBookCollections(
  baseline: LibraryBookInfo["collections"],
  mutation: MembershipMutation | undefined,
  collections: CollectionRow[],
): LibraryBookInfo["collections"] {
  const result = new Map(baseline.map((entry) => [entry.id, entry]));
  for (const change of mutation?.changes ?? []) {
    const collection = collections.find((entry) => entry.id === change.collectionId);
    if (collection?.kind !== "CUSTOM") continue;
    if (!change.member) result.delete(change.collectionId);
    else result.set(collection.id, {
      id: collection.id, kind: collection.kind, name: collection.name, smartKey: null,
    });
  }
  return [...result.values()];
}

export function overlayCollectionMembership(
  collection: CollectionRow,
  items: LibraryItemRow[],
  links: CollectionMembershipRow[],
  mutations: MembershipMutation[],
): { collection: CollectionRow; links: CollectionMembershipRow[] } {
  if (collection.kind !== "CUSTOM") return { collection, links };
  const members = new Map(links.map((link) => [link.libraryItemId, link]));
  const byId = new Map(items.map((item) => [item.libraryItemId, item]));
  let itemCount = collection.itemCount;
  let unreadCount = collection.unreadCount;
  let changed = false;
  for (const mutation of mutations) {
    const change = mutation.changes.find((entry) => entry.collectionId === collection.id);
    if (!change) continue;
    changed = true;
    const delta = Number(change.member) - Number(change.baselineMember);
    itemCount += delta;
    const item = byId.get(mutation.libraryItemId);
    if (!item || !isFinished(cachedCompletionItem(item))) unreadCount += delta;
    if (!change.member) members.delete(mutation.libraryItemId);
    else members.set(mutation.libraryItemId, {
      collectionId: collection.id, libraryItemId: mutation.libraryItemId, order: 0,
    });
  }
  if (!changed) return { collection, links };
  const ordered = [...members.values()].sort((left, right) =>
    Date.parse(byId.get(right.libraryItemId)?.lastReadAt ?? "1970-01-01") -
    Date.parse(byId.get(left.libraryItemId)?.lastReadAt ?? "1970-01-01"));
  return {
    collection: { ...collection, itemCount: Math.max(0, itemCount), unreadCount: Math.max(0, unreadCount) },
    links: ordered.map((link, order) => ({ ...link, order })),
  };
}
