import { afterEach, expect, it, vi } from "vitest";
import { AUTH_TIMEOUT_MS } from "@/features/auth/with-deadline";

const f = vi.hoisted(() => {
  const createDb = () => ({
    highlightMutations: { toArray: vi.fn(async () => []) },
    aiCommentMutations: { toArray: vi.fn(async () => []) },
  });
  const a = createDb(),
    b = createDb();
  return { a, b, active: a, flush: vi.fn(async () => {}) };
});
vi.mock("./db", () => ({ getDb: () => f.active }));
vi.mock("./net/net-state", () => ({ isOnline: () => true }));
vi.mock("./buckets/highlights", () => ({}));
vi.mock("./buckets/ai-comments", () => ({}));
vi.mock("./buckets/library", () => ({
  flushCollectionMemberships: f.flush,
  flushFinishDates: async () => {},
  flushCatalogLinks: async () => {},
}));
vi.mock("./buckets/sessions", () => ({ syncPendingSessions: async () => {} }));
vi.mock("./buckets/progress", () => ({ flushDirtyProgress: async () => {} }));
vi.mock("./buckets/preferences", () => ({ flushPreferences: async () => {} }));
import { resumePendingWork } from "./resume-pending-work";

afterEach(() => {
  f.active = f.a;
  vi.clearAllMocks();
  vi.useRealTimers();
});

it("lets another account resume while the previous token request is stalled", async () => {
  let finish!: (token: string) => void;
  const old = resumePendingWork(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  f.active = f.b;
  await resumePendingWork(async () => "b-token");
  expect(f.b.highlightMutations.toArray).toHaveBeenCalledOnce();
  finish("a-token");
  await old;
  expect(f.a.highlightMutations.toArray).not.toHaveBeenCalled();
  expect(f.flush).toHaveBeenCalledOnce();
});

it("releases a timed-out token request so the same account can retry", async () => {
  vi.useFakeTimers();
  const failed = resumePendingWork(() => new Promise(() => {})).catch(
    () => "timeout",
  );
  await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS);
  expect(await failed).toBe("timeout");
  await resumePendingWork(async () => "token");
  expect(f.flush).toHaveBeenCalledOnce();
});

it("releases the resume lock when a downstream queue never settles", async () => {
  vi.useFakeTimers();
  f.flush.mockImplementationOnce(() => new Promise(() => {}));
  const failed = resumePendingWork(async () => "token").catch(() => "timeout");
  await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS);
  expect(await failed).toBe("timeout");
  await resumePendingWork(async () => "token");
  expect(f.flush).toHaveBeenCalledTimes(2);
});
