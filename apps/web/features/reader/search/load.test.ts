import { describe, expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import type {
  ReaderChapterPayload,
  ReaderStatusPayload,
} from "@/lib/api-types/reader";
import { loadSearchPassages } from "./load";
const chapter = (
  id: string,
  previous: string | null,
  next: string | null,
): ReaderChapterPayload => ({
  chapterId: id,
  previousChapterId: previous,
  nextChapterId: next,
  title: id,
  label: id,
  href: id,
  spineIndex: Number(id),
  blocks: [
    {
      kind: "paragraph",
      id: "body-" + id,
      text: "Text " + id,
      inlines: [{ kind: "text", text: "Text " + id }],
    },
  ],
});
const legacy = (
  chapters: ReaderChapterPayload[],
  activeChapterId = chapters[0].chapterId,
) => ({
  ...canonicalFixture(),
  readerPackage: undefined,
  resourceUrls: undefined,
  chapters,
  activeChapterId,
  toc: [],
});
describe("complete search preparation", () => {
  it("uses full canonical content without network, resources or progress writes", async () => {
    const fetch = vi.fn();
    const result = await loadSearchPassages(
      canonicalFixture(),
      fetch,
      new AbortController().signal,
    );
    expect(result.length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("discovers uncached chapters omitted from Contents and reuses fetched windows", async () => {
    const chapters = [
      chapter("0", null, "1"),
      chapter("1", "0", "2"),
      chapter("2", "1", "3"),
      chapter("3", "2", null),
    ];
    const fetch = vi.fn(async (id: string) =>
      legacy(id === "0" ? chapters.slice(0, 2) : chapters.slice(2), id),
    );
    const result = await loadSearchPassages(
      legacy([chapters[1]], "1"),
      fetch,
      new AbortController().signal,
    );
    expect(result.map((item) => item.chapterId)).toEqual(["0", "1", "2", "3"]);
    expect(fetch.mock.calls.map(([id]) => id)).toEqual(["0", "2"]);
  });
  it("does not return partial results for missing, foreign, failed or changed content", async () => {
    const initial = legacy([chapter("0", null, "1")]);
    const responses: ReaderStatusPayload[] = [
      legacy([] as ReaderChapterPayload[], "1"),
      {
        ...legacy([chapter("1", "0", null)]),
        book: { ...initial.book, libraryItemId: "someone-else" },
      },
      {
        status: "FAILED",
        book: initial.book,
        progress: initial.progress,
        message: "Failed",
      },
      canonicalFixture(),
    ];
    for (const response of responses)
      await expect(
        loadSearchPassages(
          initial,
          async () => response,
          new AbortController().signal,
        ),
      ).rejects.toThrow();
  });
  it("refuses cyclic or inconsistent adjacency and cancelled late fetches", async () => {
    await expect(
      loadSearchPassages(
        legacy([chapter("0", "1", "1"), chapter("1", "0", "0")]),
        vi.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("Cyclic");
    await expect(
      loadSearchPassages(
        legacy([chapter("0", null, "1"), chapter("1", null, null)]),
        vi.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow("Inconsistent");
    const controller = new AbortController();
    await expect(
      loadSearchPassages(
        legacy([chapter("0", null, "1")]),
        async () => {
          controller.abort();
          return legacy([chapter("1", "0", null)]);
        },
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});
