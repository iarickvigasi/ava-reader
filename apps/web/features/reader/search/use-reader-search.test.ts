import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {
  ReaderStatusPayload,
  ReaderChapterPayload,
} from "@/lib/api-types/reader";
import { useReaderSearch } from "./use-reader-search";

const f = vi.hoisted(() => ({
  owner: "reader-a" as string | null,
  active: "reader-a" as string | null,
  clerk: undefined as string | undefined,
  signedOut: false,
  transition: false,
  db: {} as object,
  states: [] as unknown[],
  cursor: 0,
  deps: [] as unknown[][],
  effects: [] as (() => void | (() => void))[],
  cleanups: [] as (void | (() => void))[],
  effectCursor: 0,
  getToken: vi.fn(),
  fetch: vi.fn(),
  network: vi.fn(),
  access: "ready",
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = f.cursor++;
    if (!(index in f.states))
      f.states[index] = typeof initial === "function" ? initial() : initial;
    return [
      f.states[index],
      (next: unknown) => {
        f.states[index] =
          typeof next === "function" ? next(f.states[index]) : next;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const index = f.effectCursor++,
      previous = f.deps[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
      f.deps[index] = deps;
      f.effects.push(() => {
        f.cleanups[index]?.();
        f.cleanups[index] = effect();
      });
    }
  },
  useMemo: (compute: () => unknown) => compute(),
  useDeferredValue: (value: unknown) => value,
}));
vi.mock("@/features/offline/lifecycle/device-owner-context", () => ({
  useMountedDeviceOwner: () => f.owner,
}));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    userId: f.clerk,
    getToken: f.getToken,
    isLoaded: !!f.clerk,
    isSignedIn: !!f.clerk,
  }),
}));
vi.mock("@/features/auth/local-sign-out", () => ({
  isLocallySignedOut: () => f.signedOut,
}));
vi.mock("@/features/auth/device-transition", () => ({
  isDeviceTransitionPending: () => f.transition,
}));
vi.mock("@/features/offline/db", () => ({
  getActiveUserId: () => f.active,
  getDb: () => f.db,
}));
vi.mock("@/features/offline/compatibility/database-access", () => ({
  databaseAccess: () => ({ state: f.access }),
}));
vi.mock("@/components/app/reader/data/reader-payload-network", () => ({
  fetchReaderPayloadFromNetwork: (...args: unknown[]) => f.network(...args),
}));
vi.mock("@/components/app/reader/data/reader-client", () => ({
  fetchReaderPayload: (...args: unknown[]) => f.fetch(...args),
}));

const ids = Array.from({ length: 8 }, (_, i) => String(i + 1));
const chapters = ids.map(
  (id, i): ReaderChapterPayload => ({
    chapterId: id,
    previousChapterId: ids[i - 1] ?? null,
    nextChapterId: ids[i + 1] ?? null,
    spineIndex: i,
    href: id,
    title: id,
    label: id,
    blocks: [
      {
        id: "body-" + id,
        kind: i === 3 ? "caption" : i === 7 ? "verse" : "paragraph",
        text: [1, 3, 7].includes(i) ? "😀e\u0301 four windows" : "Text " + id,
        inlines: [],
      },
    ],
  }),
);
function payload(
  window = [chapters[6], chapters[7]],
  revision = "a".repeat(64),
) {
  return {
    status: "READY",
    book: {
      libraryItemId: "book",
      slug: "book",
      title: "Book",
      authors: [],
      primaryFormat: "EPUB",
      language: "en",
    },
    activeChapterId: window[0].chapterId,
    chapters: window,
    chapterIds: ids,
    contentRevision: revision,
    toc: [],
    progress: {
      locator: null,
      chapterLabel: null,
      completionPercent: 0,
      lastReadAt: null,
    },
  } as Extract<ReaderStatusPayload, { status: "READY" }>;
}
function resetRender() {
  f.cursor = 0;
  f.effectCursor = 0;
  f.effects = [];
}
function flushEffects() {
  f.effects.forEach((effect) => effect());
}
function useHarness(input = payload()) {
  resetRender();
  const result = useReaderSearch(input);
  flushEffects();
  return result;
}
async function settle() {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}
beforeEach(() => {
  f.owner = f.active = "reader-a";
  f.clerk = undefined;
  f.signedOut = f.transition = false;
  f.db = {};
  f.states = [];
  f.deps = [];
  f.cleanups = [];
  f.effects = [];
  f.getToken.mockReset();
  f.network.mockReset();
  f.fetch.mockReset();
  f.access = "ready";
  f.fetch.mockImplementation(async ({ chapterId }: { chapterId: string }) =>
    payload([chapters[Number(chapterId) - 1]]),
  );
  f.network.mockRejectedValue(new Error("Authenticated manifest unavailable"));
});
afterEach(() => {
  f.cleanups.forEach((cleanup) => cleanup?.());
});

it("searches all eight owned cached chapters with Clerk unavailable and preserves UTF16 offsets", async () => {
  useHarness().setQuery("four windows");
  await settle();
  const result = useHarness();
  expect(result.loading).toBe(false);
  expect(result.error).toBe(false);
  expect(result.results.hits).toHaveLength(3);
  expect(result.results.hits[2]).toMatchObject({
    chapterId: "8",
    blockId: "body-8",
    textOffset: 5,
    endOffset: 17,
  });
  expect(f.getToken).not.toHaveBeenCalled();
});
it.each(["owner", "database", "signout", "transition", "clerk"])(
  "refuses stale results across %s changes",
  async (change) => {
    f.clerk = "reader-a";
    let release!: (value: ReturnType<typeof payload>) => void;
    let heldId = "";
    f.fetch.mockImplementationOnce(({ chapterId }: { chapterId: string }) => {
      heldId = chapterId;
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    useHarness().setQuery("four windows");
    await settle();
    if (change === "owner") f.owner = f.active = "reader-b";
    if (change === "database") f.db = {};
    if (change === "signout") f.signedOut = true;
    if (change === "transition") f.transition = true;
    if (change === "clerk") f.clerk = "reader-b";
    release(payload([chapters[Number(heldId) - 1]]));
    await settle();
    expect(useHarness().results.hits).toEqual([]);
  },
);
it("never rebinds an old source payload to the next mounted owner", async () => {
  f.clerk = "reader-a";
  useHarness().setQuery("four windows");
  await settle();
  expect(useHarness().results.hits).toHaveLength(3);
  f.owner = f.active = f.clerk = "reader-b";
  f.db = {};
  const next = useHarness();
  await settle();
  expect(next.results.hits).toEqual([]);
  expect(next.error).toBe(true);
  expect(useHarness().results.hits).toEqual([]);
});
it("discards a changed content revision rather than showing an old corpus", async () => {
  f.clerk = "reader-a";
  useHarness().setQuery("four windows");
  await settle();
  expect(useHarness().results.hits).toHaveLength(3);
  f.fetch.mockResolvedValue(payload([chapters[0]], "c".repeat(64)));
  const changed = useHarness(payload(undefined, "b".repeat(64)));
  expect(changed.results.hits).toEqual([]);
  await settle();
  expect(useHarness(payload(undefined, "b".repeat(64))).error).toBe(true);
});

it("keeps unverified legacy cached passages readable but Search unavailable offline", async () => {
  const old = { ...payload(), contentRevision: undefined };
  useHarness(old).setQuery("four windows");
  await settle();
  const result = useHarness(old);
  expect(result.loading).toBe(false);
  expect(result.error).toBe(true);
  expect(result.results.hits).toEqual([]);
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.getToken).not.toHaveBeenCalled();
});
it("refuses unversioned legacy Search online without substituting another revision", async () => {
  f.clerk = "reader-a";
  const old = { ...payload(), contentRevision: undefined };
  useHarness(old).setQuery("four windows");
  await settle();
  expect(useHarness(old).results.hits).toEqual([]);
  expect(useHarness(old).error).toBe(true);
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.network).not.toHaveBeenCalled();
});
it.each(["opening", "update-required", "unavailable"])(
  "refuses Search when database access is %s",
  async (access) => {
    f.access = access;
    useHarness().setQuery("four windows");
    await settle();
    expect(useHarness().results.hits).toEqual([]);
    expect(useHarness().error).toBe(true);
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.network).not.toHaveBeenCalled();
  },
);
it("retry cannot turn an incomplete manifest into a completed zero-result search", async () => {
  const old = { ...payload(), contentRevision: undefined };
  useHarness(old).setQuery("absent text");
  await settle();
  expect(useHarness(old).error).toBe(true);
  useHarness(old).retry();
  useHarness(old);
  await settle();
  expect(useHarness(old).error).toBe(true);
  expect(useHarness(old).loading).toBe(false);
});

it("refuses a remembered active marker without a reconciled mounted owner", async () => {
  f.owner = null;
  f.clerk = "reader-a";
  useHarness().setQuery("four windows");
  await settle();
  expect(useHarness().error).toBe(true);
  expect(useHarness().results.hits).toEqual([]);
  expect(f.fetch).not.toHaveBeenCalled();
  expect(f.network).not.toHaveBeenCalled();
});
it("adopts a new authoritative revision immediately without retaining the old corpus", async () => {
  f.clerk = "reader-a";
  useHarness().setQuery("four windows");
  await settle();
  expect(useHarness().results.hits).toHaveLength(3);
  const next = payload(chapters, "b".repeat(64));
  expect(useHarness(next).results.hits).toEqual([]);
  await settle();
  expect(useHarness(next).results.hits).toHaveLength(3);
  expect(useHarness(next).error).toBe(false);
});
