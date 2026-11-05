import { getDb, type AvaReaderDB } from "../../db";
import type { SessionRow } from "./types";

export async function updateSession(
  db: AvaReaderDB,
  id: string,
  change: (row: SessionRow) => SessionRow,
): Promise<void> {
  if (db !== getDb()) return;
  await db.transaction("rw", db.sessions, async () => {
    if (db !== getDb()) return;
    const row = await db.sessions.get(id);
    if (row) await db.sessions.put(change(row));
  });
}
