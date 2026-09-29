import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { loadOwnedCover } from "./load-owned-cover";
import { coverTests, input, image, id } from "./owned-cover-fixture";
coverTests();
it("authenticates a finite owned path and persists only its cover field", async () => {
  const fetch = vi.fn(async () => image());
  vi.stubGlobal("fetch", fetch);
  const blob = await loadOwnedCover(input());
  expect(fetch.mock.calls[0]).toEqual([
    new URL(input().src, "http://localhost:4000"),
    expect.objectContaining({
      headers: { Authorization: "Bearer cover-token" },
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
    }),
  ]);
  expect(blob.type).toBe("image/png");
  expect((await getDb().libraryItems.get(id))?.coverBlob?.size).toBe(4);
});
it("reuses the account's cached cover without a token or network request", async () => {
  await getDb().libraryItems.update(id, {
    coverBlob: new Blob(["cached"], { type: "image/png" }),
  });
  const token = vi.fn(async () => {
    throw Error("offline");
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect((await loadOwnedCover({ ...input(), getToken: token })).size).toBe(6);
  expect(token).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("preserves metadata changed while the cover request was in flight", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await getDb().libraryItems.update(id, { title: "Edited title" });
      return image();
    }),
  );
  await loadOwnedCover(input());
  expect((await getDb().libraryItems.get(id))?.title).toBe("Edited title");
});
it.each([
  "https://other.invalid/api/library/epub-imports/covers/cover-library",
  "/api/library/epub-imports/covers/other",
  "/api/library/epub-imports/covers/cover-library?source=https://other.invalid",
])("refuses foreign or substituted source %s before transport", async (src) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(loadOwnedCover({ ...input(), src })).rejects.toThrow(
    "COVER_UNAVAILABLE",
  );
  expect(fetch).not.toHaveBeenCalled();
});
