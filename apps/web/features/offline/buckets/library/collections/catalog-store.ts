import { getDb } from "../../../db";

const CATALOG_KEY = "library:activeBookIds";
const REVISION_KEY = "library:catalogCompletionRevision";

export async function writeCatalogIds(
  ids: string[],
  revision = 0,
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await getDb().meta.bulkPut([
    { key: CATALOG_KEY, value: ids, updatedAt },
    { key: REVISION_KEY, value: revision, updatedAt },
  ]);
}

export async function readCatalogIds(): Promise<string[] | undefined> {
  return (await getDb().meta.get(CATALOG_KEY))?.value as string[] | undefined;
}

export async function readCatalogRevision(): Promise<number> {
  return (
    ((await getDb().meta.get(REVISION_KEY))?.value as number | undefined) ?? 0
  );
}
