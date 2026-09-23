export type SessionRow = {
  // Client-generated ULID. Stays stable across retries so the server can
  // upsert by it (API change in phase 4).
  clientSessionId: string;
  serverSessionId: string | null;
  libraryItemId: string;
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string;
  state: "open" | "closed";
  syncedAt: string | null;
  replayStatus?: "acknowledged" | "dropped";
};
