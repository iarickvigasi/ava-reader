import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import type { LibraryBookInfo } from "@/lib/api-types";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/i18n/messages/en.json";
import { BookInfoLoader } from "./book-info-loader";
import { getAccountToken } from "@/features/auth/get-account-token";

type Effect = { run: () => void | (() => void); deps?: readonly unknown[] };
const view = vi.hoisted(() => ({
  online: true,
  authLoaded: true,
  authUserId: "owner-a" as string | undefined,
  ownerId: "owner-a",
  inLoader: false,
  cursor: 0,
  states: [] as unknown[],
  refCursor: 0,
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Effect[],
  previous: [] as Effect[],
  cleanups: [] as Array<void | (() => void)>,
  updates: vi.fn(),
  read: vi.fn<() => Promise<LibraryBookInfo | null>>(),
  revalidate: vi.fn<(slug: string, token: () => Promise<string | null>, missing: () => void) => Promise<void>>(),
  getToken: vi.fn<() => Promise<string | null>>(async () => "test-session"),
  refresh: vi.fn(),
}));

// The repository uses Node-only component tests. Capture the real localized
// button handler, with only loader-local hook state/effect turns simulated;
// this is not React DOM or browser verification.
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => {
      if (!view.inLoader) return react.useState(initial);
      const index = view.cursor++;
      if (!(index in view.states)) view.states[index] = initial;
      return [view.states[index], (value: unknown) => {
        view.states[index] = typeof value === "function" ? value(view.states[index]) : value;
        view.updates();
      }];
    },
    useRef: (initial: unknown) => {
      if (!view.inLoader) return react.useRef(initial);
      const index = view.refCursor++;
      return view.refs[index] ??= { current: initial };
    },
    useEffect: (run: Effect["run"], deps?: Effect["deps"]) => {
      if (view.inLoader) view.effects.push({ run, deps });
      else react.useEffect(run, deps);
    },
    useTransition: () => [false, (action: () => void) => action()],
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: view.refresh }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/features/auth/use-offline-auth", () => ({ useOfflineAuth: () => ({ getToken: view.getToken, isLoaded: view.authLoaded, userId: view.authUserId }) }));
vi.mock("@/features/offline/net/net-state", () => ({ isOnline: () => view.online }));
vi.mock("@/features/offline/net/use-network-state", () => ({ useNetworkState: () => view.online }));
vi.mock("@/features/offline/lifecycle/device-owner-context", () => ({ useMountedDeviceOwner: () => view.ownerId }));
vi.mock("@/features/offline/buckets/library", async () => {
  const { readWithRevalidate } = await import("@/features/offline/buckets/library/read-with-revalidate");
  return { readWithRevalidate, readBookInfoBySlug: view.read, revalidateBookInfo: view.revalidate, BookInfoHydrator: () => null };
});
vi.mock("@/components/app/library/book-info/book-info-screen", () => ({
  LibraryBookInfoScreen: ({ book }: { book: LibraryBookInfo }) => <h1>{book.title}</h1>,
}));
vi.mock("@/components/ui/button", async (original) => {
  const buttons = await original<typeof import("@/components/ui/button")>();
  return { ...buttons, Button: vi.fn(buttons.Button) };
});

const book: LibraryBookInfo = {
  libraryItemId: "owned-book", slug: "book-a", title: "Recovered book", authors: [],
  coverImageUrl: null, completionPercent: 0, primaryFormat: "EPUB", addedAt: "2026-10-11T00:00:00Z",
  approximateBodyPageCount: null, approximatePageCount: null, chapterLabel: null,
  collections: [], description: null, genres: [], finishedAt: null, language: "en",
  lastReadAt: null, minutesRead: 0, publishedYear: null, source: "IMPORTED",
};

function renderView() {
  view.cursor = 0;
  view.refCursor = 0;
  view.effects = [];
  view.inLoader = true;
  const tree = BookInfoLoader();
  view.inLoader = false;
  view.effects.forEach((effect, index) => {
    const previous = view.previous[index];
    if (previous?.deps && effect.deps?.every((dep, i) => Object.is(dep, previous.deps?.[i]))) return;
    view.cleanups[index]?.();
    view.cleanups[index] = effect.run();
  });
  view.previous = view.effects;
  return renderToStaticMarkup(<NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>{tree}</NextIntlClientProvider>);
}
async function settledView() {
  renderView();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return renderView();
}
function clickRetry() {
  const handler = vi.mocked(Button).mock.calls.at(-1)?.[0].onClick;
  if (!handler) throw new Error("Visible retry button has no handler");
  handler({} as React.MouseEvent<HTMLButtonElement>);
}
function dispose() {
  view.cleanups.forEach((cleanup) => cleanup?.());
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  view.states = []; view.effects = []; view.previous = []; view.cleanups = [];
  view.refs = []; view.inLoader = false;
  view.online = true; view.authLoaded = true; view.authUserId = "owner-a"; view.ownerId = "owner-a";
  view.getToken = vi.fn(async () => "test-session");
  view.read.mockResolvedValue(null);
  view.revalidate.mockResolvedValue(undefined);
  vi.stubGlobal("window", { location: new URL("http://localhost/app/library/books/book-a") });
});
afterEach(() => { dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("Try again requests fresh owned details and replaces unavailable with the recovered book", async () => {
  expect(await settledView()).toContain("Try again");
  expect(view.read).toHaveBeenCalledTimes(2);
  expect(view.revalidate).toHaveBeenCalledExactlyOnceWith("book-a", view.getToken, expect.any(Function));
  view.revalidate.mockImplementation(async () => { view.read.mockResolvedValue(book); });
  clickRetry();
  const html = await settledView();
  expect({ reads: view.read.mock.calls.length, revalidations: view.revalidate.mock.calls.length, shellRefreshes: view.refresh.mock.calls.length })
    .toEqual({ reads: 4, revalidations: 2, shellRefreshes: 0 });
  expect(html).toContain("Recovered book");
  expect(html).not.toContain("Unable to load");
  expect(view.revalidate).toHaveBeenLastCalledWith("book-a", view.getToken, expect.any(Function));
});

it("keeps a confirmed missing book distinct from a retryable unavailable response", async () => {
  expect(await settledView()).toContain("Try again");
  view.revalidate.mockImplementation(async (_slug, _token, missing) => { missing(); });
  clickRetry();
  const html = await settledView();
  expect(html).toContain("404");
  expect(html).not.toContain("Try again");
  expect(html).not.toContain("Recovered book");
});

it("ignores a cached-details result arriving after the loader was disposed", async () => {
  let complete!: (value: LibraryBookInfo) => void;
  view.read.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  renderView();
  const updates = view.updates.mock.calls.length;
  dispose();
  complete(book);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(view.updates).toHaveBeenCalledTimes(updates);
  expect(view.revalidate).not.toHaveBeenCalled();
});


it("waits for current same-owner auth on a cold online miss instead of retaining a null-token closure", async () => {
  vi.useFakeTimers();
  view.authLoaded = false; view.authUserId = undefined;
  const clerkGetToken = vi.fn(async () => "test-session");
  view.getToken = vi.fn(() => getAccountToken(undefined, clerkGetToken));
  let detailRequests = 0;
  view.revalidate.mockImplementation(async (_slug, token) => {
    if (await token()) { detailRequests += 1; view.read.mockResolvedValue(book); }
  });
  renderView();
  await vi.advanceTimersByTimeAsync(0);
  expect(view.revalidate).not.toHaveBeenCalled();
  view.authLoaded = true; view.authUserId = "owner-a";
  view.getToken = vi.fn(async () => "test-session");
  renderView();
  await vi.advanceTimersByTimeAsync(100);
  expect(renderView()).toContain("Recovered book");
  expect(detailRequests).toBe(1);
  expect(view.revalidate).toHaveBeenCalledExactlyOnceWith("book-a", view.getToken, expect.any(Function));
  expect(clerkGetToken).not.toHaveBeenCalled();
});

it.each([true, false])("opens cached details without waiting for Clerk while online=%s", async (online) => {
  vi.useFakeTimers();
  view.online = online; view.authLoaded = false; view.authUserId = undefined;
  view.read.mockResolvedValue(book);
  renderView();
  await vi.advanceTimersByTimeAsync(0);
  expect(renderView()).toContain("Recovered book");
  expect(view.revalidate).not.toHaveBeenCalled();
  expect(view.getToken).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds cold auth waiting and keeps a retryable unavailable page when auth never becomes ready", async () => {
  vi.useFakeTimers();
  view.authLoaded = false; view.authUserId = undefined;
  renderView();
  await vi.advanceTimersByTimeAsync(2_600);
  expect(renderView()).toContain("Try again");
  expect(view.revalidate).not.toHaveBeenCalled();
  expect(view.getToken).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("drops a pending mounted-owner request when Clerk becomes ready for another owner", async () => {
  vi.useFakeTimers();
  view.authLoaded = false; view.authUserId = undefined;
  renderView();
  await vi.advanceTimersByTimeAsync(0);
  view.authLoaded = true; view.authUserId = "owner-b";
  renderView();
  await vi.advanceTimersByTimeAsync(100);
  expect(renderView()).toContain("Try again");
  expect(view.revalidate).not.toHaveBeenCalled();
  expect(view.getToken).not.toHaveBeenCalled();
});

it("clears the auth wait on disposal without requesting or reading late account data", async () => {
  vi.useFakeTimers();
  view.authLoaded = false; view.authUserId = undefined;
  renderView();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(1);
  const updates = view.updates.mock.calls.length;
  dispose();
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(view.updates).toHaveBeenCalledTimes(updates);
  expect(view.revalidate).not.toHaveBeenCalled();
  expect(view.read).toHaveBeenCalledTimes(1);
});

it("preserves ready details instead of reloading when the same session's token getter refreshes", async () => {
  view.read.mockResolvedValue(book);
  expect(await settledView()).toContain("Recovered book");
  const reads = view.read.mock.calls.length;
  view.getToken = vi.fn(async () => "refreshed-test-session");
  expect(await settledView()).toContain("Recovered book");
  expect(view.read).toHaveBeenCalledTimes(reads);
  expect(view.revalidate).not.toHaveBeenCalled();
});
