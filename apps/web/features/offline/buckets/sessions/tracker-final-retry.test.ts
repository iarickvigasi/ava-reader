import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import * as retry from "../shared/bucket-core";
import { getDb } from "../../db";
import { recoverSessions } from "./recover-sessions";
import { fakeSessionLocks } from "./fake-session-locks";
import { trackerFixture } from "./tracker-test-fixture";

it.each([false, true])(
  "retries the frozen stop without hidden-time credit (Web Locks: %s)",
  async (webLocks) => {
    if (webLocks) fakeSessionLocks();
    const f = trackerFixture();
    await f.tracker.start();
    f.advance(30_000);
    await f.tracker.checkpoint();
    f.advance(17_000);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let failed!: () => void;
      const failure = new Promise<void>((resolve) => {
        failed = resolve;
      });
      const schedule = retry.scheduleRetry;
      vi.spyOn(retry, "scheduleRetry").mockImplementationOnce((state, run) => {
        schedule(state, run);
        failed();
      });
      vi.spyOn(getDb().sessions, "put").mockRejectedValueOnce(
        new Error("temporary storage failure"),
      );
      const stopped = f.tracker.stop();
      await failure;
      f.advance(120_000);
      if (webLocks) {
        await recoverSessions(getDb(), f.clock.wallNow());
        expect((await f.rows())[0].state).toBe("open");
      }
      await vi.advanceTimersByTimeAsync(1_000);
      await stopped;
      const [row] = await f.rows();
      expect(row.state).toBe("closed");
      expect(Date.parse(row.endedAt!) - Date.parse(row.startedAt)).toBe(47_000);
      expect(row.revision).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  },
);
