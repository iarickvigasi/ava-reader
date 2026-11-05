import type { Table } from "dexie";
import { sessionSyncState } from "./session-sync-state";
import type { SessionRow } from "./types";

export function registerSessionSyncIndex(table: Table<SessionRow, string>) {
  table.hook("creating", (_key, row) => {
    row.syncState = sessionSyncState(row);
  });
  table.hook("updating", (changes, _key, row) => ({
    syncState: sessionSyncState({ ...row, ...changes }),
  }));
}
