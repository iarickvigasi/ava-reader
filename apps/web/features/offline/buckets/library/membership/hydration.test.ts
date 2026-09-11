import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { readCollectionBySlug, __resetLibraryBucketForTests } from "../bucket";
import { revalidateCollection } from "../revalidate";
import { acknowledgeMembership } from "./acknowledge";
import { clearCollectionMembershipRuntime } from "./bucket";
import { updateBookCollections } from "./mutations";
import { addTarget, book, membershipAck, seedMembershipFixture, target, token } from "./test-fixture";

afterEach(async () => {
  clearCollectionMembershipRuntime();
  __resetLibraryBucketForTests();
  await getDb().delete();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});

it("discards a pre-save collection response that arrives after acknowledgment", async () => {
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await seedMembershipFixture();
  let respond!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => { respond = resolve; });
  let announce!: () => void;
  const started = new Promise<void>((resolve) => { announce = resolve; });
  vi.stubGlobal("fetch", vi.fn(() => { announce(); return response; }));
  const stale = revalidateCollection(target.slug, token);
  await started;
  await updateBookCollections(addTarget, token);
  const mutation = await getDb().collectionMembershipMutations.get(book.libraryItemId);
  await acknowledgeMembership(getDb(), mutation!, membershipAck(true));
  respond(Response.json({ collection: target }));
  await stale;
  expect((await readCollectionBySlug(target.slug))?.itemCount).toBe(21);
  expect((await readCollectionBySlug(target.slug))?.books).toHaveLength(21);
});
