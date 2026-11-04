import { getDb } from "@/features/offline/db";
import { listPendingSessions } from "@/features/offline/buckets/sessions";

export async function hasPendingChanges() {
  const db = getDb();
  const counts = await Promise.all([
    db.highlightMutations.count(),
    db.aiCommentMutations.count(),
    db.preferenceMutations.count(),
    db.collectionMembershipMutations.count(),
    db.finishDateMutations.count(),
    db.preferences.filter((row) => row.dirtyFields.length > 0).count(),
    db.progress.filter((row) => row.dirty).count(),
    listPendingSessions(db).then((rows) => rows.length),
  ]);
  return counts.some(Boolean);
}
