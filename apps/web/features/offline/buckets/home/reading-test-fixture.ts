import { vi } from "vitest";
import { getDb, type SessionRow } from "../../db";
import { applyHome } from "./storage";
import { homeFixture } from "./test-fixture";

export const readingSession: SessionRow = {
  clientSessionId: "offline-session",
  serverSessionId: null,
  libraryItemId: "book",
  startedAt: "2026-04-12T23:30:00Z",
  endedAt: "2026-04-13T00:30:00Z",
  lastHeartbeatAt: "2026-04-13T00:30:00Z",
  state: "closed",
  syncedAt: null,
};

export function readingHome(included = false) {
  const home = homeFixture();
  home.stats.hoursReading = included ? 1 : 0;
  home.readingSnapshot = {
    clientSessionIds: included ? [readingSession.clientSessionId] : [],
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
