import type { AvaReaderDB } from "../../../db";
import type { LinkState } from "./types";
import { linkKey } from "./id";
export async function readLinks(db: AvaReaderDB) {
  const rows = await db.meta.where("key").startsWith("catalog-link:").toArray();
  return rows.map(
    (row) =>
      [row.key.slice("catalog-link:".length), row.value as LinkState] as const,
  );
}
export async function writeLink(db: AvaReaderDB, id: string, state: LinkState) {
  await db.meta.put({
    key: linkKey(id),
    value: state,
    updatedAt: new Date().toISOString(),
  });
}
