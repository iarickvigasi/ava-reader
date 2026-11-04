import { afterEach, expect, it, vi } from "vitest";
import { createProgressSync } from "./create-progress-sync";
const state = vi.hoisted(() => ({
  dirty: true,
  online: true,
  db: {},
  changed: (() => {}) as () => void,
  unsubscribe: vi.fn(),
}));
const flush = vi.hoisted(() => vi.fn());
vi.mock("../../db", () => ({ getDb: () => state.db }));
vi.mock("../../net/net-state", () => ({ isOnline: () => state.online }));
vi.mock("./storage", () => ({
  listDirtyProgress: async () => (state.dirty ? [{}] : []),
}));
vi.mock("./sync", () => ({ flushDirtyProgress: flush }));
vi.mock("dexie", () => ({
  liveQuery: () => ({
    subscribe: (observer: { next: (rows: unknown[]) => void }) => {
      state.changed = () => observer.next(state.dirty ? [{}] : []);
      return { unsubscribe: state.unsubscribe };
    },
  }),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.dirty = true;
  state.online = true;
});

it("retries a failed upload without another network event, and stops when clean", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("document", { visibilityState: "visible" });
  flush
    .mockResolvedValueOnce({ synced: 0 })
    .mockResolvedValueOnce({ synced: 0 })
    .mockImplementationOnce(async () => {
      state.dirty = false;
      return { synced: 1 };
    });
  const runner = createProgressSync(async () => "token");
  try {
    await runner.run();
    expect(flush).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(flush).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(flush).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(flush).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(flush).toHaveBeenCalledTimes(3);
  } finally {
    runner.stop();
  }
});

it("observes new dirty work and cancels scheduled retries on cleanup", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("document", { visibilityState: "visible" });
  flush.mockResolvedValue({ synced: 0 });
  const runner = createProgressSync(async () => "token");
  state.changed();
  runner.stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(flush).not.toHaveBeenCalled();
  expect(state.unsubscribe).toHaveBeenCalledOnce();
});
