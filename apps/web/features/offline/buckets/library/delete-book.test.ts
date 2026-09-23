import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DB_NAME, __resetDbForTests, getDb, setActiveUser } from "../../db";
import { applyLibraryPayload } from "./collections/write-library";
import { payload } from "./test-fixture";
import { deleteBook } from "./delete-book";
import { revalidateBookInfo, revalidateLibrary } from "./revalidate";

vi.mock("@/lib/api", () => ({ getPublicApiBaseUrl: () => "http://localhost:4000" }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(async () => {
  __resetDbForTests(); await Dexie.delete(DB_NAME);
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  await applyLibraryPayload(payload());
});
afterEach(() => { vi.unstubAllGlobals(); __resetDbForTests(); });

it.each([200, 404])("removes the cached copy after DELETE status %i", async (status) => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status }));
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
  await deleteBook("lib-2", async () => "token");
  expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:4000/api/library/lib-2", {
    method: "DELETE", headers: { Authorization: "Bearer token" },
  });
  expect(await getDb().libraryItems.get("lib-2")).toBeUndefined();
  expect(await getDb().libraryItems.get("lib-1")).toBeDefined();
});

it.each([401, 403, 500])("retains cached content when deletion fails with %i", async (status) => {
  fetchMock.mockResolvedValue(new Response(null, { status }));
  await expect(deleteBook("lib-2", async () => "token")).rejects.toThrow();
  expect(await getDb().libraryItems.get("lib-2")).toBeDefined();
});

it("does not delete without authentication", async () => {
  await expect(deleteBook("lib-2", async () => null)).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await getDb().libraryItems.get("lib-2")).toBeDefined();
});

it("cascades a confirmed book-info 404 without requiring another full-library refresh", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
  const onNotFound = vi.fn();
  await revalidateBookInfo("book-b", async () => "token", onNotFound);
  expect(await getDb().libraryItems.get("lib-2")).toBeUndefined();
  expect(onNotFound).toHaveBeenCalledOnce();
});

it("does not touch a newly signed-in account when a DELETE response arrives late", async () => {
  fetchMock.mockImplementationOnce(async () => {
    setActiveUser("other-account");
    await applyLibraryPayload(payload());
    return new Response(null, { status: 200 });
  });
  await expect(deleteBook("lib-2", async () => "token")).rejects.toThrow("Account changed");
  expect(await getDb().libraryItems.get("lib-2")).toBeDefined();
  await getDb().delete();
});

it("reconciles remote deletion through the full library revalidation path", async () => {
  fetchMock.mockResolvedValue(Response.json({ libraryItemIds: ["lib-1"], collections: [], summary: { booksCount: 1, collectionsCount: 0 } }));
  await revalidateLibrary(async () => "token");
  expect(await getDb().libraryItems.get("lib-2")).toBeUndefined();
  expect(await getDb().libraryItems.get("lib-1")).toBeDefined();
});
