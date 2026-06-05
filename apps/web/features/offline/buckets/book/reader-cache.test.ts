import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DB_NAME, __resetDbForTests } from "../../db";
import { loadReaderPayloadFromCache } from "./reader-cache";
import { applyBookContent, applyChapter } from "./storage";

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

async function seedBook(libraryItemId: string, chapterIds: string[]) {
  await applyBookContent({
    libraryItemId,
    toc: [],
    chapterIds,
    metadata: {
      libraryItemId,
      slug: `slug-${libraryItemId}`,
      title: `Title ${libraryItemId}`,
      authors: ["Author"],
      primaryFormat: "EPUB",
    },
  });
  for (let i = 0; i < chapterIds.length; i++) {
    await applyChapter({
      libraryItemId,
      chapterId: chapterIds[i]!,
      index: i,
      blocks: [
        {
          kind: "paragraph",
          id: `block-${chapterIds[i]}`,
          inlines: [],
          text: chapterIds[i]!,
        },
      ],
    });
  }
}

describe("loadReaderPayloadFromCache", () => {
  it("returns null when the book isn't cached", async () => {
    expect(await loadReaderPayloadFromCache("lib-missing")).toBeNull();
  });

  it("returns a 3-chapter window centered on the requested chapter", async () => {
    await seedBook("lib-1", ["a", "b", "c", "d", "e"]);

    const payload = await loadReaderPayloadFromCache("lib-1", "c");
    expect(payload?.status).toBe("READY");
    if (payload?.status !== "READY") {
      return;
    }
    expect(payload.activeChapterId).toBe("c");
    expect(payload.chapters.map((ch) => ch.chapterId)).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(payload.chapters[0]?.previousChapterId).toBe("a");
    expect(payload.chapters[2]?.nextChapterId).toBe("e");
  });

  it("defaults to the first chapter when no chapterId is passed", async () => {
    await seedBook("lib-1", ["first", "second", "third"]);
    const payload = await loadReaderPayloadFromCache("lib-1");
    expect(payload?.status).toBe("READY");
    if (payload?.status !== "READY") {
      return;
    }
    expect(payload.activeChapterId).toBe("first");
    expect(payload.chapters[0]?.chapterId).toBe("first");
    expect(payload.chapters[0]?.previousChapterId).toBeNull();
  });

  it("falls back to the first chapter when the requested chapter isn't cached", async () => {
    await seedBook("lib-1", ["a", "b"]);
    const payload = await loadReaderPayloadFromCache("lib-1", "missing");
    expect(payload?.status).toBe("READY");
    if (payload?.status !== "READY") {
      return;
    }
    expect(payload.activeChapterId).toBe("a");
  });

  it("returns null when BookRow exists but chapterIds is empty", async () => {
    await applyBookContent({
      libraryItemId: "lib-empty",
      toc: [],
      chapterIds: [],
      metadata: {
        libraryItemId: "lib-empty",
        slug: "slug",
        title: "T",
        authors: [],
        primaryFormat: "EPUB",
      },
    });
    expect(await loadReaderPayloadFromCache("lib-empty")).toBeNull();
  });
});
