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
});
