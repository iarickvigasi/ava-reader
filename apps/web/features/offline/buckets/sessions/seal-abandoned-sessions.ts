import type { AvaReaderDB } from "../../db";
import { sealSession } from "./seal-session";

// Called only inside a transaction after confirming the prior owner is gone.
export async function sealAbandonedSessions(db: AvaReaderDB) {
  const rows = await db.sessions.where("state").equals("open").toArray();
  for (const row of rows) await db.sessions.put(sealSession(row));
}
