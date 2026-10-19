import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { getDb, setActiveUser } from "../../db";
import { DELETED_ITEM_PREFIX } from "../library/deleted-items";
import { loadOwnedCover } from "./load-owned-cover";
import { coverTests, input, image, id } from "./owned-cover-fixture";
coverTests();
it("refuses an account change during token acquisition before dispatch", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    loadOwnedCover({
      ...input(),
      getToken: async () => {
        setActiveUser("cover-other");
        return "new-token";
      },
    }),
  ).rejects.toThrow("COVER_UNAVAILABLE");
  expect(fetch).not.toHaveBeenCalled();
});
it("discards bytes after account changes and never writes the new account", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      setActiveUser("cover-other-response");
      return image();
    }),
  );
  await expect(loadOwnedCover(input())).rejects.toThrow("COVER_UNAVAILABLE");
  expect(await getDb().libraryItems.get(id)).toBeUndefined();
});
it("refuses deleted cached covers and deletion during a response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await getDb().meta.put({
        key: `${DELETED_ITEM_PREFIX}${id}`,
        value: true,
        updatedAt: new Date().toISOString(),
      });
      return image();
    }),
  );
  await expect(loadOwnedCover(input())).rejects.toThrow("COVER_UNAVAILABLE");
  expect((await getDb().libraryItems.get(id))?.coverBlob).toBeNull();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(loadOwnedCover(input())).rejects.toThrow("COVER_UNAVAILABLE");
  expect(fetch).not.toHaveBeenCalled();
});
it("does not dispatch an already aborted request", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    loadOwnedCover({ ...input(), signal: controller.signal }),
  ).rejects.toThrow("COVER_UNAVAILABLE");
  expect(fetch).not.toHaveBeenCalled();
});
