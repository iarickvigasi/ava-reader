import { getDb } from "../../db";

const pending = new WeakMap<object, Map<string, Promise<void>>>();

export async function persistAvatarFromNetwork(
  avatarUrl: string,
): Promise<void> {
  const db = getDb();
  let requests = pending.get(db);
  if (!requests) pending.set(db, (requests = new Map()));
  if (requests.has(avatarUrl)) return requests.get(avatarUrl);
  const request = download();
  requests.set(avatarUrl, request);
  await request;
  requests.delete(avatarUrl);

  async function download() {
    try {
      const response = await fetch(avatarUrl);
      if (!response.ok) return;
      const avatarBlob = await response.blob();
      if (!avatarBlob.size || db !== getDb()) return;
      await db.transaction("rw", db.me, async () => {
        const row = await db.me.get("me");
        if (row?.user.avatarUrl !== avatarUrl) return;
        await db.me.update("me", { avatarBlob });
      });
    } catch {
      // Best effort: retry on the next mount or reconnect.
    }
  }
}
