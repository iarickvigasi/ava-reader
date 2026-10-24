import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  __resetDbForTests,
  dbNameForUser,
  getDb,
  setActiveUser,
} from "../../db";
import { hydrateFromPayload, __resetLibraryBucketForTests } from "./bucket";
import { payload } from "./test-fixture";
import { acquireCatalogBook } from "./acquire-catalog-book";

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  for (const user of ["reading-test-a", "reading-test-b"])
    await Dexie.delete(dbNameForUser(user));
  setActiveUser("reading-test-a");
});
afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  vi.unstubAllGlobals();
});

it("opens a previously acquired cached copy without network or token access", async () => {
  const fetch = vi.fn();
  const getToken = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await hydrateFromPayload(payload());
  const target = { libraryItemId: "lib-1", slug: "book-a" };
  await getDb().meta.put({
    key: "catalog-reading-copy:entry",
    value: target,
    updatedAt: "2026-10-23",
  });
  expect(await acquireCatalogBook("entry", getToken)).toEqual(target);
  expect(fetch).not.toHaveBeenCalled();
  expect(getToken).not.toHaveBeenCalled();
});

it("does not send an old account's acquisition after a token-time account switch", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    acquireCatalogBook("entry", async () => {
      setActiveUser("reading-test-b");
      return "token";
    }),
  ).rejects.toThrow("Authentication required");
  expect(fetch).not.toHaveBeenCalled();
});

it("does not cache a phantom reading copy when main API rejects publication", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 400 })),
  );
  await expect(
    acquireCatalogBook("entry", async () => "token"),
  ).rejects.toThrow("Book acquisition failed");
  expect(await getDb().meta.get("catalog-reading-copy:entry")).toBeUndefined();
});

it("never sends a late POST after cancellation while authentication was pending", async () => {
  const token = Promise.withResolvers<string | null>();
  const getToken = vi.fn(() => token.promise);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  const read = acquireCatalogBook("entry", getToken, controller.signal);
  const rejected = expect(read).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(getToken).toHaveBeenCalledOnce());
  controller.abort();
  await rejected;
  token.resolve("token");
  await Promise.resolve();
  expect(fetch).not.toHaveBeenCalled();
});
