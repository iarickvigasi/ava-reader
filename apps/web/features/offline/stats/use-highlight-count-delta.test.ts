import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb } from "../db";
import { useHighlightCountDelta } from "./use-highlight-count-delta";

const hooks = vi.hoisted(() => ({
  effect: undefined as (() => () => void) | undefined,
  setDelta: vi.fn(),
}));
vi.mock("react", () => ({
  useState: () => [0, hooks.setDelta],
  useEffect: (effect: typeof hooks.effect) => {
    hooks.effect = effect;
  },
}));
let unsubscribe: (() => void) | undefined;
afterEach(async () => {
  unsubscribe?.();
  await getDb().delete();
  __resetDbForTests();
  vi.clearAllMocks();
});

it("updates mounted counts as pending highlights and snapshots change", async () => {
  expect(useHighlightCountDelta()).toBe(0);
  unsubscribe = hooks.effect?.();
  await vi.waitFor(() => expect(hooks.setDelta).toHaveBeenLastCalledWith(0));
  const db = getDb();
  await db.highlightMutations.put({
    mutationId: "new",
    scopeId: "book",
    kind: "upsert",
    highlightId: "new",
    payload: { excerpt: "text", highlightColor: "jade", locator: null },
    queuedAt: "2026-04-12T11:00:00Z",
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
  });
  await vi.waitFor(() => expect(hooks.setDelta).toHaveBeenLastCalledWith(1));
  await db.highlights.put({
    libraryItemId: "book",
    id: "new",
    excerpt: "text",
    color: "jade",
    locator: null,
    createdAt: "2026-04-12T11:00:00Z",
    updatedAt: "2026-04-12T11:00:00Z",
  });
  await vi.waitFor(() => expect(hooks.setDelta).toHaveBeenLastCalledWith(0));
  await db.highlightMutations.update("new", { kind: "delete", payload: null });
  await vi.waitFor(() => expect(hooks.setDelta).toHaveBeenLastCalledWith(-1));
  await db.highlightMutations.clear();
  await vi.waitFor(() => expect(hooks.setDelta).toHaveBeenLastCalledWith(0));
});
