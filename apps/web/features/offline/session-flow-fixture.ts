import { vi } from "vitest";
import { createReadingTracker } from "./buckets/sessions/tracker";
import { homeFixture } from "./buckets/home/test-fixture";

export function sessionFlowFixture() {
  const start = Date.parse("2026-11-03T12:00:00Z");
  let elapsed = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  vi.stubGlobal("navigator", { onLine: true });
  const tracker = createReadingTracker("book", {
    wallNow: () => start + elapsed,
    monotonicNow: () => elapsed,
  });
  return {
    tracker,
    async read(minutes: number) {
      for (let i = 0; i < minutes * 2; i++) {
        elapsed += 30_000;
        vi.setSystemTime(start + elapsed);
        await tracker.checkpoint();
      }
    },
    home(phoneId?: string, phoneSeconds = 0, readingRevision = 1) {
      const home = homeFixture();
      const sessionCoverage = [
        { clientSessionId: "laptop", durationSeconds: 600 },
      ];
      if (phoneId)
        sessionCoverage.push({
          clientSessionId: phoneId,
          durationSeconds: phoneSeconds,
        });
      home.readingSnapshot = {
        clientSessionIds: sessionCoverage.map((row) => row.clientSessionId),
        sessionCoverage,
        readingRevision,
        totalSeconds: 600 + phoneSeconds,
        days: [{ key: "2026-11-03", seconds: 600 + phoneSeconds }],
      };
      return home;
    },
  };
}
