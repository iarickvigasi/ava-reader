import type { SessionRow } from "../db";
import { homeFixture } from "../buckets/home/test-fixture";

export function checkpointSession(minutes: number): SessionRow {
  return {
    clientSessionId: "phone",
    libraryItemId: "book",
    trackingVersion: 2,
    revision: minutes,
    acknowledgedRevision: 5,
    startedAt: "2026-11-03T10:00:00Z",
    timeZone: "UTC",
    lastHeartbeatAt: new Date(
      Date.parse("2026-11-03T10:00:00Z") + minutes * 60000,
    ).toISOString(),
    endedAt: null,
    state: "open",
  };
}

export function checkpointHome(coveredSeconds: number, readingRevision = 1) {
  const home = homeFixture();
  home.readingSnapshot = {
    readingRevision,
    clientSessionIds: ["laptop", ...(coveredSeconds ? ["phone"] : [])],
    sessionCoverage: [
      { clientSessionId: "phone", durationSeconds: coveredSeconds },
    ],
    totalSeconds: 600 + coveredSeconds,
    days: [{ key: "2026-11-03", seconds: 600 + coveredSeconds }],
  };
  return home;
}
