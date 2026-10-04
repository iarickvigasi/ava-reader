import "fake-indexeddb/auto";
import { vi } from "vitest";
import { effectHost } from "./book-context-effect-host";
import { getDb, __resetDbForTests } from "../../db";
import { __resetBookBucketForTests, getBookSaveSnapshot } from "./bucket";
import { saveBookOffline } from "./download";
import { loadCanonicalResources } from "@/features/reader/canonical/resources";
import {
  networkResourcePayload,
  resourceOptions,
} from "@/features/reader/canonical/resource-recovery-fixture";

const bookFixture = vi.hoisted(() => ({
  ownerId: "fixture-owner",
  online: true,
  pending: [] as Promise<unknown>[],
  kinds: [] as string[],
}));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({ userId: bookFixture.ownerId }),
}));
vi.mock("@/features/offline/net/use-network-state", () => ({
  useNetworkState: () => bookFixture.online,
}));
vi.mock("./use-evict-stale-auto-saves", () => ({
  useEvictStaleAutoSaves() {},
}));
vi.mock("@/features/offline/notices/missing-book-bus", () => ({
  emitMissingBookOfflineModal() {},
}));
vi.mock("./storage", async (original) => {
  const real = await original<typeof import("./storage")>();
  return {
    ...real,
    hasBookContent(id: string) {
      const pending = real.hasBookContent(id);
      bookFixture.pending.push(pending);
      return pending;
    },
  };
});
vi.mock("./hooks", () => ({
  useBookSaveStatus: (id: string) => getBookSaveSnapshot(id),
  useSaveBook: (id: string) => ({
    save: (kind: "auto" | "explicit") => saveFixture(id, kind),
  }),
}));
export function saveFixture(libraryItemId: string, kind: "auto" | "explicit") {
  bookFixture.kinds.push(kind);
  const pending = saveBookOffline({
    libraryItemId,
    saveKind: kind,
    fetchChapter: async () => {
      const payload = networkResourcePayload();
      payload.book.libraryItemId = libraryItemId;
      return loadCanonicalResources(payload, resourceOptions);
    },
  });
  bookFixture.pending.push(pending);
  return pending;
}
export async function flushFixture() {
  effectHost.flush();
  while (bookFixture.pending.length)
    await Promise.all(bookFixture.pending.splice(0));
}
export async function resetFixture() {
  effectHost.reset();
  bookFixture.ownerId = "fixture-owner";
  bookFixture.online = true;
  bookFixture.pending.length = 0;
  bookFixture.kinds.length = 0;
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
}
export async function closeFixture() {
  effectHost.unmount();
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
  vi.unstubAllGlobals();
}

export { bookFixture };
