// Orchestrates the per-user offline data lifecycle (adr/5, spec 4.7) across all
// three client substrates — the per-user Dexie DB, the service-worker caches,
// and global localStorage/cookies — plus the in-memory bucket registries.

import { clearAllAiCommentsBuckets } from "../buckets/ai-comments";
import { clearAllHighlightsBuckets } from "../buckets/highlights";
import { clearAllTranslationBuckets } from "../buckets/translations";
import {
  clearCollectionMembershipRuntime,
  clearFinishDateRuntime,
  clearLibraryBucket,
} from "../buckets/library";
import {
  clearActiveUser,
  deleteUserDb,
  purgeOtherUserDbs,
  setActiveUser,
} from "../db";
import { clearOfflineCaches } from "./clear-offline-caches";
import { clearUserScopedClientStorage } from "./user-storage";

// Sign-out: delete this user's database + all client substrates, then forget the
// user so the next getDb() falls back to the anonymous DB.
export async function wipeUserData(userId: string): Promise<void> {
  resetInMemoryBuckets();
  await deleteUserDb(userId);
  await clearOfflineCaches();
  clearUserScopedClientStorage();
  clearActiveUser();
}

// A different user resolved (account switch, or cold start as another user):
// adopt them and purge every other account's data from this profile.
export async function adoptUser(userId: string): Promise<void> {
  resetInMemoryBuckets();
  setActiveUser(userId);
  await purgeOtherUserDbs(userId);
  await clearOfflineCaches();
  clearUserScopedClientStorage();
}

// Drop in-memory bucket state (listeners + cached selectors) so the next user's
// session can't inherit the previous user's registries.
function resetInMemoryBuckets(): void {
  clearAllTranslationBuckets();
  clearCollectionMembershipRuntime();
  clearFinishDateRuntime();
  clearLibraryBucket();
  clearAllAiCommentsBuckets();
  clearAllHighlightsBuckets();
}
