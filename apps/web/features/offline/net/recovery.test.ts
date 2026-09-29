import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb } from "../db";
import {
  createLocalSession,
  closeLocalSession,
  listUnsyncedClosedSessions,
} from "../buckets/sessions/storage";
import { syncPendingSessions } from "../buckets/sessions/sync";
import { revalidateHome } from "../buckets/home/revalidate";
import { homeFixture } from "../buckets/home/test-fixture";
import { readHome } from "../buckets/home/storage";
import {
  __resetNetStateForTests,
  checkNetworkReachability,
  isOnline,
} from "./net-state";
import { useSyncTriggers } from "./use-sync-triggers";

const effects = vi.hoisted(() => [] as Array<() => (() => void) | undefined>);
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => () => void) => effects.push(effect),
}));
let cleanup: (() => void) | undefined;
afterEach(async () => {
  cleanup?.();
  __resetNetStateForTests();
  await getDb().delete();
  __resetDbForTests();
  vi.unstubAllGlobals();
  effects.length = 0;
});

it("retains failed sessions and refreshes home/replays on confirmed recovery without window online", async () => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.stubGlobal("navigator", { onLine: true });
  __resetNetStateForTests();
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await createLocalSession({
    libraryItemId: "book",
    clientSessionId: "session",
    startedAt: "2026-09-25T10:00:00Z",
  });
  await closeLocalSession({
    clientSessionId: "session",
    endedAt: "2026-09-25T10:01:00Z",
  });
  const getToken = async () => "token";
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetchMock);
  await syncPendingSessions(getToken, "device");
  await checkNetworkReachability();
  expect(isOnline()).toBe(false);
  expect(await listUnsyncedClosedSessions()).toHaveLength(1);
  let resumed: Promise<unknown> | undefined;
  const run = vi.fn(() => {
    resumed = Promise.all([
      syncPendingSessions(getToken, "device"),
      revalidateHome(getToken),
    ]);
  });
  useSyncTriggers(run, { kickOnAttach: true });
  cleanup = effects[0]();
  expect(run).not.toHaveBeenCalled();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/reachability"))
      return Response.json({ service: "ava-reader-api" });
    if (url.includes("/api/home")) return Response.json(homeFixture());
    return Response.json({});
  });
  await checkNetworkReachability();
  await resumed;
  expect(run).toHaveBeenCalledTimes(1);
  expect(await listUnsyncedClosedSessions()).toHaveLength(0);
  expect((await readHome())?.user.displayName).toBe("Reader");
  await checkNetworkReachability();
  expect(run).toHaveBeenCalledTimes(1);
  cleanup?.();
  cleanup = undefined;
  window.dispatchEvent(new Event("offline"));
  await checkNetworkReachability();
  expect(run).toHaveBeenCalledTimes(1);
});
