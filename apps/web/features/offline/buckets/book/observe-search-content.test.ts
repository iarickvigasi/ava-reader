import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { __resetDbForTests, getDb } from "../../db";
import { observeSearchContent } from "./observe-search-content";
import { applyChapter } from "./content-storage";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("observes cached chapter arrivals and isolates the requested book", async () => {
  await applyChapter({
    libraryItemId: "other",
    chapterId: "hidden",
    index: 0,
    blocks: [],
  });
  let initial!: () => void;
  let arrived!: () => void;
  const ready = new Promise<void>((resolve) => {
    initial = resolve;
  });
  const updated = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const subscription = observeSearchContent("search-book").subscribe(
    ({ chapters, book }) => {
      expect(book).toBeUndefined();
      if (!chapters.length) initial();
      if (chapters.length === 1) {
        expect(chapters[0].chapterId).toBe("new-chapter");
        arrived();
      }
    },
  );
  try {
    await ready;
    await applyChapter({
      libraryItemId: "search-book",
      chapterId: "new-chapter",
      index: 1,
      blocks: [],
    });
    await updated;
  } finally {
    subscription.unsubscribe();
  }
});
