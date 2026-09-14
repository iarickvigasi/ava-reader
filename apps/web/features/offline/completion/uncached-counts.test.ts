import { expect, it } from "vitest";
import { composeCompletedCount, type CompletionContext } from "./counts";

const existing = [{ libraryItemId: "remote-book", finishedAt: null, completionPercent: 100 }];
const timestamp = "2026-09-14T12:00:00.000Z";
const emptyContext = (): CompletionContext => ({
  items: new Map(), dates: new Map(), progress: new Map(), memberships: new Map(), changes: new Map(),
});

it("includes newly dirty 100% progress absent from both the old home snapshot and library previews", () => {
  const context = emptyContext();
  context.progress.set("new-book", {
    libraryItemId: "new-book", completionPercent: 100, dirty: true,
    locator: { chapterId: "last", blockId: "last", textOffset: 0 },
    lastReadAt: null, lastLocalUpdateAt: timestamp, lastServerUpdateAt: null,
  });
  expect(context.items.size).toBe(0);
  expect(composeCompletedCount(existing, 0, context)).toBe(2);
});

it("retains an acknowledged completion with no library row until the old home snapshot refreshes", () => {
  const context = emptyContext();
  context.changes.set("new-book", {
    libraryItemId: "new-book", completionPercent: { value: 100, revision: 4 },
  });
  expect(context.items.size).toBe(0);
  expect(composeCompletedCount(existing, 0, context)).toBe(2);
  // A complete newer snapshot can prove that the item no longer contributes.
  expect(composeCompletedCount(existing, 4, context)).toBe(1);
});
