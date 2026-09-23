import type { HomePayload } from "@/lib/api-types/home";
import { getDb } from "../../db";
import {
  readCompletionRevision,
  type CompletionWriteOptions,
} from "../../completion/state";
export { readHome } from "./read-home";

export async function applyHome(
  payload: HomePayload,
  options: CompletionWriteOptions = {},
): Promise<void> {
  const db = options.db ?? getDb();
  if (db !== getDb()) return;
  await db.transaction("rw", [db.home, db.meta], async () => {
    if (db !== getDb()) return;
    if (
      options.expectedCompletionRevision !== undefined &&
      options.expectedCompletionRevision !== (await readCompletionRevision(db))
    )
      return;
    if (options.seedOnly && (await db.home.get("me"))) return;
    await db.home.put({
      id: "me",
      payload,
      fetchedAt: new Date().toISOString(),
      // An RSC/cache-loader payload has no trustworthy local request revision.
      completionRevision: options.expectedCompletionRevision ?? 0,
    });
  });
}

export async function clearHome(): Promise<void> {
  const db = getDb();
  await db.home.clear();
}
