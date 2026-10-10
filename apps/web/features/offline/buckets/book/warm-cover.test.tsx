import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookCover } from "@/components/app/shared/book-cover";
import {
  clearWarmCover,
  readWarmCover,
  rememberCover,
  releaseCoverUrl,
} from "./warm-cover";

const identity = vi.hoisted(() => ({ owner: "reader-a" }));
vi.mock("../../db", async (original) => ({
  ...(await original<typeof import("../../db")>()),
  getActiveUserId: () => identity.owner,
}));
const image = { naturalWidth: 400, naturalHeight: 600 } as HTMLImageElement;

afterEach(() => {
  clearWarmCover();
  identity.owner = "reader-a";
  vi.restoreAllMocks();
});

describe("warm reader covers", () => {
  it("renders decoded artwork on the first reader paint before the offline lookup", () => {
    rememberCover("book-a", image, "blob:cover-a");
    const markup = renderToStaticMarkup(
      <BookCover libraryItemId="book-a" src="/cover-a" title="A" alt="A" />,
    );
    expect(markup).toContain('src="blob:cover-a"');
    expect(markup).not.toContain("absolute inset-0");
    expect(markup).toContain("aspect-ratio:0.666");
  });

  it("retains a selected book even when other library covers finish loading", () => {
    rememberCover("book-a", image, "blob:cover-a");
    rememberCover("book-b", image, "blob:cover-b");
    expect(readWarmCover("book-a")?.src).toBe("blob:cover-a");
  });

  it("keeps an unmounted blob alive and revokes it during cleanup", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    rememberCover("book-a", image, "blob:cover-a");
    releaseCoverUrl("blob:cover-a");
    expect(revoke).not.toHaveBeenCalled();
    clearWarmCover();
    expect(revoke).toHaveBeenCalledWith("blob:cover-a");
  });

  it("isolates accounts and never reuses another book's artwork", () => {
    rememberCover("book-a", image, "blob:cover-a");
    expect(readWarmCover("book-b")).toBeNull();
    identity.owner = "reader-b";
    expect(readWarmCover("book-a")).toBeNull();
  });

  it("evicts the least recently used cover and releases its owned URL", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    rememberCover("book-a", image, "blob:cover-a");
    releaseCoverUrl("blob:cover-a");
    for (let index = 0; index < 16; index++)
      rememberCover(`book-${index}`, image, `blob:cover-${index}`);
    expect(readWarmCover("book-a")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:cover-a");
  });
});
