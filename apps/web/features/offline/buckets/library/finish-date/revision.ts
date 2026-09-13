import type { AvaReaderDB } from "../../../db";

const KEY = "finish-date-revision";

export async function readFinishDateRevision(db: AvaReaderDB): Promise<string | null> {
  const row = await db.meta.get(KEY);
  return typeof row?.value === "string" ? row.value : null;
}

// Written with each mutation/ack in the same transaction. Unlike a module
// counter, this also invalidates a GET that started in a different tab.
export async function writeFinishDateRevision(db: AvaReaderDB): Promise<void> {
  await db.meta.put({ key: KEY, value: crypto.randomUUID(), updatedAt: new Date().toISOString() });
}
