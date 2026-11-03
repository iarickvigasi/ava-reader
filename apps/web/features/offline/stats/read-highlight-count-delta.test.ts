import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { __resetDbForTests, getDb } from "../db";
import { readHighlightCountDelta } from "./read-highlight-count-delta";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it.each([
  ["upsert", false, 1],
  ["upsert", true, 0],
  ["delete", false, 0],
  ["delete", true, -1],
] as const)(
  "counts %s with existing=%s as %s",
  async (kind, exists, expected) => {
    const db = getDb();
    if (exists) {
      await db.highlights.put({
        libraryItemId: "book",
        id: "highlight",
        excerpt: "original",
        color: "apricot",
        locator: null,
        createdAt: "2026-04-12T10:00:00Z",
        updatedAt: "2026-04-12T10:00:00Z",
      });
    }
    await db.highlightMutations.put({
      mutationId: "mutation",
      scopeId: "book",
      kind,
      highlightId: "highlight",
      payload:
        kind === "upsert"
          ? { excerpt: "edited", highlightColor: "jade", locator: null }
          : null,
      queuedAt: "2026-04-12T11:00:00Z",
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    expect(await readHighlightCountDelta()).toBe(expected);
  },
);

it("keeps the server count when no mutations are pending", async () => {
  expect(await readHighlightCountDelta()).toBe(0);
});
