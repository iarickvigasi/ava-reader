import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  highlights: { setBucketAuth: vi.fn(), flushBucket: vi.fn(async () => {}) },
  comments: { setBucketAuth: vi.fn(), flushBucket: vi.fn(async () => {}) },
  sessions: vi.fn(async () => {}),
  memberships: vi.fn(async () => {}),
  finishes: vi.fn(async () => {}),
  db: {
    highlightMutations: {
      toArray: vi.fn(async () => [
        { scopeId: "book-a" },
        { scopeId: "book-a" },
      ]),
    },
    aiCommentMutations: { toArray: vi.fn(async () => [{ scopeId: "book-b" }]) },
  },
}));
vi.mock("./db", () => ({ getDb: () => mocks.db }));
vi.mock("./buckets/highlights", () => mocks.highlights);
vi.mock("./buckets/ai-comments", () => mocks.comments);
vi.mock("./buckets/library", () => ({
  flushCollectionMemberships: mocks.memberships,
  flushFinishDates: mocks.finishes,
}));
vi.mock("./buckets/sessions", () => ({ syncPendingSessions: mocks.sessions }));
vi.mock("@/components/app/reader/data/reader-client-instance-id", () => ({
  getOrCreateReaderClientInstanceId: () => "tab",
}));
vi.mock("./buckets/progress", () => ({
  flushDirtyProgress: vi.fn(async () => {}),
}));
vi.mock("./buckets/preferences", () => ({
  flushPreferences: vi.fn(async () => {}),
}));
import { resumePendingWork } from "./resume-pending-work";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", { onLine: true });
});
it("retains queues when authentication is unavailable", async () => {
  await resumePendingWork(async () => null);
  expect(mocks.db.highlightMutations.toArray).not.toHaveBeenCalled();
  expect(mocks.sessions).not.toHaveBeenCalled();
});
it("resumes every queued book without reopening it and deduplicates concurrent triggers", async () => {
  const token = vi.fn(async () => "token");
  await Promise.all([resumePendingWork(token), resumePendingWork(token)]);
  expect(mocks.highlights.setBucketAuth).toHaveBeenCalledExactlyOnceWith(
    "book-a",
    expect.any(String),
    token,
  );
  expect(mocks.comments.setBucketAuth).toHaveBeenCalledExactlyOnceWith(
    "book-b",
    expect.any(String),
    token,
  );
  expect(mocks.highlights.flushBucket).toHaveBeenCalledOnce();
  expect(mocks.sessions).toHaveBeenCalledExactlyOnceWith(token, "tab");
});
