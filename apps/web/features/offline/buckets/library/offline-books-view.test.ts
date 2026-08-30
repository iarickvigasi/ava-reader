import { describe, expect, it } from "vitest";

import type { LibraryItemRow } from "../../db";

import {
  resolveOfflineCounts,
  selectOfflineBookRows,
} from "./offline-books-view";

function row(overrides: Partial<LibraryItemRow> = {}): LibraryItemRow {
  return {
    libraryItemId: "lib-1",
    slug: "book",
    title: "Book",
    authors: [],
    coverImageUrl: null,
    completionPercent: 0,
    primaryFormat: "EPUB",
    lastReadAt: null,
    coverBlob: null,
    savedOffline: false,
    savedAutomatically: false,
    savedAt: null,
    offlineRequested: false,
    offlineRequestedBaseline: false,
    serverUpdatedAt: null,
    ...overrides,
  };
}

const stored = { itemCount: 12, unreadCount: 7 };

describe("resolveOfflineCounts", () => {
  it("reports the server's whole-collection count, not the cached preview rows", () => {
    // Two of twelve books happen to be cached. Counting them would report 2.
    const cached = [
      row({ libraryItemId: "a", offlineRequested: true, offlineRequestedBaseline: true }),
      row({ libraryItemId: "b", offlineRequested: true, offlineRequestedBaseline: true }),
    ];

    expect(resolveOfflineCounts(stored, cached)).toEqual(stored);
  });

  it("adds a save the server hasn't seen yet", () => {
    const cached = [
      row({ offlineRequested: true, offlineRequestedBaseline: false }),
    ];

    expect(resolveOfflineCounts(stored, cached)).toEqual({
      itemCount: 13,
      unreadCount: 8,
    });
  });

  it("subtracts an un-save the server hasn't seen yet", () => {
    const cached = [
      row({ offlineRequested: false, offlineRequestedBaseline: true }),
    ];

    expect(resolveOfflineCounts(stored, cached)).toEqual({
      itemCount: 11,
      unreadCount: 6,
    });
  });

  it("leaves unreadCount alone when the toggled book is finished", () => {
    const cached = [
      row({
        completionPercent: 100,
        offlineRequested: true,
        offlineRequestedBaseline: false,
      }),
    ];

    expect(resolveOfflineCounts(stored, cached)).toEqual({
      itemCount: 13,
      unreadCount: 7,
    });
  });

  it("ignores rows cached before the baseline field existed", () => {
    const cached = [
      row({ offlineRequested: true, offlineRequestedBaseline: undefined }),
      row({ offlineRequested: false, offlineRequestedBaseline: undefined }),
    ];

    expect(resolveOfflineCounts(stored, cached)).toEqual(stored);
  });

  it("never reports a negative count when un-saves outrun a stale base", () => {
    const cached = [
      row({ libraryItemId: "a", offlineRequestedBaseline: true }),
      row({ libraryItemId: "b", offlineRequestedBaseline: true }),
    ];

    expect(
      resolveOfflineCounts({ itemCount: 1, unreadCount: 0 }, cached),
    ).toEqual({ itemCount: 0, unreadCount: 0 });
  });
});

describe("selectOfflineBookRows", () => {
  it("keeps only requested books, most recently engaged first", () => {
    const rows = [
      row({ libraryItemId: "old", offlineRequested: true, lastReadAt: "2026-01-01T00:00:00Z" }),
      row({ libraryItemId: "not-saved", offlineRequested: false }),
      row({ libraryItemId: "new", offlineRequested: true, lastReadAt: "2026-08-30T00:00:00Z" }),
      row({ libraryItemId: "never", offlineRequested: true, lastReadAt: null }),
    ];

    expect(
      selectOfflineBookRows(rows).map((entry) => entry.libraryItemId),
    ).toEqual(["new", "old", "never"]);
  });
});
