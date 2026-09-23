import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb } from "../../db";
import { abortSaveAndWait, setStatus } from "../book/bucket";
import { revalidateHome } from "../home/revalidate";
import { refreshFromDb } from "./bucket";
import { removeCachedLibraryItems } from "./remove-cached-items";
import { revalidateLibrary } from "./revalidate";

export async function deleteBook(libraryItemId: string, getToken: () => Promise<string | null>) {
  const db = getDb();
  const token = await getToken();
  if (!token || db !== getDb()) throw new Error("Authentication required");
  const response = await fetch(`${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(libraryItemId)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) throw new Error("Deletion failed");
  if (db !== getDb()) throw new Error("Account changed");
  await removeCachedLibraryItems([libraryItemId], db);
  await abortSaveAndWait(libraryItemId);
  setStatus(libraryItemId, { status: "missing", currentChapters: 0, totalChapters: 0 });
  await refreshFromDb();
  await revalidateLibrary(getToken);
  await revalidateHome(getToken);
}
