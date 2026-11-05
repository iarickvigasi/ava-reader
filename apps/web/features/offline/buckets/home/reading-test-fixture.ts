import { vi } from "vitest";
import { getDb, type SessionRow } from "../../db";
import { applyHome } from "./storage";
import { homeFixture } from "./test-fixture";

export const readingSession: SessionRow = {
  trackingVersion: 2,
  revision: 1,
  acknowledgedRevision: 0,
  clientSessionId: "offline-session",
  libraryItemId: "book",
  startedAt: "2026-04-12T23:30:00Z",
  endedAt: "2026-04-13T00:30:00Z",
  lastHeartbeatAt: "2026-04-13T00:30:00Z",
  timeZone: "UTC",
  state: "closed",
};

export const readingAck = {
  sessionId: "server-session",
  revision: readingSession.revision,
  durationSeconds: 3600,
};

export function readingHome(included = false) {
  const home = homeFixture();
  home.stats.hoursReading = included ? 1 : 0;
  home.readingSnapshot = {
    readingRevision: included ? 1 : 0,
    clientSessionIds: included ? [readingSession.clientSessionId] : [],
    sessionCoverage: included
      ? [
          {
            clientSessionId: readingSession.clientSessionId,
            durationSeconds: 3600,
          },
        ]
      : [],
    totalSeconds: included ? 3600 : 0,
    days: included
      ? [
          { key: "2026-04-12", seconds: 1800 },
          { key: "2026-04-13", seconds: 1800 },
        ]
      : [],
  };
  return home;
}

export async function seedReading() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-04-13T12:00:00Z"));
  await applyHome(readingHome());
  await getDb().sessions.put(readingSession);
}
