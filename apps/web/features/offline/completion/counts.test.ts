import { describe, expect, it } from "vitest";
import type { CompletionItem, LibraryCollection } from "@/lib/api-types/library";
import type { LibraryItemRow, ProgressRow } from "../db";
import { bookToItemRow } from "../buckets/library/collections/payload-rows";
import { payload } from "../buckets/library/test-fixture";
import { composeCollectionCounts, composeCompletedCount, effectiveCompletion, isFinished,
  type CompletionContext } from "./counts";

const date = "2026-09-14T12:00:00.000Z";

function item(id: string, finishedAt: string | null = null, completionPercent = 40): CompletionItem {
  return { libraryItemId: id, finishedAt, completionPercent };
}
function context(): CompletionContext {
  return { items: new Map(), dates: new Map(), progress: new Map(), memberships: new Map(), changes: new Map() };
}
function row(id: string, finishedAt: string | null = null, completionPercent = 40): LibraryItemRow {
  return bookToItemRow({ ...payload().collections[0].books[0], ...item(id, finishedAt, completionPercent) }, date);
}
function pendingDate(ctx: CompletionContext, id: string, finishedAt: string | null) {
  ctx.dates.set(id, { libraryItemId: id, finishedAt, queuedAt: date, revision: "pending" });
}
function dirtyProgress(id: string, completionPercent: number): ProgressRow {
  return { libraryItemId: id, completionPercent, locator: { chapterId: "chapter-1", blockId: "paragraph-1", textOffset: 0 },
    lastReadAt: date, lastLocalUpdateAt: date, lastServerUpdateAt: null, dirty: true };
}
function collection(items: CompletionItem[], overrides: Partial<LibraryCollection> = {}) {
  return { ...payload().collections[0], itemCount: items.length,
    unreadCount: items.filter((entry) => !isFinished(entry)).length, completionItems: items, ...overrides };
}

describe("completion status", () => {
  it.each([
    { finishedAt: null, completionPercent: 0, expected: false },
    { finishedAt: null, completionPercent: 99, expected: false },
    { finishedAt: null, completionPercent: 100, expected: true },
    { finishedAt: date, completionPercent: 0, expected: true },
    { finishedAt: date, completionPercent: 100, expected: true },
    { finishedAt: undefined, completionPercent: 100, expected: true },
  ])("uses finish date OR progress for $finishedAt / $completionPercent", ({ expected, ...value }) => {
    expect(isFinished(value)).toBe(expected);
  });

  it.each([40, 100])("a queued clear preserves the independent %s percent status", (completionPercent) => {
    const ctx = context();
    const baseline = item("book", date, completionPercent);
    pendingDate(ctx, "book", null);
    expect(effectiveCompletion(baseline, 0, ctx)).toEqual({ ...baseline, finishedAt: null });
    expect(composeCompletedCount([baseline], 0, ctx)).toBe(completionPercent === 100 ? 1 : 0);
    expect(composeCollectionCounts(collection([baseline]), ctx).unreadCount).toBe(completionPercent === 100 ? 0 : 1);
  });

  it("layers dirty progress over a finish-date acknowledgment without freezing either field", () => {
    const ctx = context();
    ctx.changes.set("book", { libraryItemId: "book", finishedAt: { value: date, revision: 3 } });
    ctx.progress.set("book", dirtyProgress("book", 100));
    pendingDate(ctx, "book", null);
    expect(effectiveCompletion(item("book"), 0, ctx)).toEqual(item("book", null, 100));
    expect(composeCompletedCount([item("book")], 0, ctx)).toBe(1);
  });

  it("retires acknowledged fields independently at each snapshot revision", () => {
    const ctx = context();
    ctx.changes.set("book", { libraryItemId: "book",
      finishedAt: { value: date, revision: 2 }, completionPercent: { value: 100, revision: 4 } });
    expect(effectiveCompletion(item("book"), 2, ctx)).toEqual(item("book", null, 100));
    expect(effectiveCompletion(item("book", null, 80), 4, ctx)).toEqual(item("book", null, 80));
  });
});

describe("whole-snapshot counts", () => {
  it("counts members outside collection previews and cached detail rows", () => {
    const ctx = context();
    ctx.items.set("preview", row("preview"));
    const entries = [item("preview"), item("not-preview", date), item("not-cached", null, 100)];
    expect(composeCollectionCounts(collection(entries), ctx)).toEqual({ itemCount: 3, unreadCount: 1 });
    pendingDate(ctx, "not-preview", null);
    expect(composeCollectionCounts(collection(entries), ctx)).toEqual({ itemCount: 3, unreadCount: 2 });
  });

  it("preserves archived home snapshot books when the device caches only one active book", () => {
    const ctx = context();
    ctx.items.set("active", row("active"));
    const entries = [item("archived-date", date), item("archived-progress", null, 100), item("active")];
    expect(composeCompletedCount(entries, 0, ctx)).toBe(2);
    pendingDate(ctx, "active", date);
    expect(composeCompletedCount(entries, 0, ctx)).toBe(3);
  });

  it("adds a newly cached local completion without replacing the rest of the home snapshot", () => {
    const ctx = context();
    ctx.items.set("new", row("new"));
    pendingDate(ctx, "new", date);
    expect(composeCompletedCount([item("archived", date)], 0, ctx)).toBe(2);
  });

  it("keeps an acknowledgment on collection B after collection A refreshes", () => {
    const ctx = context();
    ctx.changes.set("shared", { libraryItemId: "shared", finishedAt: { value: date, revision: 3 } });
    const refreshedA = { ...collection([item("shared", date)], { id: "a" }), completionRevision: 3 };
    const staleB = { ...collection([item("shared")], { id: "b" }), completionRevision: 0 };
    expect(composeCollectionCounts(refreshedA, ctx)).toEqual({ itemCount: 1, unreadCount: 0 });
    expect(composeCollectionCounts(staleB, ctx)).toEqual({ itemCount: 1, unreadCount: 0 });
  });

  it("finishes then removes the same member without subtracting unread status twice", () => {
    const ctx = context();
    ctx.items.set("removed", row("removed"));
    pendingDate(ctx, "removed", date);
    const shelf = collection([item("removed"), item("remaining")]);
    ctx.memberships.set("removed", { libraryItemId: "removed", revision: "membership", queuedAt: date,
      changes: [{ collectionId: shelf.id, baselineMember: true, member: false }] });
    expect(composeCollectionCounts(shelf, ctx)).toEqual({ itemCount: 1, unreadCount: 1 });
  });

  it.each([false, true])("keeps offline unread count correct when finished membership becomes %s", (keep) => {
    const ctx = context();
    ctx.items.set("finished", { ...row("finished", date), offlineRequested: keep, offlineRequestedDirty: true });
    const entries = keep ? [item("unread")] : [item("unread"), item("finished", date)];
    const shelf = collection(entries, { kind: "SMART", smartKey: "offline-books" });
    expect(composeCollectionCounts(shelf, ctx)).toEqual({ itemCount: keep ? 2 : 1, unreadCount: 1 });
  });

  it("counts an acknowledged offline keep as finished until that shelf refreshes", () => {
    const ctx = context();
    ctx.items.set("finished", row("finished", date));
    ctx.changes.set("finished", { libraryItemId: "finished", offlineRequested: { value: true, revision: 2 } });
    expect(composeCollectionCounts(collection([], { kind: "SMART", smartKey: "offline-books" }), ctx))
      .toEqual({ itemCount: 1, unreadCount: 0 });
  });
});
