import type { LibraryBookCollectionsInput } from "@/lib/api-types/library";
import { getDb } from "../../../db";
import { membershipRevision } from "./id";
import type { MembershipChange } from "./types";

// Baselines come from book details, never absence in a four-book preview.
export async function storeMembershipChanges(input: LibraryBookCollectionsInput) {
  const db = getDb();
  await db.transaction("rw", [db.libraryItems, db.collections, db.collectionMembership, db.collectionMembershipMutations], async () => {
    const book = await db.libraryItems.get(input.libraryItemId);
    if (!book?.details) throw new Error("Book details are unavailable.");
    const prior = await db.collectionMembershipMutations.get(input.libraryItemId);
    const changes = new Map(prior?.changes.map((change) => [change.collectionId, change]));
    const requested = new Map<string, boolean>([
      ...input.addCollectionIds.map((id) => [id, true] as const),
      ...input.removeCollectionIds.map((id) => [id, false] as const),
    ]);
    for (const [collectionId, member] of requested) {
      const collection = await db.collections.get(collectionId);
      if (collection?.kind !== "CUSTOM") throw new Error("Collection is unavailable.");
      const cachedLink = await db.collectionMembership.get([collectionId, book.libraryItemId]);
      const fresherCollection = (collection.serverUpdatedAt ?? "") >= (book.detailsFetchedAt ?? "");
      // A newer shelf can prove presence, or absence only when fully cached.
      // A missing book in a preview is never evidence of non-membership.
      const collectionKnows = fresherCollection && (cachedLink || collection.bookCount >= collection.itemCount);
      const baselineMember = changes.get(collectionId)?.baselineMember ??
        (collectionKnows ? Boolean(cachedLink) : book.details.collections.some((entry) => entry.id === collectionId));
      // Keep reversals even when they match baseline: an earlier request may
      // already be in flight and must be followed by this opposite intent.
      changes.set(collectionId, { collectionId, member, baselineMember } satisfies MembershipChange);
    }
    if (changes.size === 0) return;
    await db.collectionMembershipMutations.put({
      libraryItemId: input.libraryItemId,
      revision: membershipRevision(),
      queuedAt: prior?.queuedAt ?? new Date().toISOString(),
      changes: [...changes.values()],
    });
  });
}
