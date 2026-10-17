import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReaderLoadResult } from "@/features/reader/load-reader-for-slug";
import { ReaderScreenLoader } from "./reader-screen-loader";
const view = vi.hoisted(() => ({
  result: null as ReaderLoadResult | null,
  retry: vi.fn(),
  reader: vi.fn(),
  recovery: vi.fn(),
  fallback: vi.fn(),
}));
vi.mock("./use-reader-screen-loader", () => ({
  useReaderScreenLoader: () => ({ result: view.result, retry: view.retry }),
}));
vi.mock("./reader-screen", () => ({
  ReaderScreen: (props: unknown) => {
    view.reader(props);
    return <p>Reading</p>;
  },
}));
vi.mock("./reader-shell-skeleton", () => ({
  ReaderShellSkeleton: () => <p>Loading</p>,
}));
vi.mock("@/components/app/core/unavailable-page", () => ({
  UnavailablePage: (props: unknown) => {
    view.recovery(props);
    return <p>Recovery</p>;
  },
}));
vi.mock("@/components/app/core/offline-route-fallback", () => ({
  OfflineRouteFallback: (props: unknown) => {
    view.fallback(props);
    return <p>Offline fallback</p>;
  },
}));
beforeEach(() => {
  view.result = null;
  vi.clearAllMocks();
});
it("shows explicit reader compatibility recovery without mounting content or offline fallback", () => {
  view.result = { kind: "upgrade-required", libraryItemId: "owned-id" };
  expect(renderToStaticMarkup(<ReaderScreenLoader />)).toContain("Recovery");
  expect(view.recovery).toHaveBeenCalledWith({
    kind: "readerUpgrade",
    onRetry: view.retry,
  });
  expect(view.reader).not.toHaveBeenCalled();
  expect(view.fallback).not.toHaveBeenCalled();
});
it("preserves not-found and loading outcomes and wires generic failure retry", () => {
  expect(renderToStaticMarkup(<ReaderScreenLoader />)).toContain("Loading");
  view.result = { kind: "not-found" };
  renderToStaticMarkup(<ReaderScreenLoader />);
  expect(view.recovery).toHaveBeenCalledWith({ kind: "notFound" });
  view.result = { kind: "error" };
  renderToStaticMarkup(<ReaderScreenLoader />);
  expect(view.fallback).toHaveBeenCalledWith({
    routeKey: "generic",
    onRetry: view.retry,
  });
  expect(view.reader).not.toHaveBeenCalled();
});
