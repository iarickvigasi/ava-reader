import { describe, expect, it, vi } from "vitest";

import {
  readWithRevalidate,
  type ReadWithRevalidateDeps,
} from "./read-with-revalidate";

type Book = { slug: string };
const BOOK: Book = { slug: "dune" };

function deps(
  overrides: Partial<ReadWithRevalidateDeps<Book>> = {},
): ReadWithRevalidateDeps<Book> {
  return {
    isOnline: () => true,
    read: vi.fn().mockResolvedValue(BOOK),
    revalidate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("readWithRevalidate", () => {
  it("returns a cached row without revalidating (the screen's hydrator owns freshness)", async () => {
    const d = deps();
    expect(await readWithRevalidate(d)).toEqual(BOOK);
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("returns the cached row without revalidating offline", async () => {
    const d = deps({ isOnline: () => false });
    expect(await readWithRevalidate(d)).toEqual(BOOK);
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("revalidates then re-reads on a cache miss online", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(BOOK);
    const d = deps({ read });
    expect(await readWithRevalidate(d)).toEqual(BOOK);
    expect(d.revalidate).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("returns null on a cache miss offline without revalidating", async () => {
    const d = deps({
      isOnline: () => false,
      read: vi.fn().mockResolvedValue(null),
    });
    expect(await readWithRevalidate(d)).toBeNull();
    expect(d.revalidate).not.toHaveBeenCalled();
  });

  it("returns null when the row is still missing after revalidation", async () => {
    const d = deps({ read: vi.fn().mockResolvedValue(null) });
    expect(await readWithRevalidate(d)).toBeNull();
  });
});
