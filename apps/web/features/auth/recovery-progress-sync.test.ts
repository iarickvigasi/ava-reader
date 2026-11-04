import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { __resetDbForTests, dbNameForUser } from "@/features/offline/db";
import {
  readProgress,
  writeProgress,
} from "@/features/offline/buckets/progress/storage";
import {
  __resetProgressSyncForTests,
  flushDirtyProgress,
} from "@/features/offline/buckets/progress/sync";
import { createRecoveryAccount } from "./recovery-account.test-fixture";
import { retryClerkInitialization } from "./retry-clerk-initialization";

vi.mock("@/features/offline/buckets/home/revalidate", () => ({
  revalidateHome: async () => {},
}));
vi.mock("@/features/offline/buckets/library/revalidate", () => ({
  revalidateLibrary: async () => {},
}));
const userId = "auth-recovery-test";

afterEach(async () => {
  __resetDbForTests();
  __resetProgressSyncForTests();
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbNameForUser(userId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

it("retains pending reading through UI failure, then uploads with the recovered account", async () => {
  __resetDbForTests();
  const { runtime, token, getToken } = createRecoveryAccount(userId);
  const locator = {
    chapterId: "chapter-22",
    blockId: "paragraph",
    textOffset: 410,
  };
  await writeProgress({
    libraryItemId: "book",
    locator,
    completionPercent: 36,
    dirty: true,
  });
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      locator,
      completionPercent: 37,
      lastReadAt: "2026-11-04T15:41:09.421Z",
    }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  expect((await flushDirtyProgress(getToken)).synced).toBe(0);
  expect((await readProgress("book"))?.dirty).toBe(true);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(token).not.toHaveBeenCalled();

  const options = {
    publishableKey: `pk_live_${btoa("clerk.avareader.space$")}`,
  };
  let attempts = 0;
  await retryClerkInitialization({
    loaded: false,
    options,
    getClerkUIEntryChunk: async () => {
      attempts++;
      if (attempts === 1) throw { code: "failed_to_load_clerk_ui" };
      expect(Reflect.get(options, "__internal_clerkUIUrl")).toContain(
        "ava_clerk_retry=",
      );
      expect((await readProgress("book"))?.dirty).toBe(true);
    },
    getEntryChunks: async () => {
      runtime.loaded = true;
    },
  });
  expect((await flushDirtyProgress(getToken)).synced).toBe(1);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/book/reader/progress"),
    expect.objectContaining({
      method: "PATCH",
      headers: expect.objectContaining({
        Authorization: "Bearer same-account-token",
      }),
      body: expect.stringContaining('"textOffset":410'),
    }),
  );
  expect(await readProgress("book")).toMatchObject({
    locator,
    completionPercent: 37,
    dirty: false,
  });
});
