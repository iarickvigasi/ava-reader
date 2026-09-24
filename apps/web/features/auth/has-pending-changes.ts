import { getDb } from "@/features/offline/db";

export async function hasPendingChanges() {
  const db = getDb();
  const counts = await Promise.all([
    db.highlightMutations.count(),
    db.aiCommentMutations.count(),
    db.sessionMutations.count(),
    db.preferenceMutations.count(),
    db.collectionMembershipMutations.count(),
    db.finishDateMutations.count(),
    db.preferences.filter((row) => row.dirtyFields.length > 0).count(),
    db.progress.filter((row) => row.dirty).count(),
    db.sessions
      .filter((row) => !row.syncedAt && row.replayStatus !== "dropped")
      .count(),
  ]);
  return counts.some(Boolean);
}
