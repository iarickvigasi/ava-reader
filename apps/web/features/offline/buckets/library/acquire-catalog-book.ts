import { catalogReadOperation } from "./catalog-read-operation";
import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb } from "../../db";
import { revalidateBookInfo, revalidateLibrary } from "./revalidate";
import { isLibraryItemDeleted } from "./deleted-items";

type ReadingTarget = { libraryItemId: string; slug: string };

export async function acquireCatalogBook(
  entryId: string,
  getToken: () => Promise<string | null>,
  signal?: AbortSignal,
): Promise<ReadingTarget> {
  return catalogReadOperation(
    (operation) => acquire(entryId, getToken, operation),
    signal,
  );
}

async function acquire(
  entryId: string,
  getToken: () => Promise<string | null>,
  signal: AbortSignal,
): Promise<ReadingTarget> {
  signal.throwIfAborted();
  const db = getDb();
  const key = `catalog-reading-copy:${entryId}`;
  const cached = (await db.meta.get(key))?.value as ReadingTarget | undefined;
  signal.throwIfAborted();
  if (db !== getDb()) throw new Error("Account changed");
  if (
    cached &&
    (await db.libraryItems.get(cached.libraryItemId)) &&
    !(await isLibraryItemDeleted(db, cached.libraryItemId))
  ) {
    signal.throwIfAborted();
    if (db !== getDb()) throw new Error("Account changed");
    return cached;
  }
  const token = await getToken();
  signal.throwIfAborted();
  if (!token || db !== getDb()) throw new Error("Authentication required");
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/catalog/${encodeURIComponent(entryId)}/add-to-library`,
    {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  signal.throwIfAborted();
  if (!response.ok) throw new Error("Book acquisition failed");
  const target = (await response.json()) as ReadingTarget;
  signal.throwIfAborted();
  if (db !== getDb()) throw new Error("Account changed");
  await revalidateBookInfo(target.libraryItemId, getToken);
  signal.throwIfAborted();
  if (
    db !== getDb() ||
    !(await db.libraryItems.get(target.libraryItemId)) ||
    (await isLibraryItemDeleted(db, target.libraryItemId))
  )
    throw new Error("Book unavailable");
  await db.meta.put({
    key,
    value: target,
    updatedAt: new Date().toISOString(),
  });
  signal.throwIfAborted();
  void revalidateLibrary(getToken).catch(() => undefined);
  return target;
}
