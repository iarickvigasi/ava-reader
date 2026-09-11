import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { readBookInfo, readCollectionBySlug, __resetLibraryBucketForTests } from "../bucket";
import { clearCollectionMembershipRuntime, subscribeToCollectionMembershipDrops } from "./bucket";
import { updateBookCollections } from "./mutations";
import { flushCollectionMemberships } from "./sync";
import { addTarget, book, membershipAck, removeTarget, seedMembershipFixture, target, token } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await seedMembershipFixture();
});
afterEach(() => {
  clearCollectionMembershipRuntime();
  __resetLibraryBucketForTests();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});

it("replays after reconnect, replaces full membership, and does not double count", async () => {
  const fetcher = vi.fn(async () => Response.json(membershipAck(true)));
  vi.stubGlobal("fetch", fetcher);
  await updateBookCollections(addTarget, token);
  expect(fetcher).not.toHaveBeenCalled();
  __setNetStateForTests(true);
  await flushCollectionMemberships(token);
  expect(await getDb().collectionMembershipMutations.count()).toBe(0);
  const shelf = await readCollectionBySlug(target.slug);
  expect(shelf?.itemCount).toBe(21);
  expect(shelf?.books).toHaveLength(21);
  expect((await readBookInfo(book.slug))?.collections).toHaveLength(2);
});

it("an old acknowledgment cannot erase an opposite edit made during its request", async () => {
  let resolveFirst!: (response: Response) => void;
  const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
  let announce!: () => void;
  const started = new Promise<void>((resolve) => { announce = resolve; });
  const fetcher = vi.fn().mockImplementationOnce(() => { announce(); return first; })
    .mockImplementation(async () => Response.json(membershipAck(false)));
  vi.stubGlobal("fetch", fetcher);
  await updateBookCollections(addTarget, token);
  __setNetStateForTests(true);
  const flush = flushCollectionMemberships(token);
  await started;
  await updateBookCollections(removeTarget, token);
  resolveFirst(Response.json(membershipAck(true)));
  await flush;
  expect((await readCollectionBySlug(target.slug))?.itemCount).toBe(20);
  expect((await readBookInfo(book.slug))?.collections).toHaveLength(1);
  expect(await getDb().collectionMembershipMutations.count()).toBe(0);
});

it("keeps transient failures queued and reports permanent rejection", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
  await updateBookCollections(addTarget, token);
  __setNetStateForTests(true);
  await flushCollectionMemberships(token);
  expect(await getDb().collectionMembershipMutations.count()).toBe(1);
  const dropped = vi.fn();
  subscribeToCollectionMembershipDrops(dropped);
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Gone" }, { status: 404 })));
  await flushCollectionMemberships(token);
  expect(dropped).toHaveBeenCalledWith({ libraryItemId: book.libraryItemId, reason: "Gone" });
  const afterNavigation = vi.fn();
  subscribeToCollectionMembershipDrops(afterNavigation);
  expect(afterNavigation).toHaveBeenCalledWith({ libraryItemId: book.libraryItemId, reason: "Gone" });
  expect((await readCollectionBySlug(target.slug))?.itemCount).toBe(20);
});

it("does not send a previous account's queue with a new account token", async () => {
  await updateBookCollections(addTarget, token);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  setActiveUser("membership-other-user");
  __setNetStateForTests(true);
  await flushCollectionMemberships(token);
  expect(fetcher).not.toHaveBeenCalled();
  await getDb().delete();
});
