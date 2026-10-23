import { getDb } from "../../../db";
import { isValidCover } from "./validate";

export async function readCoverBlob(
  libraryItemId: string,
): Promise<Blob | null> {
  const db = getDb();
  const row = await db.bookCovers.get(libraryItemId);
  if (!(await isValidCover(row)) || db !== getDb()) return null;
  return new Blob([row!.bytes], { type: row!.mimeType });
}
