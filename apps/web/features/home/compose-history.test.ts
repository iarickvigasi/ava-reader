import { describe, expect, it } from "vitest";
import type { SessionRow } from "@/features/offline/db";
import { readingSession } from "@/features/offline/buckets/home/reading-test-fixture";
import { composeHistory } from "./compose-history";

const page = {
  days: [
    { key: "2026-09-01", seconds: 40 },
    { key: "2026-09-02", seconds: 0 },
  ],
  clientSessionIds: ["covered"],
  nextBefore: null,
};
function session(id: string, extra: Partial<SessionRow> = {}): SessionRow {
  return {
    ...readingSession,
    clientSessionId: id,
    state: "closed",
    startedAt: "2026-09-01T23:59:30Z",
    endedAt: "2026-09-02T00:00:30Z",
    lastHeartbeatAt: "2026-09-02T00:00:30Z",
    ...extra,
  };
}
describe("history reconciliation", () => {
  it("adds uncovered sessions across midnight before rounding", () => {
    expect(composeHistory(page, [session("new")], 1)).toEqual([
      { key: "2026-09-01", minutes: 1, goalMet: true },
      { key: "2026-09-02", minutes: 0, goalMet: false },
    ]);
  });
  it("retains acknowledged time until its snapshot includes it", () => {
    const row = session("new", {
      acknowledgedRevision: 1,
    });
    expect(composeHistory(page, [row], 1)[0].minutes).toBe(1);
    expect(
      composeHistory(
        {
          ...page,
          clientSessionIds: ["new"],
          days: [{ key: "2026-09-01", seconds: 70 }],
        },
        [row],
        1,
      )[0].minutes,
    ).toBe(1);
  });
  it("excludes covered and dropped sessions and responds to goal changes", () => {
    const rows = [session("covered"), session("dropped", { dropped: true })];
    expect(composeHistory(page, rows, 1)[0].minutes).toBe(0);
    expect(composeHistory(page, [session("new")], 2)[0].goalMet).toBe(false);
  });
});
