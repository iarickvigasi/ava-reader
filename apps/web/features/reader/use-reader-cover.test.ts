import { afterEach, expect, it, vi } from "vitest";
import { useReaderCover } from "./use-reader-cover";

const hooks = vi.hoisted(() => ({
  resolved: null as unknown,
  effect: null as null | (() => () => void),
  read: vi.fn(),
  warm: vi.fn(),
}));
vi.mock("react", () => ({
  useState: () => [
    hooks.resolved,
    (next: unknown) => {
      hooks.resolved = next;
    },
  ],
  useEffect: (effect: typeof hooks.effect) => {
    hooks.effect = effect;
  },
}));
vi.mock("@/features/offline/buckets/library", () => ({
  readReaderCover: hooks.read,
  readWarmReaderCover: hooks.warm,
}));
afterEach(() => {
  hooks.resolved = null;
  vi.resetAllMocks();
});

it("distinguishes an unresolved lookup from confirmed missing metadata", async () => {
  hooks.read.mockResolvedValue(null);
  hooks.warm.mockReturnValue(null);
  expect(useReaderCover("book")).toBeUndefined();
  hooks.effect!();
  await hooks.read.mock.results[0].value;
  expect(useReaderCover("book")).toBeNull();
});

it("returns warm metadata immediately while storage revalidates it", () => {
  const cover = { title: "Book", libraryItemId: "book-id", src: "blob:cover" };
  hooks.warm.mockReturnValue(cover);
  expect(useReaderCover("book")).toBe(cover);
});

it("never carries a previous book's resolved metadata into the next lookup", () => {
  hooks.resolved = { slug: "old-book", cover: null };
  hooks.warm.mockReturnValue(null);
  expect(useReaderCover("new-book")).toBeUndefined();
});
