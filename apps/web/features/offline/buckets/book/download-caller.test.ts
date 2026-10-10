import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { fetchReaderPayload } from "@/components/app/reader/data/reader-client";
import { __resetDbForTests, getDb, setActiveUser } from "../../db";
import { __resetBookBucketForTests } from "./bucket";
import { useSaveBook } from "./hooks";
import { applyBookContent, applyChapter, hasBookContent } from "./storage";
import { loadReaderPayloadFromCache } from "./reader-cache";

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
}));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    getToken: async () => "fixture-token",
    isLoaded: true,
    isSignedIn: true,
  }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/app/core/app-toast", () => ({ emitAppToast() {} }));
vi.mock("@/lib/api", () => ({
  getPublicApiBaseUrl: () => "https://fixture.invalid",
}));

const book = {
  libraryItemId: "caller-book",
  slug: "caller-book",
  title: "Test",
  authors: [],
  language: "en",
  primaryFormat: "EPUB" as const,
};
const ids = ["first", "second", "third", "fourth"];
function ready(
  active = "first",
): Extract<ReaderStatusPayload, { status: "READY" }> {
  return {
    status: "READY",
    activeChapterId: active,
    book,
    chapterIds: ids,
    contentRevision: "1".repeat(64),
    chapters: [
      {
        chapterId: active,
        blocks: [],
        title: active,
        label: active,
        href: active,
        spineIndex: ids.indexOf(active),
        previousChapterId: null,
        nextChapterId: null,
      },
    ],
    toc: [
      {
        id: "toc-first",
        label: "First",
        chapterId: "first",
        spineIndex: 0,
        children: [],
        href: null,
        anchorId: null,
        blockId: null,
      },
    ],
    progress: {
      chapterLabel: null,
      completionPercent: 0,
      locator: null,
      lastReadAt: null,
    },
  };
}
async function seedOldWindow() {
  await applyBookContent({
    libraryItemId: book.libraryItemId,
    metadata: book,
    toc: ready().toc,
    chapterIds: ["first"],
  });
  await applyChapter({
    libraryItemId: book.libraryItemId,
    chapterId: "first",
    index: 0,
    blocks: [],
  });
}
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
  vi.unstubAllGlobals();
});

it("normal reads keep the old cached window while the actual Save hook fetches the full manifest and missing chapters from the API", async () => {
  await seedOldWindow();
  const fetcher = vi.fn(async (input: string | URL | Request) =>
    Response.json(
      ready(new URL(String(input)).searchParams.get("chapter") ?? "first"),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const cached = await fetchReaderPayload({
    libraryItemId: book.libraryItemId,
    isLoaded: true,
    isSignedIn: true,
    getToken: async () => "fixture-token",
  });
  expect(cached.status).toBe("READY");
  expect(fetcher).not.toHaveBeenCalled();
  expect(await hasBookContent(book.libraryItemId)).toBe(false);
  expect(await useSaveBook(book.libraryItemId).save("explicit")).toEqual({
    kind: "saved",
  });
  expect(fetcher).toHaveBeenCalled();
  expect((await getDb().books.get(book.libraryItemId))?.chapterIds).toEqual(
    ids,
  );
  expect(await hasBookContent(book.libraryItemId)).toBe(true);
  expect(
    (await loadReaderPayloadFromCache(book.libraryItemId, "fourth"))?.status,
  ).toBe("READY");
});

it("the actual Save hook reports an old API's missing manifest and retains existing offline reading", async () => {
  await seedOldWindow();
  const before = await getDb().books.get(book.libraryItemId);
  const old = ready();
  delete old.chapterIds;
  delete old.contentRevision;
  const fetcher = vi.fn(async () => Response.json(old));
  vi.stubGlobal("fetch", fetcher);
  expect((await useSaveBook(book.libraryItemId).save("explicit")).kind).toBe(
    "failed",
  );
  expect(fetcher).toHaveBeenCalledOnce();
  expect(await getDb().books.get(book.libraryItemId)).toEqual(before);
  expect(await hasBookContent(book.libraryItemId)).toBe(false);
  expect((await loadReaderPayloadFromCache(book.libraryItemId))?.status).toBe(
    "READY",
  );
});

it("an account switch during the quota check cannot start an old Save callback in the new account database", async () => {
  await seedOldWindow();
  const fetcher = vi.fn(async (input: string | URL | Request) =>
    Response.json(
      ready(new URL(String(input)).searchParams.get("chapter") ?? "first"),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("navigator", {
    storage: {
      estimate: async () => {
        setActiveUser("caller-next-account");
        return { quota: 1_000_000_000, usage: 0 };
      },
    },
  });
  const result = await useSaveBook(book.libraryItemId).save("explicit");
  expect(result).toEqual({ kind: "cancelled" });
  expect(fetcher).not.toHaveBeenCalled();
  expect(await getDb().books.count()).toBe(0);
  expect(await getDb().bookChapters.count()).toBe(0);
});
