import { getDb } from "@/features/offline/db";

const PREFIX = "catalog:public:";
const MAX_ENTRIES = 40;

export async function readCatalogCache<T>(path: string): Promise<T | null> {
  try {
    return ((await getDb().meta.get(`${PREFIX}${path}`))?.value as T) ?? null;
  } catch {
    return null;
  }
}

export async function writeCatalogCache(path: string, value: unknown) {
  if (JSON.stringify(value).length > 512_000) return;
  const db = getDb();
  await db
    .transaction("rw", db.meta, async () => {
      await db.meta.put({
        key: `${PREFIX}${path}`,
        value,
        updatedAt: new Date().toISOString(),
      });
      const rows = await db.meta.where("key").startsWith(PREFIX).toArray();
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      await db.meta.bulkDelete(rows.slice(MAX_ENTRIES).map((row) => row.key));
    })
    .catch(() => undefined);
}
