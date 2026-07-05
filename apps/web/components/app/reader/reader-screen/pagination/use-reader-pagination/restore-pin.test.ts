import { describe, expect, it } from "vitest";
import { shouldKeepStickyRestorePinned } from "./restore-pin";

describe("shouldKeepStickyRestorePinned", () => {
  it("keeps the pin while the reader stays on the restored edge page", () => {
    expect(
      shouldKeepStickyRestorePinned({
        currentPageIndex: 0,
        isStickyRestorePinned: true,
        lastAppliedRestorePageIndex: 0,
      }),
    ).toBe(true);
  });

  it("releases the pin once the reader pages away from the restored edge", () => {
    expect(
      shouldKeepStickyRestorePinned({
        currentPageIndex: 3,
        isStickyRestorePinned: true,
        lastAppliedRestorePageIndex: 0,
      }),
    ).toBe(false);
  });

  it("keeps the pin before the first restore has been applied", () => {
    expect(
      shouldKeepStickyRestorePinned({
        currentPageIndex: 0,
        isStickyRestorePinned: true,
        lastAppliedRestorePageIndex: null,
      }),
    ).toBe(true);
  });

  it("stays released when the pin is already inactive", () => {
    expect(
      shouldKeepStickyRestorePinned({
        currentPageIndex: 0,
        isStickyRestorePinned: false,
        lastAppliedRestorePageIndex: 0,
      }),
    ).toBe(false);
  });
});
