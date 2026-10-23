import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, setActiveUser } from "../../../db";
import { removeCachedLibraryItems } from "../../library/remove-cached-items";
import { persistCoverFromNetwork } from "../persist-cover-blob";
import { rememberCover, readWarmCover } from "../warm-cover";
import { attachCoverBlob } from "./attach";
import { encodeCover } from "./encode";
import { readCoverBlob } from "./read";
import { cleanCoverTest, seedCoverItems } from "./testing";
import { resolveApiAssetUrl } from "@/lib/api";

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await cleanCoverTest();
});

it("preserves legacy bytes offline, refreshes once online, and invalidates warm artwork", async () => {
  const collection = await seedCoverItems();
  const sourceUrl = collection.books[0].coverImageUrl!;
  await getDb().bookCovers.put(
    await encodeCover(new Blob(["legacy"]), {
      libraryItemId: "lib-1",
      sourceUrl,
      verified: false,
    }),
  );
  rememberCover(
    "lib-1",
    { naturalWidth: 2, naturalHeight: 3 } as HTMLImageElement,
    "blob:legacy",
  );
  const fetch = vi.fn().mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetch);
  await persistCoverFromNetwork("lib-1", resolveApiAssetUrl(sourceUrl)!);
  expect(await (await readCoverBlob("lib-1"))!.text()).toBe("legacy");
  fetch.mockResolvedValue(new Response("fresh"));
  await Promise.all([
    persistCoverFromNetwork("lib-1", resolveApiAssetUrl(sourceUrl)!),
    persistCoverFromNetwork("lib-1", resolveApiAssetUrl(sourceUrl)!),
  ]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(await (await readCoverBlob("lib-1"))!.text()).toBe("fresh");
  expect(readWarmCover("lib-1")).toBeNull();
  await persistCoverFromNetwork("lib-1", resolveApiAssetUrl(sourceUrl)!);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each(["delete", "switch"])(
  "fences a late cover download after %s",
  async (action) => {
    const original = getDb();
    const collection = await seedCoverItems();
    let finish!: (response: Response) => void;
    let started!: () => void;
    const requested = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        started();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }),
    );
    const pending = persistCoverFromNetwork(
      "lib-1",
      resolveApiAssetUrl(collection.books[0].coverImageUrl)!,
    );
    await requested;
    if (action === "delete") await removeCachedLibraryItems(["lib-1"]);
    else setActiveUser("another-reader");
    finish(new Response("late"));
    await pending;
    expect(await getDb().bookCovers.get("lib-1")).toBeUndefined();
    if (action === "switch") await original.delete();
  },
);

it("does not attach a URL for another book to an existing item", async () => {
  await seedCoverItems();
  await attachCoverBlob("lib-1", new Blob(["wrong"]), "/another-book");
  expect(await readCoverBlob("lib-1")).toBeNull();
});
