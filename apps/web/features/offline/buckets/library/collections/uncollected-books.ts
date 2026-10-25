import type { LibraryCollection } from "@/lib/api-types/library";
import type {
  CollectionMembershipRow,
  CollectionRow,
  LibraryItemRow,
} from "../../../db";
import type { MembershipMutation } from "../membership/types";

export function selectUncollectedRows(
  items: LibraryItemRow[],
  collections: CollectionRow[],
  links: CollectionMembershipRow[],
  mutations: MembershipMutation[],
): LibraryItemRow[] {
  const collectionIds = new Set(collections.map((row) => row.id));
  const memberships = new Map<string, Set<string>>();
  const setMember = (id: string, collectionId: string, member: boolean) => {
    if (!collectionIds.has(collectionId)) return;
    const ids = memberships.get(id) ?? new Set<string>();
    if (member) ids.add(collectionId);
    else ids.delete(collectionId);
    memberships.set(id, ids);
  };
  for (const link of links)
    setMember(link.libraryItemId, link.collectionId, true);
  for (const mutation of mutations) {
    for (const change of mutation.changes)
      setMember(mutation.libraryItemId, change.collectionId, change.member);
  }
  return items.filter((item) => !memberships.get(item.libraryItemId)?.size);
}

// Initial server render before the bucket hydrates; snapshots include off-preview members.
export function selectUncollectedBooks<T extends { libraryItemId: string }>(
  books: T[],
  collections: LibraryCollection[],
) {
  const members = new Set(
    collections.flatMap((row) =>
      (row.completionItems ?? row.books).map((book) => book.libraryItemId),
    ),
  );
  return books.filter((book) => !members.has(book.libraryItemId));
}
