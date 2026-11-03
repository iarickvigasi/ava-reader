import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchReaderPayload } from "@/components/app/reader/data/reader-client";
import { loadReaderPayloadFromCache } from "@/features/offline/buckets/book";
import { resolveCachedLibraryItemId } from "./resolve-cached-library-item-id";
import { loadReaderScreen } from "./load-reader-screen";
import type { ReaderStatusPayload } from "@/lib/api-types";

vi.mock("@/components/app/reader/data/reader-client", () => ({
  fetchReaderPayload: vi.fn(),
}));
vi.mock("@/features/offline/buckets/book", () => ({
  loadReaderPayloadFromCache: vi.fn(),
}));
vi.mock("./resolve-cached-library-item-id", () => ({
  resolveCachedLibraryItemId: vi.fn(),
}));
vi.mock("@/features/offline/net/net-state", () => ({ isOnline: () => true }));

const payload = {
  status: "READY",
  book: { libraryItemId: "book" },
} as ReaderStatusPayload;
const readAuth = vi.fn(() => ({
  isLoaded: false,
  isSignedIn: true,
  getToken: vi.fn(async () => "token"),
}));
let controller: AbortController;
const open = () =>
  loadReaderScreen({
    pathname: "/app/read/book",
    readAuth,
    signal: controller.signal,
  });

beforeEach(() => {
  vi.useFakeTimers();
  controller = new AbortController();
  vi.mocked(resolveCachedLibraryItemId).mockResolvedValue("book");
  vi.mocked(loadReaderPayloadFromCache).mockResolvedValue(null);
  vi.mocked(fetchReaderPayload).mockResolvedValue(payload);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("opens cached content without waiting for auth", async () => {
  vi.mocked(loadReaderPayloadFromCache).mockResolvedValue(payload);
  expect(await open()).toEqual({
    kind: "loaded",
    libraryItemId: "book",
    payload,
  });
  expect(readAuth).not.toHaveBeenCalled();
  expect(fetchReaderPayload).not.toHaveBeenCalled();
});

it("does not start a fetch when cancelled during auth boot", async () => {
  const opening = open();
  await vi.advanceTimersByTimeAsync(100);
  expect(readAuth).toHaveBeenCalled();
  controller.abort();
  await opening;
  await vi.advanceTimersByTimeAsync(3000);
  expect(fetchReaderPayload).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("uses the latest ready auth snapshot and passes cancellation to the fetch", async () => {
  const opening = open();
  await vi.advanceTimersByTimeAsync(100);
  const auth = { ...readAuth(), isLoaded: true };
  readAuth.mockReturnValueOnce(auth);
  await vi.advanceTimersByTimeAsync(100);
  expect(await opening).toEqual({
    kind: "loaded",
    libraryItemId: "book",
    payload,
  });
  expect(fetchReaderPayload).toHaveBeenCalledExactlyOnceWith({
    ...auth,
    libraryItemId: "book",
    signal: controller.signal,
  });
});
