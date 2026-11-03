import { retainNewerReading } from "./retain-newer-reading";
import type { HomePayload } from "@/lib/api-types/home";
import { getDb, type AvaReaderDB } from "../../db";
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
    await persistHomeSnapshot(db, payload, options);
  });
}

export async function clearHome(): Promise<void> {
  const db = getDb();
  await db.home.clear();
}

async function persistHomeSnapshot(
  db: AvaReaderDB,
  payload: HomePayload,
  options: CompletionWriteOptions,
) {
  if (!(await canApplyHome(db, options))) return;
  const prior = await db.home.get("me");
  if (options.seedOnly && prior) return;
  await db.home.put({
    id: "me",
    payload: retainNewerReading(payload, prior?.payload),
    fetchedAt: new Date().toISOString(),
    // An RSC/cache-loader payload has no trustworthy local request revision.
    completionRevision: options.expectedCompletionRevision ?? 0,
  });
}

async function canApplyHome(db: AvaReaderDB, options: CompletionWriteOptions) {
  if (db !== getDb()) return false;
  return (
    options.expectedCompletionRevision === undefined ||
    options.expectedCompletionRevision === (await readCompletionRevision(db))
  );
}
