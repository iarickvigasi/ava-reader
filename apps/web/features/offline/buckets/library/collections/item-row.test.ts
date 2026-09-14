import { describe, expect, it } from "vitest";

import { mergeListPayloadItemRow } from "./item-row";
import { bookToItemRow } from "./payload-rows";

import type { LibraryItemRow } from "../../../db";

const NOW = "2026-02-01T00:00:00Z";

function serverRow(): LibraryItemRow {
  return bookToItemRow(
    {
      libraryItemId: "lib-1",
      slug: "book-a",
      title: "Book A",
      authors: ["A"],
      coverImageUrl: null,
      completionPercent: 10,
      primaryFormat: "EPUB",
      lastReadAt: "2026-01-01T00:00:00Z",
    },
    NOW,
  );
}

function cachedRow(overrides: Partial<LibraryItemRow>): LibraryItemRow {
  return { ...serverRow(), ...overrides };
}

describe("mergeListPayloadItemRow", () => {
  it("takes the payload wholesale when nothing is cached", () => {
    expect(mergeListPayloadItemRow(serverRow(), undefined)).toEqual(
      serverRow(),
    );
  });

  it("keeps the offline-save state a list payload cannot carry", () => {
    const merged = mergeListPayloadItemRow(
      serverRow(),
      cachedRow({
        savedOffline: true,
        savedAutomatically: true,
        savedAt: NOW,
      }),
    );
    expect(merged).toMatchObject({
      savedOffline: true,
      savedAutomatically: true,
      savedAt: NOW,
    });
  });

  it("keeps book-info details fetched by the book-info page", () => {
    const details = { minutesRead: 12 } as LibraryItemRow["details"];
    const merged = mergeListPayloadItemRow(
      serverRow(),
      cachedRow({ details, detailsFetchedAt: NOW }),
    );
    expect(merged.details).toBe(details);
    expect(merged.detailsFetchedAt).toBe(NOW);
  });

  it("lets an unsynced local toggle outrank the payload's intent", () => {
    const merged = mergeListPayloadItemRow(
      { ...serverRow(), offlineRequested: false },
      cachedRow({ offlineRequested: true, offlineRequestedDirty: true }),
    );
    expect(merged.offlineRequested).toBe(true);
    expect(merged.offlineRequestedDirty).toBe(true);
  });

  it("takes the payload's intent once the local toggle is clean", () => {
    const merged = mergeListPayloadItemRow(
      { ...serverRow(), offlineRequested: true },
      cachedRow({ offlineRequested: false, offlineRequestedDirty: false }),
    );
    expect(merged.offlineRequested).toBe(true);
  });

  it.each([NOW, null])("carries an explicit finish date %s from a list payload", (finishedAt) => {
    const row = bookToItemRow({
      libraryItemId: "lib-1", slug: "book-a", title: "Book A", authors: ["A"],
      coverImageUrl: null, completionPercent: 10, primaryFormat: "EPUB",
      lastReadAt: NOW, finishedAt,
    }, NOW);
    expect(row.finishedAt).toBe(finishedAt);
  });

  it("retains a known legacy detail date when an older list omits the date", () => {
    const details = { finishedAt: NOW, minutesRead: 12 } as LibraryItemRow["details"];
    const merged = mergeListPayloadItemRow(serverRow(), cachedRow({ details }));
    expect(merged.finishedAt).toBe(NOW);
    expect(merged.details).toBe(details);
  });

  it("preserves an explicit canonical clear over a stale legacy detail date", () => {
    const details = { finishedAt: NOW, minutesRead: 12 } as LibraryItemRow["details"];
    const merged = mergeListPayloadItemRow(serverRow(), cachedRow({ finishedAt: null, details }));
    expect(merged.finishedAt).toBeNull();
    expect(merged.details).toEqual({ finishedAt: null, minutesRead: 12 });
  });

  it.each([NOW, null])("updates cached details with an incoming date %s", (finishedAt) => {
    const details = { finishedAt: "2026-01-01T12:00:00Z", minutesRead: 12 } as LibraryItemRow["details"];
    const merged = mergeListPayloadItemRow(
      { ...serverRow(), finishedAt },
      cachedRow({ finishedAt: details!.finishedAt, details }),
    );
    expect(merged.finishedAt).toBe(finishedAt);
    expect(merged.details).toEqual({ finishedAt, minutesRead: 12 });
  });
});
