import { describe, expect, it } from "vitest";
import { collectionChanges } from "./collection-changes";

const collections = [
  { id: "smart", kind: "SMART" as const, name: "Imported", smartKey: "imported-library" },
  { id: "old", kind: "CUSTOM" as const, name: "Read next", smartKey: null },
  { id: "new", kind: "CUSTOM" as const, name: "Favorites", smartKey: null },
];

describe("collection picker changes", () => {
  it("adds and removes custom memberships while protecting smart and unseen collections", () => {
    expect(collectionChanges(collections, new Set(["smart", "old", "unseen"]), new Set(["new"])))
      .toEqual({ addCollectionIds: ["new"], removeCollectionIds: ["old"] });
  });

  it("does not save an unchanged draft or a toggle reverted before saving", () => {
    expect(collectionChanges(collections, new Set(["old"]), new Set(["old"])))
      .toEqual({ addCollectionIds: [], removeCollectionIds: [] });
  });
});
