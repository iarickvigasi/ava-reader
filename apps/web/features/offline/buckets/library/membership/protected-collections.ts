import { getDb } from "../../../db";

// Background previews cannot establish whether the server already counted a
// queued edit. Keep those shelf baselines until a full acknowledgment arrives.
export async function readProtectedCollections() {
  const db = getDb();
  const pending = await db.collectionMembershipMutations.toArray();
  const ids = new Set(pending.flatMap((row) => row.changes.map((change) => change.collectionId)));
  const rows = await db.collections.where("id").anyOf([...ids]).toArray();
  return { ids, rows };
}
