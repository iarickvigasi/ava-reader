import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb } from "../../db";
import {
  isLibraryItemDeleted,
  writeUnlessDeleted,
} from "../library/deleted-items";
import { ownedCoverItemId } from "./owned-cover-url";
import { readCoverResponse } from "./read-cover-response";
export async function loadOwnedCover(input: {
  libraryItemId: string;
  src: string;
  getToken: () => Promise<string | null>;
  signal: AbortSignal;
}): Promise<Blob> {
  const db = getDb(),
    id = input.libraryItemId;
  const fresh = async () => {
    if (
      db !== getDb() ||
      input.signal.aborted ||
      (await isLibraryItemDeleted(db, id))
    )
      throw new Error("COVER_UNAVAILABLE");
  };
  if (ownedCoverItemId(input.src) !== id) throw new Error("COVER_UNAVAILABLE");
  await fresh();
  const cached = (await db.libraryItems.get(id))?.coverBlob;
  await fresh();
  if (cached) return cached;
  const token = await input.getToken();
  await fresh();
  if (!token) throw new Error("COVER_UNAVAILABLE");
  const response = await fetch(new URL(input.src, getPublicApiBaseUrl()), {
    headers: { Authorization: `Bearer ${token}` },
    signal: input.signal,
    redirect: "error",
    cache: "no-store",
    credentials: "omit",
  });
  const blob = await readCoverResponse(response);
  await fresh();
  await writeUnlessDeleted(db, id, [db.libraryItems], () =>
    db.libraryItems.update(id, { coverBlob: blob }),
  );
  await fresh();
  return blob;
}
