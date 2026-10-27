import { getDb } from "../../db";

const pending = new WeakMap<object, Map<string, Promise<void>>>();

export async function cacheDeveloperAvatar(
  id: string,
  url: string,
): Promise<void> {
  const db = getDb();
  const key = `developer-avatar:${id}`;
  let requests = pending.get(db);
  if (!requests) pending.set(db, (requests = new Map()));
  const requestKey = `${id}:${url}`;
  if (requests.has(requestKey)) return requests.get(requestKey);
  const request = download();
  requests.set(requestKey, request);
  await request;
  requests.delete(requestKey);

  async function download() {
    try {
      const existing = await db.meta.get(key);
      if ((existing?.value as { url?: string })?.url === url) return;
      const response = await fetch(url);
      if (!response.ok) return;
      const blob = await response.blob();
      if (!blob.size || db !== getDb()) return;
      await db.meta.put({
        key,
        value: { url, blob },
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // The next mount or reconnect retries a missing photo.
    }
  }
}
