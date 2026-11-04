import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../db";
import { writeProgress } from "./storage";
import { flushDirtyProgress, __resetProgressSyncForTests } from "./sync";
import { deferredResponse } from "../library/finish-date/test-fixture";
vi.mock("../home/revalidate", () => ({ revalidateHome: async () => {} }));
vi.mock("../library/revalidate", () => ({ revalidateLibrary: async () => {} }));
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  __resetProgressSyncForTests();
  vi.unstubAllGlobals();
});

it("lets a new account flush while the previous account request is still pending", async () => {
  __resetDbForTests();
  vi.stubGlobal("navigator", { onLine: true });
  const locator = { chapterId: "chapter", blockId: "paragraph", textOffset: 0 };
  const response = deferredResponse();
  setActiveUser("lock-old-account");
  await writeProgress({
    libraryItemId: "old",
    locator,
    completionPercent: 10,
    dirty: true,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.includes("/new/")
        ? Promise.resolve(
            Response.json({ locator, completionPercent: 20, lastReadAt: null }),
          )
        : response.fetch(),
    ),
  );
  const old = flushDirtyProgress(async () => "old-token");
  await response.started;
  setActiveUser("lock-new-account");
  await writeProgress({
    libraryItemId: "new",
    locator,
    completionPercent: 20,
    dirty: true,
  });
  try {
    expect((await flushDirtyProgress(async () => "new-token")).synced).toBe(1);
  } finally {
    response.respond(
      Response.json({ locator, completionPercent: 10, lastReadAt: null }),
    );
    await old;
  }
});
