import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb } from "../../db";
import { applyLibraryPayload } from "./collections/write-library";
import { payload } from "./test-fixture";
import { deleteBook } from "./delete-book";
import {
  readDownloadCoverage,
  recordDownloadCoverage,
} from "../book/download-coverage";

vi.mock("@/lib/api", () => ({
  getPublicApiBaseUrl: () => "https://fixture.invalid",
}));
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await applyLibraryPayload(payload());
  await recordDownloadCoverage(getDb(), "lib-1", "epub:retained", ["one"]);
  await recordDownloadCoverage(getDb(), "lib-2", "epub:deleted", ["two"]);
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
});

it("confirmed Library deletion removes only the deleted book's new coverage journal", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  await deleteBook("lib-2", async () => "fixture-token");
  expect(await readDownloadCoverage(getDb(), "lib-2")).toBeNull();
  expect(await readDownloadCoverage(getDb(), "lib-1")).toMatchObject({
    identity: "epub:retained",
    chapterIds: ["one"],
  });
});

it("an unsuccessful Library deletion retains its coverage journal", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 403 })),
  );
  await expect(
    deleteBook("lib-2", async () => "fixture-token"),
  ).rejects.toThrow();
  expect(await readDownloadCoverage(getDb(), "lib-2")).toMatchObject({
    identity: "epub:deleted",
  });
});
