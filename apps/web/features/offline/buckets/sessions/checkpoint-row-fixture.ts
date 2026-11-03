import type { SessionRow } from "./types";

export function checkpointRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    clientSessionId: "session",
    libraryItemId: "book",
    trackingVersion: 2,
    revision: 2,
    acknowledgedRevision: 0,
    startedAt: "2026-11-03T10:00:00.000Z",
    lastHeartbeatAt: "2026-11-03T10:01:00.000Z",
    endedAt: "2026-11-03T10:01:00.000Z",
    state: "closed",
    timeZone: "UTC",
    ...overrides,
  };
}
