import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { useReaderPagination } from "../use-reader-pagination";
import { activeChapter } from "../layout/cold-restore-test-fixture";
const observed = vi.hoisted(() => ({
  phase: "restoring",
  loading: false,
  bootstrap: false,
}));
vi.mock("../use-viewport-size", () => ({
  useViewportSize: () => ({
    availableHeight: 419,
    pageBoxRef: { current: null },
    rootRef: { current: null },
    pageBoxSize: { width: 520, height: 419 },
  }),
}));
vi.mock("../measurement/use-measurement-cache", () => ({
  useMeasurementCache: () => ({
    activeMeasurementEntry: null,
    activeReadyMeasurementEntry: null,
    pageCount: 1,
    previousChapterPageCount: null,
    storeMeasurementEntry() {},
    warnFailedMeasurement() {},
  }),
}));
vi.mock("../restore/use-restore-controller", () => ({
  useRestoreController: () => observed.phase,
}));
vi.mock("../locator/use-locator-sync", () => ({ useLocatorSync() {} }));
vi.mock("./use-page-navigation", () => ({
  usePageNavigation: (input: { isLoadingChapter: boolean }) => {
    observed.loading = input.isLoadingChapter;
    return { handleTouchEnd() {}, handleTouchStart() {} };
  },
}));
function Probe() {
  useReaderPagination({
    activeChapter,
    previousChapter: null,
    nextChapter: null,
    fontScale: 1,
    isBootstrapping: observed.bootstrap,
    isLoadingChapter: false,
    isPanelOpen: false,
    libraryItemId: "fixture",
    onSelectChapter() {},
    onVisibleLocatorChange() {},
    restoreIntent: null,
    visibleLocator: null,
  });
  return null;
}
it("blocks steps during layout remeasurement, then accepts them only after settlement", () => {
  observed.phase = "restoring";
  renderToStaticMarkup(<Probe />);
  expect(observed.loading).toBe(true);
  observed.phase = "settled";
  renderToStaticMarkup(<Probe />);
  expect(observed.loading).toBe(false);
});
it("does not accept page turns while initial resume is still selecting", () => {
  observed.phase = "settled";
  observed.bootstrap = true;
  renderToStaticMarkup(<Probe />);
  expect(observed.loading).toBe(true);
  observed.bootstrap = false;
});
