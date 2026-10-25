import { getDb } from "../../../db";

const CATALOG_KEY = "library:activeBookIds";

export async function writeCatalogIds(ids: string[]): Promise<void> {
  await getDb().meta.put({
    key: CATALOG_KEY,
    value: ids,
    updatedAt: new Date().toISOString(),
  });
}

export async function readCatalogIds(): Promise<string[] | undefined> {
  return (await getDb().meta.get(CATALOG_KEY))?.value as string[] | undefined;
}
