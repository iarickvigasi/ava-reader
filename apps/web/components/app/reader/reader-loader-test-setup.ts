import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, vi, type Mock } from "vitest";
import type { ReaderLoadResult } from "@/features/reader/load-reader-for-slug";
import type { loadReaderScreen } from "@/features/reader/load-reader-screen";
import type { ReaderStatusPayload } from "@/lib/api-types";

const fixtures = vi.hoisted(() => ({
  load: vi.fn<typeof loadReaderScreen>(),
  getToken: vi.fn(async () => "token"),
  notice: vi.fn(),
  authReady: true,
}));
vi.mock("@/features/auth/use-offline-auth", () => ({
  useOfflineAuth: () => ({
    getToken: fixtures.getToken,
    isLoaded: fixtures.authReady,
    isSignedIn: fixtures.authReady,
  }),
}));
vi.mock("@/features/offline/notices/missing-book-bus", () => ({
  emitMissingBookOfflineModal: fixtures.notice,
}));
vi.mock("@/features/reader/load-reader-screen", () => ({
  loadReaderScreen: fixtures.load,
}));

import { useReaderScreenLoader } from "./use-reader-screen-loader";
import * as network from "@/features/offline/net/net-state";
const subscribe = network.subscribeToNetworkState;
let root: Root | undefined;
let result: ReaderLoadResult | null;
const payload = {
  status: "READY",
  progress: { locator: null },
} as ReaderStatusPayload;
export const loaded: ReaderLoadResult = {
  kind: "loaded",
  libraryItemId: "book",
  payload,
};
export const load = fixtures.load;
export const notice = fixtures.notice;
export const subscriptions: Mock<() => void>[] = [];
export const read = () => result;
export const setReachable = async (online: boolean) => {
  await act(async () => network.__setNetStateForTests(online));
};
export const setAuthReady = async (ready: boolean) => {
  fixtures.authReady = ready;
  await act(async () => root?.render(createElement(ReaderLoaderProbe)));
};
export const mount = async () => {
  root = createRoot(document.createElement("div"));
  await act(async () => root!.render(createElement(ReaderLoaderProbe)));
};
export const unmount = async () => {
  await act(async () => root?.unmount());
  root = undefined;
};

function ReaderLoaderProbe() {
  const current = useReaderScreenLoader();
  useEffect(() => {
    result = current;
  }, [current]);
  return null;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/app/read/book");
  network.__resetNetStateForTests();
  subscriptions.length = 0;
  fixtures.authReady = true;
  fixtures.notice.mockReset();
  vi.spyOn(network, "subscribeToNetworkState").mockImplementation(
    (listener) => {
      const unsubscribe = vi.fn(subscribe(listener));
      subscriptions.push(unsubscribe);
      return unsubscribe;
    },
  );
  fixtures.load
    .mockReset()
    .mockImplementation(async () => structuredClone(loaded));
});
afterEach(async () => {
  await unmount();
  network.__resetNetStateForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
