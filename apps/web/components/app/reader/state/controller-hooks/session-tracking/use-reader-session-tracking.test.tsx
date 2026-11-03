// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useReaderSessionTracking } from "./use-reader-session-tracking";

const fixture = vi.hoisted(() => ({
  checkpoint: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  create: vi.fn(),
}));
vi.mock("@/features/offline/db", () => ({ getActiveUserId: () => "user" }));
vi.mock("@/features/offline/net/net-state", () => ({ isOnline: () => false }));
vi.mock("@/features/offline/buckets/sessions", () => ({
  SESSION_CHECKPOINT_MS: 30_000,
  createReadingTracker: fixture.create,
  syncPendingSessions: vi.fn(),
  watchSessionLease: () => () => undefined,
}));
const container = document.createElement("div");
let root = createRoot(container);
afterEach(async () => {
  await act(async () => root.unmount());
  root = createRoot(container);
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function Reader({ loaded }: { loaded: boolean }) {
  useReaderSessionTracking({
    libraryItemId: "book",
    payloadStatus: "READY",
    remotePersistenceEnabled: true,
    isLoaded: loaded,
    isSignedIn: loaded,
    getToken: async () => (loaded ? "token" : null),
  });
  return null;
}

it("starts local recording before auth is ready and keeps the tracker through recovery", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  fixture.create.mockReturnValue({
    checkpoint: fixture.checkpoint,
    stop: fixture.stop,
  });
  await act(async () => root.render(<Reader loaded={false} />));
  expect(fixture.create).toHaveBeenCalledOnce();
  expect(fixture.checkpoint).toHaveBeenCalledOnce();
  await act(async () => root.render(<Reader loaded />));
  expect(fixture.create).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(fixture.checkpoint).toHaveBeenCalledTimes(2);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "hidden",
  });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(fixture.stop).toHaveBeenCalledOnce();
});
