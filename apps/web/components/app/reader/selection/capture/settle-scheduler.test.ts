import { describe, expect, it } from "vitest";
import { createSettleScheduler } from "./settle-scheduler";

// A deterministic stand-in for the window timer API: setTimeout records the
// callback and returns an incrementing id; flush() fires everything still
// pending. This lets us assert the single-slot behaviour without real timers.
function createFakeWindow() {
  let nextId = 1;
  const pending = new Map<number, () => void>();

  const win = {
    setTimeout: ((run: () => void) => {
      const id = nextId++;
      pending.set(id, run);
      return id;
    }) as Window["setTimeout"],
    clearTimeout: ((id?: number) => {
      if (id !== undefined) {
        pending.delete(id);
      }
    }) as Window["clearTimeout"],
  } as Window;

  return {
    win,
    pendingCount: () => pending.size,
    flush() {
      const runs = [...pending.values()];
      pending.clear();
      for (const run of runs) {
        run();
      }
    },
  };
}

describe("createSettleScheduler", () => {
  it("runs the scheduled callback once flushed", () => {
    const fake = createFakeWindow();
    const scheduler = createSettleScheduler(fake.win);
    let runs = 0;

    scheduler.schedule(0, () => {
      runs += 1;
    });
    expect(runs).toBe(0);

    fake.flush();
    expect(runs).toBe(1);
  });

  it("keeps only the most recently scheduled run", () => {
    const fake = createFakeWindow();
    const scheduler = createSettleScheduler(fake.win);
    const order: string[] = [];

    scheduler.schedule(80, () => order.push("first"));
    scheduler.schedule(80, () => order.push("second"));

    // The first timer was cleared, so exactly one run is pending.
    expect(fake.pendingCount()).toBe(1);
    fake.flush();
    expect(order).toEqual(["second"]);
  });

  it("cancel() prevents a pending run", () => {
    const fake = createFakeWindow();
    const scheduler = createSettleScheduler(fake.win);
    let runs = 0;

    scheduler.schedule(0, () => {
      runs += 1;
    });
    scheduler.cancel();

    expect(fake.pendingCount()).toBe(0);
    fake.flush();
    expect(runs).toBe(0);
  });

  it("can schedule again after a run fires", () => {
    const fake = createFakeWindow();
    const scheduler = createSettleScheduler(fake.win);
    let runs = 0;
    const run = () => {
      runs += 1;
    };

    scheduler.schedule(0, run);
    fake.flush();
    scheduler.schedule(0, run);
    fake.flush();

    expect(runs).toBe(2);
  });

  it("cancel() is a no-op when nothing is scheduled", () => {
    const fake = createFakeWindow();
    const scheduler = createSettleScheduler(fake.win);

    expect(() => scheduler.cancel()).not.toThrow();
  });
});
