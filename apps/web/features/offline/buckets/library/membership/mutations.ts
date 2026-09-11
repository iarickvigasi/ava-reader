import type { LibraryBookCollectionsInput } from "@/lib/api-types/library";
import { refreshFromDb } from "../bucket";
import { clearMembershipDrop, markMembershipChange } from "./bucket";
import { storeMembershipChanges } from "./storage";
import { flushCollectionMemberships } from "./sync";
import type { GetToken } from "./types";

export async function updateBookCollections(
  input: LibraryBookCollectionsInput,
  getToken: GetToken,
): Promise<void> {
  markMembershipChange();
  await storeMembershipChanges(input);
  clearMembershipDrop(input.libraryItemId);
  await refreshFromDb().catch(() => {});
  void flushCollectionMemberships(getToken).catch(() => {});
}
