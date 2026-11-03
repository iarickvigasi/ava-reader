import type { AvaReaderDB } from "../../db";
import { acknowledgeCheckpoint } from "./acknowledge-checkpoint";
import { postCheckpoint } from "./post-checkpoint";
import { updateSession } from "./update-session";
import type { SessionRow } from "./types";

export async function syncSession(
  db: AvaReaderDB,
  token: string,
  row: SessionRow,
): Promise<"ok" | "retry" | "drop"> {
  const result = await postCheckpoint(token, row);
  if (result.kind === "ok") await acknowledgeCheckpoint(db, row, result.ack);
  if (result.kind === "drop")
    await updateSession(db, row.clientSessionId, (current) =>
      current.revision !== row.revision
        ? current
        : {
            ...current,
            dropped: true,
          },
    );
  return result.kind;
}
