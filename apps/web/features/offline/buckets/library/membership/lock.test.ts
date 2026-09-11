import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb, __resetDbForTests } from "../../../db";
import { __setNetStateForTests, __resetNetStateForTests } from "../../../net/net-state";
import { clearCollectionMembershipRuntime } from "./bucket";
import { updateBookCollections } from "./mutations";
import { flushCollectionMemberships } from "./sync";
import { addTarget, removeTarget, seedMembershipFixture, membershipAck, token } from "./test-fixture";

afterEach(async () => {
  clearCollectionMembershipRuntime();
  await getDb().delete();
  __resetDbForTests();
  __resetNetStateForTests();
  vi.unstubAllGlobals();
});

it("waits for the per-account lock and reads the latest intent after acquiring it", async () => {
  await getDb().delete();
  __resetDbForTests();
  __setNetStateForTests(false);
  await seedMembershipFixture();
  let acquire!: () => void;
  const held = new Promise<void>((resolve) => { acquire = resolve; });
  const request = vi.fn(async (_name: string, run: () => Promise<void>) => {
    await held;
    return run();
  });
  vi.stubGlobal("navigator", { onLine: true, locks: { request } });
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(membershipAck(false)));
  vi.stubGlobal("fetch", fetcher);
  await updateBookCollections(addTarget, token);
  __setNetStateForTests(true);
  const flush = flushCollectionMemberships(token);
  await updateBookCollections(removeTarget, token);
  expect(fetcher).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledWith(`ava-reader:collection-membership:${getDb().name}`, expect.any(Function));
  acquire();
  await flush;
  expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
    addCollectionIds: [], removeCollectionIds: addTarget.addCollectionIds,
  });
});
