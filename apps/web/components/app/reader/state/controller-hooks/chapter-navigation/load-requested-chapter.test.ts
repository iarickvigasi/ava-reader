import { expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { loadRequestedChapter } from "./load-requested-chapter";
const fetchPayload = vi.hoisted(() => vi.fn());
vi.mock("../../../data/reader-client", () => ({
  fetchReaderPayload: fetchPayload,
}));
const input = {
  libraryItemId: "book",
  chapterId: "chapter-two",
  signal: new AbortController().signal,
  getToken: async () => null,
  isLoaded: true,
  isSignedIn: true,
};

it("resolves the exact requested cold passage", async () => {
  fetchPayload.mockResolvedValue(canonicalFixture());
  const result = await loadRequestedChapter(input, {
    blockId: "note-one",
    textOffset: 0,
  });
  expect(result.readerPackage).toBeDefined();
});
it("refuses unavailable content, a missing chapter, and a fabricated target", async () => {
  fetchPayload.mockResolvedValue({ status: "UNAVAILABLE" });
  await expect(
    loadRequestedChapter(input, { blockId: "note-one" }),
  ).rejects.toThrow();
  fetchPayload.mockResolvedValue(canonicalFixture());
  await expect(
    loadRequestedChapter(
      { ...input, chapterId: "missing" },
      { blockId: "note-one" },
    ),
  ).rejects.toThrow();
  await expect(
    loadRequestedChapter(input, { blockId: "missing" }),
  ).rejects.toThrow();
});
