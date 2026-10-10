import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { ReaderPayloadError } from "./data/reader-payload-error";
import { useReaderScreenLoader } from "./use-reader-screen-loader";
import { ReaderScreenLoader } from "./reader-screen-loader";

// Run the real hook and orchestration with the repository's injected-hook
// test pattern. Effects commit after render; deferred requests expose races.
const hooks = vi.hoisted(() => ({
  stateCursor: 0,
  refCursor: 0,
  effectCursor: 0,
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as { deps: readonly unknown[]; cleanup?: () => void }[],
  pending: [] as (() => void)[],
  callback: null as (() => void) | null,
  network: null as ((online: boolean) => void) | null,
  fetch: vi.fn(),
  cache: vi.fn(),
  find: vi.fn(),
  notice: vi.fn(),
  reader: vi.fn(),
  skeleton: vi.fn(),
  online: true,
}));
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const index = hooks.stateCursor++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] =
          typeof next === "function" ? next(hooks.states[index]) : next;
      },
    ];
  },
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refCursor++] ??= { current: initial }),
  useCallback: (callback: () => void) => (hooks.callback ??= callback),
  useEffect: (effect: () => (() => void) | void, deps: readonly unknown[]) => {
    const index = hooks.effectCursor++;
    const old = hooks.effects[index];
    if (
      old &&
      deps.length === old.deps.length &&
      deps.every((dep, i) => Object.is(dep, old.deps[i]))
    )
      return;
    hooks.pending.push(() => {
      old?.cleanup?.();
      hooks.effects[index] = { deps, cleanup: effect() || undefined };
    });
  },
}));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    getToken: async () => "test-only",
    isLoaded: true,
    isSignedIn: true,
  }),
}));
vi.mock("./reader-screen", () => ({ ReaderScreen: hooks.reader }));
vi.mock("./reader-shell-skeleton", () => ({
  ReaderShellSkeleton: hooks.skeleton,
}));
vi.mock("@/components/app/core/unavailable-page", () => ({
  UnavailablePage: () => null,
}));
vi.mock("@/components/app/core/offline-route-fallback", () => ({
  OfflineRouteFallback: () => null,
}));
vi.mock("./data/reader-client", () => ({ fetchReaderPayload: hooks.fetch }));
vi.mock("@/features/offline/buckets/book", () => ({
  loadReaderPayloadFromCache: hooks.cache,
}));
vi.mock("@/features/reader/resolve-cached-library-item-id", () => ({
  resolveCachedLibraryItemId: hooks.find,
}));
vi.mock("@/features/offline/notices/missing-book-bus", () => ({
  emitMissingBookOfflineModal: hooks.notice,
}));
vi.mock("@/features/offline/net/net-state", () => ({
  isOnline: () => hooks.online,
  subscribeToNetworkState: (callback: (online: boolean) => void) => {
    hooks.network = callback;
    return () => {
      hooks.network = null;
    };
  },
}));
const payload = {
  status: "READY",
  book: { libraryItemId: "owned-id" },
} as ReaderStatusPayload;
function deferred() {
  let resolve!: (payload: ReaderStatusPayload) => void;
  const promise = new Promise<ReaderStatusPayload>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function render() {
  hooks.stateCursor = hooks.refCursor = hooks.effectCursor = 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- The controlled test scheduler supplies every hook and commits effects after render.
  const view = useReaderScreenLoader();
  hooks.pending.splice(0).forEach((commit) => commit());
  return view;
}
function screenBoundary() {
  hooks.stateCursor = hooks.refCursor = hooks.effectCursor = 0;
  const boundary = ReaderScreenLoader();
  hooks.pending.splice(0).forEach((commit) => commit());
  return boundary;
}
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
function unmount() {
  hooks.effects.forEach((effect) => effect.cleanup?.());
}
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.effects = [];
  hooks.pending = [];
  hooks.callback = null;
  hooks.network = null;
  hooks.online = true;
  vi.clearAllMocks();
  hooks.find.mockResolvedValue("owned-id");
  hooks.cache.mockResolvedValue(null);
  vi.stubGlobal("window", { location: { pathname: "/app/read/book" } });
});
afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
});

it("keeps compatibility failures out of the missing-offline modal and retries the same owned book", async () => {
  hooks.fetch.mockRejectedValueOnce(
    new ReaderPayloadError(409, "PDF_READER_UPGRADE_REQUIRED"),
  );
  const next = deferred();
  hooks.fetch.mockReturnValueOnce(next.promise);
  render();
  await turn();
  const failed = render();
  expect(failed.result).toEqual({
    kind: "upgrade-required",
    libraryItemId: "owned-id",
  });
  expect(hooks.notice).not.toHaveBeenCalled();
  failed.retry();
  expect(render().result).toBeNull();
  await turn();
  expect(hooks.fetch).toHaveBeenCalledTimes(2);
  expect(hooks.fetch.mock.calls.map(([input]) => input.libraryItemId)).toEqual([
    "owned-id",
    "owned-id",
  ]);
  next.resolve(payload);
  await turn();
  expect(render().result).toEqual({
    kind: "loaded",
    payload,
    libraryItemId: "owned-id",
  });
  expect(hooks.notice).not.toHaveBeenCalled();
});
it("invalidates a late result immediately on retry and ignores completions after exit", async () => {
  const old = deferred();
  const next = deferred();
  hooks.fetch
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(next.promise);
  const view = render();
  await turn();
  view.retry();
  old.resolve(payload);
  await turn(); // old effect has not cleaned up yet
  expect(render().result).toBeNull();
  await turn();
  expect(hooks.fetch).toHaveBeenCalledTimes(2);
  unmount();
  next.resolve(payload);
  await turn();
  expect(hooks.states[0]).toBeNull();
});
it("preserves genuine offline notices and automatically reloads on reconnection", async () => {
  hooks.online = false;
  hooks.fetch.mockResolvedValue(payload);
  render();
  await turn();
  expect(render().result).toEqual({
    kind: "missing-offline",
    libraryItemId: "owned-id",
  });
  expect(hooks.notice).toHaveBeenCalledWith({ libraryItemId: "owned-id" });
  expect(hooks.fetch).not.toHaveBeenCalled();
  hooks.online = true;
  hooks.network?.(true);
  expect(render().result).toBeNull();
  await turn();
  expect(render().result?.kind).toBe("loaded");
});
it("shows a retryable error if local lookup fails instead of leaving a spinner", async () => {
  hooks.find.mockRejectedValue(new Error("local storage unavailable"));
  render();
  await turn();
  expect(render().result).toEqual({ kind: "error" });
  expect(hooks.notice).not.toHaveBeenCalled();
});

it("keeps the actual ready-reader boundary and payload through a deferred reconnect refresh", async () => {
  const refreshed = deferred();
  hooks.fetch
    .mockResolvedValueOnce(payload)
    .mockReturnValueOnce(refreshed.promise);
  render();
  await turn();
  const ready = render().result;
  const opened = screenBoundary();
  expect(opened.type).toBe(hooks.reader);
  expect(opened.props).toMatchObject({
    initialPayload: payload,
    libraryItemId: "owned-id",
  });

  hooks.online = false;
  hooks.network?.(false);
  expect(screenBoundary().type).toBe(hooks.reader);
  hooks.online = true;
  hooks.network?.(true);
  // This calls the real screen component as well as the real loader hook:
  // returning Skeleton here would dispose the navigation session and Back stack.
  expect(screenBoundary().type).toBe(hooks.reader);
  expect(render().result).toBe(ready);
  await turn();
  expect(hooks.fetch).toHaveBeenCalledTimes(2);
  expect(screenBoundary().type).toBe(hooks.reader);
  expect(hooks.notice).not.toHaveBeenCalled();

  refreshed.resolve(payload);
  await turn();
  expect(screenBoundary().type).toBe(hooks.reader);
  expect(render().result).toEqual({
    kind: "loaded",
    payload,
    libraryItemId: "owned-id",
  });
});
