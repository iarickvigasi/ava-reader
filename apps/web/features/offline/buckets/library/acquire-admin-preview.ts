import { catalogReadOperation } from "./catalog-read-operation";
import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb } from "../../db";
import { revalidateBookInfo, revalidateLibrary } from "./revalidate";

export async function acquireAdminPreview(
  identity: { editionId: string; checksum: string },
  getToken: () => Promise<string | null>,
  signal?: AbortSignal,
) {
  return catalogReadOperation(async (operation) => {
    const db = getDb();
    const token = await getToken();
    operation.throwIfAborted();
    if (!token || db !== getDb()) throw new Error("Authentication required");
    const response = await fetch(
      `${getPublicApiBaseUrl()}/api/admin/reading-reviews/preview`,
      {
        method: "POST",
        signal: operation,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(identity),
      },
    );
    if (!response.ok) throw new Error("This book is not ready for preview");
    const target = (await response.json()) as {
      libraryItemId: string;
      slug: string;
    };
    operation.throwIfAborted();
    if (db !== getDb()) throw new Error("Account changed");
    await revalidateBookInfo(target.libraryItemId, getToken);
    operation.throwIfAborted();
    if (db !== getDb() || !(await db.libraryItems.get(target.libraryItemId)))
      throw new Error("Preview unavailable");
    void revalidateLibrary(getToken).catch(() => undefined);
    return target;
  }, signal);
}
