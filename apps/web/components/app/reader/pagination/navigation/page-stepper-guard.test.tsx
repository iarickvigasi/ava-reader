import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ReaderNavigationContext } from "../../state/reader-navigation-context";
import { activeChapter } from "../layout/cold-restore-test-fixture";
import { usePageStepper, type PageStepControls } from "./use-page-stepper";
function fixture(loading: boolean, pending = false, page = 0) {
  const leavePassage = vi.fn(),
    select = vi.fn(),
    setPage = vi.fn();
  const capture = vi.fn<(controls: PageStepControls) => void>();
  function Probe() {
    const controls = usePageStepper({
      currentPageIndex: page,
      setCurrentPageIndex: setPage,
      pageCount: 3,
      isLoadingChapter: loading,
      activeChapter,
      onSelectChapter: select,
    });
    capture(controls);
    return null;
  }
  renderToStaticMarkup(
    <ReaderNavigationContext
      value={{
        jump() {},
        back() {},
        settle() {},
        leavePassage,
        canBack: true,
        pending,
        error: null,
      }}
    >
      <Probe />
    </ReaderNavigationContext>,
  );
  return { controls: capture.mock.calls[0][0], leavePassage, select, setPage };
}
it("masked restore or pending jump cannot page, select a neighbor or release exact origin", () => {
  for (const [loading, pending] of [
    [true, false],
    [false, true],
  ]) {
    const f = fixture(loading, pending);
    f.controls.goToNextPage();
    f.controls.goToPreviousPage();
    expect(f.setPage).not.toHaveBeenCalled();
    expect(f.select).not.toHaveBeenCalled();
    expect(f.leavePassage).not.toHaveBeenCalled();
  }
});
it("a real settled page turn releases the landed point without invoking jump history", () => {
  const f = fixture(false);
  f.controls.goToNextPage();
  expect(f.setPage).toHaveBeenCalledOnce();
  expect(f.setPage.mock.calls[0][0](0)).toBe(1);
  expect(f.leavePassage).toHaveBeenCalledOnce();
  expect(f.select).not.toHaveBeenCalled();
  const last = fixture(false, false, 2);
  last.controls.goToNextPage();
  expect(last.leavePassage).not.toHaveBeenCalled();
  expect(last.setPage).not.toHaveBeenCalled();
});
